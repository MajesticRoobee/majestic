// Phase 1 (F1) — customer accounts. Guest-first and optional. Tokens are
// namespaced with typ:"cust" so they can never authenticate against admin.
import { Hono } from "hono";
import { issueToken, verifyToken, hashPassword, verifyPassword, displayDate, fmtNaira, sha256hex, normalizeContact, todayInWAT } from "./util.js";
import { rewardOut } from "./rewards.js";
import { emitEvent, sendTransactional } from "./events.js";
import { stitchVisitor } from "./insights.js";
import { clientIp, loginBuckets, checkThrottle, recordFailure, clearFailures, lockedMessage } from "./ratelimit.js";

export const account = new Hono();

const clean = (s) => String(s || "").trim();
const lc = (s) => clean(s).toLowerCase();

async function issueCustomerToken(env, cust) {
  return issueToken(env.ADMIN_TOKEN_SECRET, { typ: "cust", cid: cust.id, email: cust.email });
}

// Attach any past guest orders placed with this email.
async function linkOrders(db, customerId, email) {
  await db.prepare("UPDATE orders SET customer_id=? WHERE customer_id IS NULL AND lower(email)=?").bind(customerId, lc(email)).run();
}

function publicProfile(u) {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, city: u.city, emailVerified: !!u.email_verified, marketingOptIn: !!u.marketing_opt_in, birthday: u.birthday || "" };
}

// Create an account, or claim an existing guest record (one with no password).
account.post("/register", async (c) => {
  const { email, password, name, phone, city, marketingOptIn } = await c.req.json();
  if (!email || !lc(email).includes("@")) return c.json({ error: "A valid email is required." }, 400);
  if (!password || String(password).length < 8) return c.json({ error: "Choose a password of at least 8 characters." }, 400);
  const db = c.env.DB;
  const existing = await db.prepare("SELECT * FROM customers WHERE email=?").bind(lc(email)).first();
  const { salt, hash } = await hashPassword(String(password));
  let cust;
  if (existing) {
    if (existing.pass_hash) return c.json({ error: "You already have an account — please log in." }, 409);
    // Guest record → claim it into a full account.
    await db.prepare("UPDATE customers SET pass_hash=?, pass_salt=?, name=COALESCE(NULLIF(?,''), name), phone=COALESCE(NULLIF(?,''), phone), city=COALESCE(?, city), marketing_opt_in=?, last_login=datetime('now') WHERE id=?")
      .bind(hash, salt, clean(name), clean(phone), city || null, marketingOptIn ? 1 : 0, existing.id).run();
    cust = { id: existing.id, email: existing.email };
  } else {
    const r = await db.prepare("INSERT INTO customers (email, name, phone, city, pass_hash, pass_salt, marketing_opt_in, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))")
      .bind(lc(email), clean(name), clean(phone), city || null, hash, salt, marketingOptIn ? 1 : 0).run();
    cust = { id: r.meta.last_row_id, email: lc(email) };
  }
  await linkOrders(db, cust.id, cust.email);
  // Every visit this browser has ever made now belongs to a person. This is the
  // line between "someone opened this four times" and "*this customer* opened
  // this four times" — and the only moment it can be drawn.
  await stitchVisitor(c.env, c.req.header("x-mr-visitor"), cust.id);
  const token = await issueCustomerToken(c.env, cust);
  const u = await db.prepare("SELECT * FROM customers WHERE id=?").bind(cust.id).first();
  await emitEvent(c.env, "customer_registered", { entity: String(u.id), payload: { name: u.name, email: u.email, contact: u.email }, ctx: c.executionCtx });
  return c.json({ token, customer: publicProfile(u) });
});

account.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  const db = c.env.DB;

  const buckets = loginBuckets("cust", clientIp(c.req), lc(email));
  const gate = await checkThrottle(db, buckets);
  if (!gate.ok) return c.json({ error: lockedMessage(gate.retryAfter) }, 429, { "retry-after": String(gate.retryAfter) });

  const u = await db.prepare("SELECT * FROM customers WHERE email=?").bind(lc(email)).first();
  if (!u || !u.pass_hash || !(await verifyPassword(password || "", u.pass_salt, u.pass_hash))) {
    await recordFailure(db, buckets);
    return c.json({ error: "That email or password isn't right." }, 401);
  }
  await clearFailures(db, buckets);
  await db.prepare("UPDATE customers SET last_login=datetime('now') WHERE id=?").bind(u.id).run();
  await linkOrders(db, u.id, u.email);
  await stitchVisitor(c.env, c.req.header("x-mr-visitor"), u.id);
  const token = await issueCustomerToken(c.env, u);
  return c.json({ token, customer: publicProfile(u) });
});

// ---- Password reset ------------------------------------------------------
//
// Guest-first commerce means an account is optional, but the ones that exist
// have to be recoverable — before this there was no reset route at all, so a
// forgotten password locked a customer out of their order history for good.
//
// Two rules shape the flow. The request endpoint always answers the same way,
// whether or not the address is known, because a differing response turns this
// into a "does this person shop here" oracle. And only the *hash* of the token
// is stored, so this table leaking does not hand anyone a working link.

