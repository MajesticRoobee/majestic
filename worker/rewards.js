// Reward codes — earned by buying, or issued by hand.
//
// The shape of the thing: **one code, one person, one use.** That is what
// separates a reward from a promo, and every rule in this file follows from it.
//
//   · one code   — minted here, from an alphabet with no characters a customer
//                  can misread over the phone
//   · one person — `owner_key` is the contact it was issued to, and checkout
//                  refuses it to anyone else. A code with no owner is a bearer
//                  code, which is what a giveaway wants
//   · one use    — claimed with a conditional UPDATE *before* the order is
//                  written, so two checkouts racing on the same code cannot
//                  both spend it
//
// A reward can also be a **free product**, which a promo cannot. That is not a
// new kind of line on the order: the shopper puts the product in their cart and
// the reward takes its price off as a discount. No phantom stock, no zero-priced
// line item, and the order that reaches the packing bench is an ordinary order.

import { scopeCats, normalizeContact, todayInWAT, fmtNaira } from "./util.js";

// No O/0, no I/1, no S/5 — a code is read aloud and typed by hand more often
// than it is copied, and those are the pairs people get wrong.
const ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";

function randomBody(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  // Modulo bias over a 30-letter alphabet is a fraction of a percent across
  // 256 values — irrelevant for a coupon, and not worth a rejection loop.
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function cleanCode(s) {
  return String(s || "").trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * A code nothing in either table is using yet.
 *
 * Checked against `promos` as well as `reward_codes`: the storefront resolves
 * one code box against both, so a reward that collided with a sale code would
 * be unreachable — the promo would answer first, forever.
 */
export async function mintCode(db, prefix = "MR", tries = 6) {
  const head = cleanCode(prefix).replace(/[^A-Z0-9]/g, "").slice(0, 6) || "MR";
  for (let i = 0; i < tries; i++) {
    // A longer body on the last couple of attempts: if six characters keep
    // colliding, the table is dense enough that retrying six will keep failing.
    const code = `${head}-${randomBody(i < tries - 2 ? 6 : 8)}`;
    const clash = await db
      .prepare("SELECT 1 FROM reward_codes WHERE code=? UNION ALL SELECT 1 FROM promos WHERE code=? LIMIT 1")
      .bind(code, code)
      .first();
    if (!clash) return code;
  }
  throw new Error("Could not mint an unused reward code.");
}

/** What the code says it is worth, in words a shopper reads on their receipt. */
export function describeReward({ kind, value, freeName }) {
  if (kind === "pct") return `${value}% off`;
  if (kind === "amt") return `${fmtNaira(value)} off`;
  if (kind === "ship") return "Free delivery";
  if (kind === "item") return freeName ? `${freeName} free` : "One product free";
  return "Reward";
}

// ---------------------------------------------------------------- reading ---

/** One reward by code, or null. */
export function getReward(db, code) {
  return db.prepare("SELECT * FROM reward_codes WHERE code=?").bind(cleanCode(code)).first();
}

/**
 * Why a reward cannot be used right now — or null when it can.
 *
 * `contact` is the email or phone on the order. It is optional because the
 * checkout page validates a code before those fields are necessarily filled in;
 * the binding is enforced for real when the order is placed, where the contact
 * always exists.
 */
export function rewardRefusal(reward, { contact = "", subtotal = 0, today = todayInWAT() } = {}) {
  if (!reward) return "That code isn't recognised.";
  if (reward.status === "Redeemed") return "That reward has already been used.";
  if (reward.status === "Void") return "That reward is no longer valid.";
  if (reward.status !== "Active") return "That reward isn't active.";
  if (reward.expires_at && today > reward.expires_at) return "That reward has expired.";
  if (reward.owner_key && contact && normalizeContact(contact) !== reward.owner_key)
    return "That reward was issued to a different email or phone number.";
  if (reward.min_spend > 0 && subtotal < reward.min_spend)
    return `That reward needs a subtotal of ${fmtNaira(reward.min_spend)} or more.`;
  return null;
}

// ------------------------------------------------------------ calculating ---

/**
 * What a reward takes off this cart, and why it might take off nothing.
 *
 * `lines` are the server's own resolved lines — [{ cat, unit, qty, lineTotal,
 * variantId, name, size }] — never numbers a browser sent.
 *
 * Returns { discount, freeShip, reason }. A non-null `reason` means the code is
 * refused rather than merely worth zero: "add the product this reward is for"
 * is something a shopper can act on, where a silent ₦0 discount reads as the
 * checkout being broken.
 */
export function computeRewardDiscount(reward, lines) {
  const cats = scopeCats(reward.scope);
  const eligible = lines.filter((l) => !cats || cats.includes(l.cat));

  if (reward.kind === "ship") return { discount: 0, freeShip: true, reason: null };

  if (reward.kind === "item") {
    // A named size: it has to actually be in the cart. Anything else would mean
    // silently discounting a different product from the one the reward promised.
    if (reward.free_variant_id) {
      const hit = eligible.find((l) => Number(l.variantId) === Number(reward.free_variant_id));
      if (!hit) {
        return {
          discount: 0,
          freeShip: false,
          reason: `Add ${reward.descr.replace(/ free$/i, "") || "the product this reward is for"} to your cart to use this reward.`,
        };
      }
      return { discount: hit.unit, freeShip: false, reason: null };
    }
    // No named size: the cheapest thing the scope covers, one unit of it.
    if (!eligible.length) {
      return { discount: 0, freeShip: false, reason: "Nothing in your cart qualifies for this reward yet." };
    }
    const cheapest = eligible.reduce((a, b) => (b.unit < a.unit ? b : a));
    return { discount: cheapest.unit, freeShip: false, reason: null };
  }

  const base = eligible.reduce((n, l) => n + l.lineTotal, 0);
  if (!base) return { discount: 0, freeShip: false, reason: "Nothing in your cart qualifies for this reward yet." };
  if (reward.kind === "pct") return { discount: Math.round((base * reward.value) / 100), freeShip: false, reason: null };
  if (reward.kind === "amt") return { discount: Math.min(reward.value, base), freeShip: false, reason: null };
  return { discount: 0, freeShip: false, reason: "That reward isn't active." };
}

/** The free product a reward names, for the label on the checkout line. */
export async function freeItemName(db, variantId) {
  if (!variantId) return "";
  const row = await db
    .prepare("SELECT p.name AS name, v.size AS size FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id=?")
    .bind(variantId)
    .first();
  return row ? `${row.name} ${row.size}`.trim() : "";
}

// ------------------------------------------------------------- spending it ---

/**
 * Take the code out of circulation for this order.
 *
 * The conditional UPDATE is the whole point: `changes === 0` means somebody
 * else's checkout got there first, and this order must be refused rather than
 * quietly given a discount nobody paid for. It runs *before* the order batch,
 * so a race is settled by the database and not by whichever request happened to
 * commit last.
 */
export async function claimReward(db, code, orderNo) {
  const r = await db
    .prepare(
      `UPDATE reward_codes SET status='Redeemed', redeemed_at=datetime('now'), redeemed_order_no=?
        WHERE code=? AND status='Active' AND redeemed_at IS NULL`
    )
    .bind(orderNo, cleanCode(code))
    .run();
  return r.meta.changes > 0;
}

/**
 * Put a claimed code back, because the order it was claimed for never got
 * written. Scoped to that order number so it can never resurrect a code some
 * other checkout has legitimately spent in the meantime.
 */
export async function releaseReward(db, code, orderNo) {
  await db
    .prepare(
      `UPDATE reward_codes SET status='Active', redeemed_at=NULL, redeemed_order_no=NULL
        WHERE code=? AND redeemed_order_no=?`
    )
    .bind(cleanCode(code), orderNo)
    .run();
}

// ---------------------------------------------------------------- issuing ---

const asInt = (v, dflt = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : dflt;
};

/** An ISO date `days` from now, or null when no expiry was asked for. */
export function expiryFromNow(days) {
  const n = asInt(days, 0);
  if (n <= 0) return null;
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

/**
 * Write one reward.
 *
 * Everything a caller can get wrong is normalised here rather than at each call
 * site — the admin form, the earning rule and the tests all mint through this
 * one door, so a code issued by hand behaves exactly like a code issued by a
 * purchase.
 */
export async function issueReward(db, {
  kind = "pct", value = 0, freeVariantId = null, scope = "Storewide", minSpend = 0,
  ownerContact = "", ownerEmail = "", ownerName = "", source = "manual",
  earnedOrderNo = null, issuedBy = "", expiresAt = null, note = "", prefix = "MR", code = null,
} = {}) {
  const k = ["pct", "amt", "ship", "item"].includes(kind) ? kind : "pct";
  const v = k === "pct" || k === "amt" ? Math.max(0, asInt(value, 0)) : 0;
  const freeId = k === "item" && freeVariantId ? asInt(freeVariantId, 0) || null : null;
  const descr = describeReward({ kind: k, value: v, freeName: freeId ? await freeItemName(db, freeId) : "" });
  const theCode = code ? cleanCode(code) : await mintCode(db, prefix);
  const ownerKey = ownerContact ? normalizeContact(ownerContact) : null;
  await db
    .prepare(
      `INSERT INTO reward_codes
         (code, kind, value, free_variant_id, descr, scope, min_spend,
          owner_key, owner_email, owner_name, source, earned_order_no, issued_by, expires_at, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      theCode, k, v, freeId, descr, scope || "Storewide", Math.max(0, asInt(minSpend, 0)),
      ownerKey, String(ownerEmail || "").trim(), String(ownerName || "").trim(),
      source || "manual", earnedOrderNo, String(issuedBy || "").trim(), expiresAt, String(note || "").trim()
    )
    .run();
  return { code: theCode, kind: k, value: v, descr, expiresAt, scope: scope || "Storewide" };
}

/**
 * The reward a paid order earns, if the shop is giving them and this order
 * qualifies.
 *
 * Called from the one place an order becomes paid, so a card payment and a bank
 * transfer a manager confirmed both earn the same thing. Returns the reward, or
 * null when the rule says this order earns nothing — which is not an error.
 *
 * Idempotent on the order: `markPaid` is deliberately racy (the redirect leg and
 * the webhook both call it) and the settlement itself is guarded, but a retried
 * cron sweep or a replayed webhook must not mint a second code for one purchase.
 */
export async function issueEarnedReward(db, settings, order) {
  if (!settings.rewardsOn) return null;
  const already = await db
    .prepare("SELECT code FROM reward_codes WHERE earned_order_no=? LIMIT 1")
    .bind(order.no)
    .first();
  if (already) return null;

  const minSpend = asInt(settings.rewardEarnMinSpend, 0);
  // Measured on the goods, not the delivery: a distant address should not be
  // what tips an order over the threshold.
  if (Number(order.subtotal || 0) < minSpend) return null;

  const contact = order.email || order.phone || "";
  if (!contact) return null;   // nothing to bind it to, and nowhere to send it

  return issueReward(db, {
    kind: settings.rewardEarnKind || "pct",
    value: asInt(settings.rewardEarnValue, 10),
    scope: settings.rewardEarnScope || "Storewide",
    ownerContact: contact,
    ownerEmail: order.email || "",
    ownerName: order.customer || "",
    source: "purchase",
    earnedOrderNo: order.no,
    expiresAt: expiryFromNow(settings.rewardEarnExpiryDays ?? 90),
    prefix: settings.rewardCodePrefix || "MR",
    note: `Earned on ${order.no}`,
  });
}

/** The shape the storefront and the admin both read a reward in. */
export function rewardOut(r, today = todayInWAT()) {
  return {
    code: r.code,
    kind: r.kind,
    value: r.value,
    desc: r.descr,
    scope: r.scope,
    minSpend: r.min_spend,
    freeVariantId: r.free_variant_id,
    owner: r.owner_email || r.owner_key || "",
    ownerName: r.owner_name || "",
    source: r.source,
    earnedOn: r.earned_order_no || "",
    issuedAt: r.issued_at,
    issuedBy: r.issued_by || "",
    expiresAt: r.expires_at || "",
    status: r.status,
    redeemedAt: r.redeemed_at || "",
    redeemedOn: r.redeemed_order_no || "",
    note: r.note || "",
    expired: !!(r.expires_at && today > r.expires_at),
    usable: r.status === "Active" && !(r.expires_at && today > r.expires_at),
  };
}
