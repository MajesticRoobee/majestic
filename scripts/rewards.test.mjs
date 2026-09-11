// Reward codes, exercised directly.
//
// The promise a reward makes is narrow and absolute: **one code, one person,
// one use.** Each of those is a place where a bug costs the shop real money —
// a code that can be spent twice, a code one customer can lift from another, a
// free-product code that discounts something else — so each gets its own
// assertion here rather than being left to the checkout to get right.
//
// The pure arithmetic runs against plain objects. The parts that need a
// database — minting, claiming, the race between two checkouts — run against a
// small in-memory stand-in for D1's prepare/bind/run/first shape, which is
// enough to exercise the conditional UPDATE that makes single use true.
import {
  computeRewardDiscount, rewardRefusal, describeReward, expiryFromNow,
  cleanCode, rewardOut, issueReward, issueEarnedReward, claimReward, releaseReward, mintCode,
} from "../worker/rewards.js";
import { scopeCats, inScope } from "../worker/util.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

const TODAY = "2026-09-11";

const reward = (extra = {}) => ({
  code: "MR-ABC123", kind: "pct", value: 10, free_variant_id: null, descr: "10% off",
  scope: "Storewide", min_spend: 0, owner_key: null, status: "Active",
  expires_at: null, redeemed_at: null, ...extra,
});

// Lines as the server resolves them: a category, a unit price, a quantity.
const line = (cat, unit, qty = 1, variantId = 1) => ({ cat, unit, qty, variantId, lineTotal: unit * qty });

// ---- 1. What a reward is worth -------------------------------------------
console.log("\nWhat a reward takes off");

const cart = [line("perfumes", 40000, 1, 11), line("mist", 12000, 2, 22), line("home", 9000, 1, 33)];

check("a percentage comes off everything in scope",
  computeRewardDiscount(reward({ kind: "pct", value: 10 }), cart).discount, 7300);

check("an amount is capped by what is actually in the cart",
  computeRewardDiscount(reward({ kind: "amt", value: 500000 }), cart).discount, 73000);

check("an amount below the subtotal comes off whole",
  computeRewardDiscount(reward({ kind: "amt", value: 5000 }), cart).discount, 5000);

check("free delivery discounts nothing and frees the shipping line",
  computeRewardDiscount(reward({ kind: "ship" }), cart), { discount: 0, freeShip: true, reason: null });

check("a scope narrows what the percentage is taken from",
  // Fragrances covers perfumes and mist (64,000), not home fragrance.
  computeRewardDiscount(reward({ kind: "pct", value: 50, scope: "Fragrances" }), cart).discount, 32000);

check("a reward whose scope matches nothing in the cart is refused, not silently worth nothing",
  computeRewardDiscount(reward({ kind: "pct", value: 10, scope: "Gift packages" }), cart).reason,
  "Nothing in your cart qualifies for this reward yet.");

// ---- 2. A free product ---------------------------------------------------
console.log("\nA product free");

check("a named size takes off one unit of that size, not the whole line",
  computeRewardDiscount(reward({ kind: "item", free_variant_id: 22, descr: "Sisi 100ml free" }), cart).discount, 12000);

check("...and the code is refused, by name, when that product isn't in the cart",
  computeRewardDiscount(reward({ kind: "item", free_variant_id: 99, descr: "Tango 50ml free" }), cart).reason,
  "Add Tango 50ml to your cart to use this reward.");

check("an open free-product reward takes the cheapest qualifying thing",
  computeRewardDiscount(reward({ kind: "item" }), cart).discount, 9000);

check("...and 'cheapest' respects the scope rather than the whole cart",
  // Home fragrance (9,000) is the cheapest overall but outside Fragrances,
  // so the mist at 12,000 is what comes off.
  computeRewardDiscount(reward({ kind: "item", scope: "Fragrances" }), cart).discount, 12000);

check("a free-product reward on an empty-in-scope cart says so",
  computeRewardDiscount(reward({ kind: "item", scope: "Gift packages" }), cart).reason,
  "Nothing in your cart qualifies for this reward yet.");

// ---- 3. When a reward is refused -----------------------------------------
console.log("\nWhen a reward is refused");

check("an unknown code", rewardRefusal(null, { today: TODAY }), "That code isn't recognised.");
check("a spent code", rewardRefusal(reward({ status: "Redeemed" }), { today: TODAY }), "That reward has already been used.");
check("a voided code", rewardRefusal(reward({ status: "Void" }), { today: TODAY }), "That reward is no longer valid.");
check("a code past its date", rewardRefusal(reward({ expires_at: "2026-09-10" }), { today: TODAY }), "That reward has expired.");
check("a code on its last day still works", rewardRefusal(reward({ expires_at: TODAY }), { today: TODAY }), null);