const RESET_TTL_MINUTES = 60;

account.post("/password/forgot", async (c) => {
  const { email } = await c.req.json().catch(() => ({}));
  const db = c.env.DB;
  const addr = lc(email);
  // Same answer in every branch below.
  const answer = () => c.json({ ok: true, message: "If that email has an account, a reset link is on its way." });

  if (!addr.includes("@")) return answer();

  // Throttled on the address rather than the IP alone: without this, the
  // endpoint is a free way to send someone a hundred emails.
  const buckets = loginBuckets("reset", clientIp(c.req), addr);
  const gate = await checkThrottle(db, buckets);
  if (!gate.ok) return answer();
  await recordFailure(db, buckets);

  const u = await db.prepare("SELECT * FROM customers WHERE email=?").bind(addr).first();
  if (!u) return answer();

  // Any link already outstanding stops working the moment a new one is asked
  // for, so a forwarded old email can't be used behind the customer's back.
  await db.prepare("UPDATE password_resets SET used_at=datetime('now') WHERE customer_id=? AND used_at IS NULL").bind(u.id).run();

  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await db.prepare("INSERT INTO password_resets (customer_id, token_hash, expires_at) VALUES (?, ?, datetime('now', ?))")
    .bind(u.id, await sha256hex(token), `+${RESET_TTL_MINUTES} minutes`).run();

  const link = `${new URL(c.req.url).origin}/account?reset=${token}`;
  const name = (u.name || "").split(" ")[0] || "there";
  await sendTransactional(c.env, {
    to: u.email,
    kind: "password_reset",
    subject: "Reset your Majestic Roobee password",
    body: `Hi ${name},\n\nSomeone asked to reset the password on your account. Open the link below within the next hour to choose a new one:\n\n${link}\n\nIf that wasn't you, ignore this email — your password stays as it is.\n\nMajestic Roobee`,
  });
  return answer();
});

account.post("/password/reset", async (c) => {
  const { token, password } = await c.req.json().catch(() => ({}));
  if (!password || String(password).length < 8) return c.json({ error: "Choose a password of at least 8 characters." }, 400);
  const db = c.env.DB;

  const row = await db.prepare(
    "SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > datetime('now')"
  ).bind(await sha256hex(String(token || ""))).first();
  if (!row) return c.json({ error: "That reset link has expired or already been used. Ask for a new one." }, 400);

  const u = await db.prepare("SELECT * FROM customers WHERE id=?").bind(row.customer_id).first();
  if (!u) return c.json({ error: "That reset link has expired or already been used. Ask for a new one." }, 400);

  const { salt, hash } = await hashPassword(String(password));
  await db.batch([
    db.prepare("UPDATE customers SET pass_hash=?, pass_salt=?, last_login=datetime('now') WHERE id=?").bind(hash, salt, u.id),
    // Single use, and every other outstanding link for this account dies too.
    db.prepare("UPDATE password_resets SET used_at=datetime('now') WHERE customer_id=? AND used_at IS NULL").bind(u.id),
  ]);
  // Whoever was being throttled has now proved they own the mailbox.
  await clearFailures(db, loginBuckets("cust", clientIp(c.req), u.email));

  const t = await issueCustomerToken(c.env, u);
  return c.json({ token: t, customer: publicProfile(u) });
});

// Auth guard for the routes below.
account.use("/me", authCust);
account.use("/me/*", authCust);
account.use("/addresses", authCust);
account.use("/addresses/*", authCust);
account.use("/wishlist", authCust);
account.use("/wishlist/*", authCust);

async function authCust(c, next) {
  const auth = c.req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const claims = await verifyToken(c.env.ADMIN_TOKEN_SECRET, token);
  if (!claims || claims.typ !== "cust") return c.json({ error: "Please sign in." }, 401);
  c.set("cid", claims.cid);
  return next();
}

account.get("/me", async (c) => {
  const db = c.env.DB;
  const cid = c.get("cid");
  const u = await db.prepare("SELECT * FROM customers WHERE id=?").bind(cid).first();
  if (!u) return c.json({ error: "Account not found." }, 404);
  const addresses = (await db.prepare("SELECT id, label, address, city, is_default FROM customer_addresses WHERE customer_id=? ORDER BY is_default DESC, id").bind(cid).all()).results;
  const wishlist = (await db.prepare("SELECT product_id FROM wishlists WHERE customer_id=?").bind(cid).all()).results.map((r) => r.product_id);
  const orders = (await db.prepare("SELECT no, status, pay_status, total, placed_at FROM orders WHERE customer_id=? OR lower(email)=? ORDER BY placed_at DESC LIMIT 50").bind(cid, u.email).all()).results;
  return c.json({
    customer: publicProfile(u),
    addresses: addresses.map((a) => ({ ...a, is_default: !!a.is_default })),
    wishlist,
    orders: orders.map((o) => ({ no: o.no, status: o.status, paid: o.pay_status === "paid", total: o.total, totalLabel: fmtNaira(o.total), placed: displayDate(new Date(o.placed_at.replace(" ", "T") + "Z")) })),
    rewards: await ownRewards(db, u),
  });
});

/**
 * The reward codes this customer can spend, and the ones they have spent.
 *
 * Matched on the contact the reward was issued to rather than on a customer id:
 * a reward is earned by *a purchase*, and most purchases here are made as a
 * guest. Registering later with the same email should find the codes that
 * purchase earned, not start from nothing.
 */
async function ownRewards(db, u) {
  const keys = [normalizeContact(u.email), normalizeContact(u.phone)].filter(Boolean);
  if (!keys.length) return [];
  const rows = (await db.prepare(
    `SELECT * FROM reward_codes WHERE owner_key IN (${keys.map(() => "?").join(",")})
      ORDER BY CASE status WHEN 'Active' THEN 0 ELSE 1 END, issued_at DESC LIMIT 50`
  ).bind(...keys).all()).results;
  const today = todayInWAT();
  return rows.map((r) => rewardOut(r, today));
}

account.patch("/me", async (c) => {
  const { name, phone, city, marketingOptIn, birthday } = await c.req.json();
  const db = c.env.DB;
  await db.prepare("UPDATE customers SET name=COALESCE(?,name), phone=COALESCE(?,phone), city=COALESCE(?,city), marketing_opt_in=COALESCE(?,marketing_opt_in), birthday=COALESCE(?,birthday) WHERE id=?")
    .bind(name ?? null, phone ?? null, city ?? null, marketingOptIn === undefined ? null : (marketingOptIn ? 1 : 0), birthday ?? null, c.get("cid")).run();
  const u = await db.prepare("SELECT * FROM customers WHERE id=?").bind(c.get("cid")).first();
  return c.json({ ok: true, customer: publicProfile(u) });
});

account.post("/me/password", async (c) => {
  const { current, next: newPass } = await c.req.json();
  if (!newPass || String(newPass).length < 8) return c.json({ error: "New password must be at least 8 characters." }, 400);
  const db = c.env.DB;
  const u = await db.prepare("SELECT * FROM customers WHERE id=?").bind(c.get("cid")).first();
  if (u.pass_hash && !(await verifyPassword(current || "", u.pass_salt, u.pass_hash))) return c.json({ error: "Your current password isn't right." }, 401);
  const { salt, hash } = await hashPassword(String(newPass));
  await db.prepare("UPDATE customers SET pass_hash=?, pass_salt=? WHERE id=?").bind(hash, salt, c.get("cid")).run();
  return c.json({ ok: true });
});

// ---- Addresses ----
account.post("/addresses", async (c) => {
  const { label, address, city, isDefault } = await c.req.json();
  if (!clean(address)) return c.json({ error: "An address is required." }, 400);
  const db = c.env.DB;
  const cid = c.get("cid");
  if (isDefault) await db.prepare("UPDATE customer_addresses SET is_default=0 WHERE customer_id=?").bind(cid).run();
  const r = await db.prepare("INSERT INTO customer_addresses (customer_id, label, address, city, is_default) VALUES (?, ?, ?, ?, ?)")
    .bind(cid, clean(label) || "Home", clean(address), city || null, isDefault ? 1 : 0).run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

account.delete("/addresses/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM customer_addresses WHERE id=? AND customer_id=?").bind(parseInt(c.req.param("id"), 10), c.get("cid")).run();
  return c.json({ ok: true });
});

// ---- Wishlist ----
account.post("/wishlist", async (c) => {
  const { productId } = await c.req.json();
  if (!clean(productId)) return c.json({ error: "Missing product." }, 400);
  await c.env.DB.prepare("INSERT INTO wishlists (customer_id, product_id) VALUES (?, ?) ON CONFLICT DO NOTHING").bind(c.get("cid"), clean(productId)).run();
  return c.json({ ok: true });
});

// A guest can save things before they have an account — the storefront keeps
// that list in their browser. Signing in hands it over, so nothing a shopper
// saved is lost the moment they finally register.
account.post("/wishlist/merge", async (c) => {
  const { productIds } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(productIds) || !productIds.length) return c.json({ ok: true, added: 0 });
  const db = c.env.DB;
  const known = new Set((await db.prepare("SELECT id FROM products").all()).results.map((p) => p.id));
  const wanted = [...new Set(productIds.map(clean).filter((id) => known.has(id)))].slice(0, 200);
  if (!wanted.length) return c.json({ ok: true, added: 0 });
  await db.batch(wanted.map((id) =>
    db.prepare("INSERT INTO wishlists (customer_id, product_id) VALUES (?, ?) ON CONFLICT DO NOTHING").bind(c.get("cid"), id)
  ));
  return c.json({ ok: true, added: wanted.length });
});

account.delete("/wishlist/:productId", async (c) => {
  await c.env.DB.prepare("DELETE FROM wishlists WHERE customer_id=? AND product_id=?").bind(c.get("cid"), c.req.param("productId")).run();
  return c.json({ ok: true });
});