check("a code issued to someone else",
  rewardRefusal(reward({ owner_key: "ada@email.com" }), { contact: "chidi@email.com", today: TODAY }),
  "That reward was issued to a different email or phone number.");

check("...and the owner themselves gets in",
  rewardRefusal(reward({ owner_key: "ada@email.com" }), { contact: "Ada@Email.com", today: TODAY }), null);

check("...matched loosely enough that a phone typed with spaces still works",
  rewardRefusal(reward({ owner_key: "08092020525" }), { contact: "0809 202 0525", today: TODAY }), null);

check("a bearer code lets anyone in",
  rewardRefusal(reward({ owner_key: null }), { contact: "whoever@email.com", today: TODAY }), null);

check("a minimum spend the cart hasn't reached",
  rewardRefusal(reward({ min_spend: 50000 }), { subtotal: 20000, today: TODAY }),
  "That reward needs a subtotal of ₦50,000 or more.");

check("...and is satisfied exactly at the threshold",
  rewardRefusal(reward({ min_spend: 50000 }), { subtotal: 50000, today: TODAY }), null);

// Ownership is only checked when the contact is known: the checkout page
// validates a code before the email field is necessarily filled in, and a
// refusal there would be a lie.
check("no contact yet means no ownership refusal",
  rewardRefusal(reward({ owner_key: "ada@email.com" }), { today: TODAY }), null);

// ---- 4. Scope, shared with promos ----------------------------------------
console.log("\nScope");

check("storewide is no filter at all", scopeCats("Storewide"), null);
check("a perfume is a fragrance", inScope("Fragrances", "perfumes"), true);
check("a perfume oil is a fragrance", inScope("Fragrances", "designer"), true);
check("a health drink is not", inScope("Fragrances", "health"), false);
check("an unknown scope is treated as storewide", scopeCats("Nonsense"), null);

// ---- 5. Labels and dates -------------------------------------------------
console.log("\nLabels and dates");

check("a percentage describes itself", describeReward({ kind: "pct", value: 15 }), "15% off");
check("an amount is written in naira", describeReward({ kind: "amt", value: 5000 }), "₦5,000 off");
check("free delivery says so", describeReward({ kind: "ship" }), "Free delivery");
check("a named free product names it", describeReward({ kind: "item", freeName: "Sisi 100ml" }), "Sisi 100ml free");
check("an open free product doesn't pretend to", describeReward({ kind: "item" }), "One product free");

check("a code is normalised to something a person can type", cleanCode("  mr-abc 123 "), "MR-ABC123");
check("no expiry days means no expiry", expiryFromNow(0), null);
check("a negative is treated the same way", expiryFromNow(-5), null);
check("ninety days lands ninety days out",
  expiryFromNow(90), new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));

check("an expired-but-active code reads as unusable to both screens",
  rewardOut({ ...reward({ expires_at: "2026-09-01" }), issued_at: "x" }, TODAY).usable, false);

// ---- 6. A database, small enough to reason about -------------------------
//
// Enough of D1's surface to run the statements this module actually issues.
// The point is not to reimplement SQLite — it is to make the *conditional*
// UPDATE real, because "one use" is enforced by whether it changes a row.
console.log("\nOne code, one use");

function fakeDb() {
  const rewards = new Map();
  const promos = new Set();
  return {
    rewards,
    promos,
    prepare(sql) {
      let bound = [];
      const self = {
        bind(...args) { bound = args; return self; },
        async run() {
          if (sql.includes("INSERT INTO reward_codes")) {
            const [code, kind, value, free_variant_id, descr, scope, min_spend,
              owner_key, owner_email, owner_name, source, earned_order_no, issued_by, expires_at, note] = bound;
            if (rewards.has(code)) throw new Error("UNIQUE constraint failed: reward_codes.code");
            rewards.set(code, {
              code, kind, value, free_variant_id, descr, scope, min_spend, owner_key, owner_email,
              owner_name, source, earned_order_no, issued_by, expires_at, note,
              status: "Active", redeemed_at: null, redeemed_order_no: null, issued_at: "now",
            });
            return { meta: { changes: 1 } };
          }
          if (sql.includes("SET status='Redeemed'")) {
            const [orderNo, code] = bound;
            const r = rewards.get(code);
            if (!r || r.status !== "Active" || r.redeemed_at) return { meta: { changes: 0 } };
            Object.assign(r, { status: "Redeemed", redeemed_at: "now", redeemed_order_no: orderNo });
            return { meta: { changes: 1 } };
          }
          if (sql.includes("SET status='Active'")) {
            const [code, orderNo] = bound;
            const r = rewards.get(code);
            if (!r || r.redeemed_order_no !== orderNo) return { meta: { changes: 0 } };
            Object.assign(r, { status: "Active", redeemed_at: null, redeemed_order_no: null });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
        async first() {
          if (sql.includes("UNION ALL")) {
            const [code] = bound;
            return rewards.has(code) || promos.has(code) ? { 1: 1 } : null;
          }
          if (sql.includes("WHERE earned_order_no=?")) {
            const [no] = bound;
            const hit = [...rewards.values()].find((r) => r.earned_order_no === no);
            return hit ? { code: hit.code } : null;
          }
          if (sql.includes("FROM variants v JOIN products p")) return { name: "Sisi", size: "100ml" };
          if (sql.includes("FROM reward_codes WHERE code=?")) return rewards.get(bound[0]) || null;
          return null;
        },
      };
      return self;
    },
  };
}

const db = fakeDb();

const minted = await issueReward(db, { kind: "pct", value: 10, ownerContact: "Ada@Email.com", ownerName: "Ada" });
check("a minted code carries the store's prefix", minted.code.startsWith("MR-"), true);
check("...and describes itself", minted.descr, "10% off");
check("...and is bound to a normalised contact", db.rewards.get(minted.code).owner_key, "ada@email.com");

check("claiming an active code succeeds", await claimReward(db, minted.code, "MR-10001"), true);
check("...and the same code cannot be claimed twice", await claimReward(db, minted.code, "MR-10002"), false);
check("...which is exactly what a second checkout would see",
  rewardRefusal(db.rewards.get(minted.code), { today: TODAY }), "That reward has already been used.");

// An order that fails to write must give the code back — but only the order
// that actually took it may do so.
await releaseReward(db, minted.code, "MR-10002");
check("a release from the wrong order changes nothing", db.rewards.get(minted.code).status, "Redeemed");
await releaseReward(db, minted.code, "MR-10001");
check("...and a release from the order that claimed it puts the code back", db.rewards.get(minted.code).status, "Active");

check("a code already in the promos table is never minted",
  await (async () => {
    db.promos.add("MR-TAKEN");
    const c = await mintCode(db, "MR");
    return c !== "MR-TAKEN";
  })(), true);

check("naming a code that exists is refused rather than silently overwriting",
  await issueReward(db, { kind: "pct", value: 5, code: minted.code }).then(() => "no error").catch((e) => e.message.includes("UNIQUE")), true);

// ---- 7. Earning one by buying --------------------------------------------
console.log("\nEarning one by buying");

const RULE = { rewardsOn: true, rewardEarnKind: "pct", rewardEarnValue: 10, rewardEarnMinSpend: 20000, rewardEarnExpiryDays: 90 };
const order = (extra = {}) => ({ no: "MR-20001", subtotal: 50000, email: "buyer@email.com", phone: "0803", customer: "Buyer", ...extra });

const earned = await issueEarnedReward(db, RULE, order());
check("a qualifying paid order earns a code", !!earned && earned.code.startsWith("MR-"), true);
check("...bound to the buyer", db.rewards.get(earned.code).owner_key, "buyer@email.com");
check("...worth what the rule says", earned.descr, "10% off");
check("...and pointing back at the order that earned it", db.rewards.get(earned.code).earned_order_no, "MR-20001");

check("the same order cannot earn a second code",
  await issueEarnedReward(db, RULE, order()), null);

check("an order under the qualifying spend earns nothing",
  await issueEarnedReward(db, RULE, order({ no: "MR-20002", subtotal: 19999 })), null);

check("...measured on the goods, so delivery can't tip it over",
  await issueEarnedReward(db, RULE, order({ no: "MR-20003", subtotal: 19000, total: 25000 })), null);

check("rewards switched off means nothing is earned",
  await issueEarnedReward(db, { ...RULE, rewardsOn: false }, order({ no: "MR-20004" })), null);

check("an order with no contact has nowhere to send a reward",
  await issueEarnedReward(db, RULE, order({ no: "MR-20005", email: "", phone: "" })), null);

const dated = await issueEarnedReward(db, RULE, order({ no: "MR-20006" }));
check("an earned code expires when the rule says",
  dated.expiresAt, new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));

console.log(failures ? `\n${failures} FAILED` : "\nAll reward checks passed");
process.exit(failures ? 1 : 0);
