// Admin API — Bearer-token protected.
import { Hono } from "hono";
import {
  getSettings, putSettings, loadProducts, issueToken, verifyToken, displayTime, displayDate,
  hashPassword, verifyPassword, randomPassphrase, randomTotpSecret, totpVerify, otpauthUri, sha256hex,
  optionLabel, makeSku, allLocations, locationIds, promoIsLive, todayInWAT, watToMs, msToWat,
} from "./util.js";
import { emitEvent } from "./events.js";
import { stockHealth, sweepStock } from "./inventory.js";
import { loadHomeBlocks, SOURCES } from "./home.js";
import { overview as insightOverview, segmentCounts, segmentRows, soldOutDemand, rollup, insightsConfig } from "./insights.js";
import { rebuildAffinity } from "./affinity.js";
import { markPaidManually, releaseExpiredOrders } from "./payments.js";
import { clientIp, loginBuckets, checkThrottle, recordFailure, clearFailures, lockedMessage } from "./ratelimit.js";
import { parseEmbed, embedUrlFor, dealIsLive, pickDailyDeal, resolveDailyDeal } from "./merch.js";
import { putMedia, migrateToR2 } from "./media.js";
import { issueReward, getReward, rewardOut, expiryFromNow, cleanCode } from "./rewards.js";
import { clamp as clampText, PREVIEW_MAX, TITLE_MAX } from "../src/lib/blog.js";

const randHex = (n = 24) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

export const admin = new Hono();

const roleLabel = (u) => (u.role === "super" ? "Super admin" : `${(u.scope || "").charAt(0).toUpperCase() + (u.scope || "").slice(1)} manager`);

admin.post("/login", async (c) => {
  const { username, password, totp } = await c.req.json();
  const db = c.env.DB;

  // Throttling comes before any credential is looked at, so a locked-out
  // caller learns nothing about whether the username exists. Both buckets are
  // checked: this IP against this identity, and this IP against anything.
  //
  // The master passphrase carries no username, so it is given one. Without it
  // the break-glass credential — the most powerful one there is — would fall
  // back to the wide per-IP limit and be the *least* throttled thing here.
  const buckets = username
    ? loginBuckets("admin", clientIp(c.req), username)
    : loginBuckets("admin", clientIp(c.req), "passphrase", "m");
  const gate = await checkThrottle(db, buckets);
  if (!gate.ok) {
    return c.json({ error: lockedMessage(gate.retryAfter) }, 429, { "retry-after": String(gate.retryAfter) });
  }

  // Per-user account login
  if (username) {
    const u = await db.prepare("SELECT * FROM admin_users WHERE username=? AND active=1").bind(String(username).trim().toLowerCase()).first();
    if (!u || !(await verifyPassword(password || "", u.pass_salt, u.pass_hash))) {
      await recordFailure(db, buckets);
      return c.json({ error: "That username or passphrase isn't right." }, 401);
    }
    if (u.totp_enabled) {
      // The passphrase was right, so this is not a failed attempt — but it is
      // not a success either, and must not clear the slate.
      if (!totp) return c.json({ error: "2FA required.", needTotp: true }, 401);
      if (!(await totpVerify(u.totp_secret, totp))) {
        await recordFailure(db, buckets);
        return c.json({ error: "That 2FA code isn't right.", needTotp: true }, 401);
      }
    }
    await clearFailures(db, buckets);
    await db.prepare("UPDATE admin_users SET last_login=datetime('now') WHERE id=?").bind(u.id).run();
    const token = await issueToken(c.env.ADMIN_TOKEN_SECRET, { typ: "admin", uid: u.id, role: u.role, scope: u.scope || null });
    return c.json({ token, role: roleLabel(u), name: u.name, scope: u.scope || null, mustChange: !!u.must_change, totpEnabled: !!u.totp_enabled });
  }

  // Master passphrase (break-glass super admin)
  if (password && c.env.ADMIN_PASSWORD && password === c.env.ADMIN_PASSWORD) {
    await clearFailures(db, buckets);
    const token = await issueToken(c.env.ADMIN_TOKEN_SECRET, { typ: "admin", uid: 0, role: "super", scope: null, master: true });
    return c.json({ token, role: "Super admin", name: "Master", scope: null, master: true });
  }
  await recordFailure(db, buckets);
  return c.json({ error: "That's not the key to the house." }, 401);
});

admin.use("*", async (c, next) => {
  if (c.req.path.endsWith("/login")) return next();
  const auth = c.req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const claims = await verifyToken(c.env.ADMIN_TOKEN_SECRET, token);
  if (!claims || claims.typ !== "admin") return c.json({ error: "Unauthorized" }, 401);
  c.set("admin", claims);
  return next();
});

const requireSuper = async (c, next) => {
  if (c.get("admin").role !== "super") return c.json({ error: "Only a super admin can do that." }, 403);
  return next();
};

// Managers are pinned to their own store; supers may pass any scope.
function effectiveScope(c, requested) {
  const a = c.get("admin");
  if (a.role !== "super") return a.scope || "all";
  return requested;
}

// ---- Current account (self-service) ----
admin.get("/me", async (c) => {
  const a = c.get("admin");
  if (a.uid === 0) return c.json({ id: 0, username: "master", name: "Master", role: "super", scope: null, mustChange: false, totpEnabled: false, master: true });
  const u = await c.env.DB.prepare("SELECT id, username, name, role, scope, must_change, totp_enabled FROM admin_users WHERE id=?").bind(a.uid).first();
  if (!u) return c.json({ error: "Account not found." }, 404);
  return c.json({ id: u.id, username: u.username, name: u.name, role: u.role, scope: u.scope, mustChange: !!u.must_change, totpEnabled: !!u.totp_enabled });
});

admin.post("/account/password", async (c) => {
  const a = c.get("admin");
  if (a.uid === 0) return c.json({ error: "The master passphrase is changed via the ADMIN_PASSWORD secret, not here." }, 400);
  const { current, next: newPass } = await c.req.json();
  if (!newPass || String(newPass).length < 8) return c.json({ error: "New passphrase must be at least 8 characters." }, 400);
  const u = await c.env.DB.prepare("SELECT * FROM admin_users WHERE id=?").bind(a.uid).first();
  if (!u || !(await verifyPassword(current || "", u.pass_salt, u.pass_hash))) return c.json({ error: "Your current passphrase isn't right." }, 401);
  const { salt, hash } = await hashPassword(String(newPass));
  await c.env.DB.prepare("UPDATE admin_users SET pass_hash=?, pass_salt=?, must_change=0 WHERE id=?").bind(hash, salt, a.uid).run();
  return c.json({ ok: true });
});

// 2FA enrolment: init returns a secret + otpauth URI; enable verifies a code.
admin.post("/account/totp/init", async (c) => {
  const a = c.get("admin");
  if (a.uid === 0) return c.json({ error: "Enable 2FA on a named account, not the master passphrase." }, 400);
  const u = await c.env.DB.prepare("SELECT username FROM admin_users WHERE id=?").bind(a.uid).first();
  const secret = randomTotpSecret();
  await c.env.DB.prepare("UPDATE admin_users SET totp_secret=?, totp_enabled=0 WHERE id=?").bind(secret, a.uid).run();
  return c.json({ secret, uri: otpauthUri(secret, u.username) });
});
admin.post("/account/totp/enable", async (c) => {
  const a = c.get("admin");
  const { code } = await c.req.json();
  const u = await c.env.DB.prepare("SELECT totp_secret FROM admin_users WHERE id=?").bind(a.uid).first();
  if (!u || !u.totp_secret) return c.json({ error: "Start 2FA setup first." }, 400);
  if (!(await totpVerify(u.totp_secret, code))) return c.json({ error: "That code isn't right — check your authenticator." }, 400);
  await c.env.DB.prepare("UPDATE admin_users SET totp_enabled=1 WHERE id=?").bind(a.uid).run();
  return c.json({ ok: true });
});
admin.post("/account/totp/disable", async (c) => {
  const a = c.get("admin");
  const { code } = await c.req.json();
  const u = await c.env.DB.prepare("SELECT totp_secret FROM admin_users WHERE id=?").bind(a.uid).first();
  if (!u || !(await totpVerify(u.totp_secret, code))) return c.json({ error: "Confirm with a current 2FA code to turn it off." }, 400);
  await c.env.DB.prepare("UPDATE admin_users SET totp_enabled=0, totp_secret=NULL WHERE id=?").bind(a.uid).run();
  return c.json({ ok: true });
});

// ---- Staff management (super only) ----
admin.get("/users", requireSuper, async (c) => {
  const rows = (await c.env.DB.prepare("SELECT id, username, name, role, scope, must_change, totp_enabled, active, created_at, last_login FROM admin_users ORDER BY created_at").all()).results;
  return c.json({ users: rows.map((u) => ({ ...u, must_change: !!u.must_change, totp_enabled: !!u.totp_enabled, active: !!u.active })) });
});

admin.post("/users", requireSuper, async (c) => {
  const { username, name, role, scope } = await c.req.json();
  const uname = String(username || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!uname || !name) return c.json({ error: "A username and a name are required." }, 400);
  if (!["super", "manager"].includes(role)) return c.json({ error: "Pick a role." }, 400);
  if (role === "manager" && !(await locationIds(c.env.DB)).includes(scope)) return c.json({ error: "Managers need a store." }, 400);
  const exists = await c.env.DB.prepare("SELECT id FROM admin_users WHERE username=?").bind(uname).first();
  if (exists) return c.json({ error: "That username is taken." }, 400);
  const passphrase = randomPassphrase();
  const { salt, hash } = await hashPassword(passphrase);
  const by = c.get("admin");
  await c.env.DB.prepare(
    "INSERT INTO admin_users (username, name, role, scope, pass_hash, pass_salt, must_change, created_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?)"
  ).bind(uname, name.trim(), role, role === "manager" ? scope : null, hash, salt, by.master ? "master" : String(by.uid)).run();
  // Passphrase is returned exactly once — the super admin passes it to the employee.
  return c.json({ ok: true, username: uname, passphrase });
});

admin.post("/users/:id/reset", requireSuper, async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const u = await c.env.DB.prepare("SELECT id FROM admin_users WHERE id=?").bind(id).first();
  if (!u) return c.json({ error: "No such user." }, 404);
  const passphrase = randomPassphrase();
  const { salt, hash } = await hashPassword(passphrase);
  await c.env.DB.prepare("UPDATE admin_users SET pass_hash=?, pass_salt=?, must_change=1, totp_enabled=0, totp_secret=NULL WHERE id=?").bind(hash, salt, id).run();
  return c.json({ ok: true, passphrase });
});

admin.patch("/users/:id", requireSuper, async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const { active } = await c.req.json();
  await c.env.DB.prepare("UPDATE admin_users SET active=? WHERE id=?").bind(active ? 1 : 0, id).run();
  return c.json({ ok: true });
});

function scopeFilter(scope) {
  return scope && scope !== "all" ? scope : null;
}

function relTime(iso) {
  const then = new Date(iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

admin.get("/overview", async (c) => {
  const db = c.env.DB;
  const scope = scopeFilter(effectiveScope(c, c.req.query("scope")));
  const settings = await getSettings(db);
  const locations = (await db.prepare("SELECT * FROM locations ORDER BY sort").all()).results;
  const scopeSql = scope ? "AND fulfilled_from = ?" : "";
  const bindScope = (stmt) => (scope ? stmt.bind(scope) : stmt);

  // Revenue series — last 14 days, paid orders.
  const seriesRows = (await bindScope(db.prepare(
    `SELECT date(placed_at) AS d, SUM(total) AS v FROM orders
     WHERE pay_status='paid' AND placed_at >= datetime('now', '-14 days') ${scopeSql} GROUP BY d`
  )).all()).results;
  const byDay = Object.fromEntries(seriesRows.map((r) => [r.d, r.v]));
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: byDay[key] || 0 });
  }

  const cur = await bindScope(db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS rev FROM orders
     WHERE pay_status='paid' AND placed_at >= datetime('now', '-14 days') ${scopeSql}`
  )).first();
  const prev = await bindScope(db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS rev FROM orders
     WHERE pay_status='paid' AND placed_at >= datetime('now', '-28 days') AND placed_at < datetime('now', '-14 days') ${scopeSql}`
  )).first();

  const byLoc = (await db.prepare(
    `SELECT fulfilled_from AS id, COALESCE(SUM(total),0) AS rev FROM orders
     WHERE pay_status='paid' AND placed_at >= datetime('now', '-30 days') GROUP BY fulfilled_from`
  ).all()).results;
  const revTotal = byLoc.reduce((n, r) => n + r.rev, 0) || 1;
  const revenueByLocation = locations.map((l) => {
    const r = byLoc.find((x) => x.id === l.id);
    return { id: l.id, city: l.city, pct: Math.round(((r ? r.rev : 0) / revTotal) * 100) };
  });

  const tops = (await bindScope(db.prepare(
    `SELECT oi.product_id AS id, oi.name, SUM(oi.qty) AS units FROM order_items oi
     JOIN orders o ON o.no = oi.order_no
     WHERE o.pay_status='paid' AND o.placed_at >= datetime('now', '-30 days') ${scope ? "AND o.fulfilled_from = ?" : ""}
     GROUP BY oi.product_id ORDER BY units DESC LIMIT 5`
  )).all()).results;

  const orders = (await bindScope(db.prepare(
    `SELECT * FROM orders WHERE 1=1 ${scopeSql} ORDER BY placed_at DESC LIMIT 8`
  )).all()).results;
  // Which stores each of those orders ships from — an order can now be several
  // parcels, and the dashboard should say so rather than name only the first.
  const parcelRows = orders.length
    ? (await db.prepare(
        `SELECT s.order_no, s.location_id, l.city FROM order_shipments s
         LEFT JOIN locations l ON l.id = s.location_id
         WHERE s.order_no IN (${orders.map(() => "?").join(",")}) ORDER BY s.sort, s.id`
      ).bind(...orders.map((o) => o.no)).all()).results
    : [];

  // Stock health. The line each shelf is measured against lives in
  // worker/inventory.js, so the dashboard, the inventory screen, the alert and
  // the storefront's "only N left" can never disagree about what "low" means.
  const health = await stockHealth(db, settings, scope);
  const lowCount = health.low.length;
  const outCount = health.out.length;

  const abandoned = (await db.prepare(
    "SELECT * FROM abandoned_checkouts WHERE converted=0 ORDER BY updated_at DESC LIMIT 12"
  ).all()).results;

  return c.json({
    kpis: {
      revenue14: cur.rev,
      revenuePrev: prev.rev,
      orders14: cur.n,
      ordersPrev: prev.n,
      avgOrder: cur.n ? Math.round(cur.rev / cur.n) : 0,
      lowCount,
      outCount,
    },
    series,
    revenueByLocation,
    topProducts: tops,
    locations: locations.map((l) => ({ id: l.id, city: l.city, store: l.store, active: !!l.active })),
    orders: orders.map((o) => ({
      no: o.no, customer: o.customer, phone: o.phone, email: o.email, city: o.city,
      fulfilledFrom: o.fulfilled_from, method: o.method, pay: o.pay, payStatus: o.pay_status,
      status: o.status, total: o.total, placed: displayDate(new Date(o.placed_at.replace(" ", "T") + "Z")),
      parcels: parcelRows.filter((p) => p.order_no === o.no).map((p) => p.city || p.location_id),
    })),
    abandoned: abandoned.map((a) => ({
      name: a.name, phone: a.phone, email: a.email, city: a.city, value: a.value_ngn, stage: a.stage, time: relTime(a.updated_at),
    })),
  });
});

admin.get("/products", async (c) => c.json({ products: await loadProducts(c.env.DB) }));

// What a product's option axes are called. Almost always ["Size"].
function normaliseOptionNames(v) {
  const arr = Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v.trim()] : [];
  const clean = arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 3);
  return clean.length ? clean : ["Size"];
}

// SKUs are unique across the catalogue; suffix until the wanted one is free.
async function freeSku(db, want, exceptId = -1) {
  const base = String(want || "").trim() || "sku";
  for (let n = 0; n < 50; n++) {
    const candidate = n ? `${base}-${n + 1}` : base;
    const taken = await db.prepare("SELECT id FROM variants WHERE sku=? AND id IS NOT ?").bind(candidate, exceptId).first();
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// Create a real product: any number of sizes, each with its own price and
// opening stock per store, plus an image and an immediate live/draft choice.
admin.post("/products", async (c) => {
  const b = await c.req.json();
  const name = String(b.name || "").trim();
  if (!name) return c.json({ error: "A product name is required." }, 400);

  // Accept the new multi-variant shape, or the older single size/price fields.
  let variants = Array.isArray(b.variants) && b.variants.length
    ? b.variants
    : [{ size: b.size, price: b.price, stock: {} }];
  variants = variants
    .map((v) => ({
      // A variation's label is its options joined — "50ml", or "50ml / Gold"
      // once a product has a second axis.
      size: optionLabel(v.option1 ?? v.size, v.option2, v.option3),
      option1: String(v.option1 ?? v.size ?? "").trim(),
      option2: String(v.option2 ?? "").trim() || null,
      option3: String(v.option3 ?? "").trim() || null,
      price: parseInt(v.price, 10) || 0,
      sku: String(v.sku || "").trim(),
      imageUrl: String(v.imageUrl || "").trim() || null,
      stock: v.stock || {},
    }))
    .filter((v) => v.size || v.price);
  if (!variants.length) return c.json({ error: "Add at least one size with a price." }, 400);
  for (const v of variants) {
    if (!v.size) return c.json({ error: "Every size needs a label (e.g. 30ml)." }, 400);
    if (!v.price || v.price < 0) return c.json({ error: `Give "${v.size}" a price.` }, 400);
  }
  const sizes = variants.map((v) => v.size.toLowerCase());
  if (new Set(sizes).size !== sizes.length) return c.json({ error: "Each size must be unique." }, 400);

  const db = c.env.DB;
  // cat is a foreign key into categories — check it here so a bad value reads as
  // a sentence rather than surfacing as a constraint failure.
  const cat = String(b.cat || "perfumes").trim();
  const catRow = await db.prepare("SELECT id FROM categories WHERE id=?").bind(cat).first();
  if (!catRow) {
    const all = await db.prepare("SELECT id FROM categories ORDER BY sort").all();
    return c.json({ error: `"${cat}" isn't one of the categories. Pick one of: ${all.results.map((r) => r.id).join(", ")}.` }, 400);
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
  const exists = await db.prepare("SELECT id FROM products WHERE id=?").bind(slug).first();
  const id = exists ? `${slug}-${Date.now().toString(36)}` : slug;

  const optionNames = normaliseOptionNames(b.optionNames);
  const productImage = (b.imageUrl || "").trim() || null;

  await db.prepare(
    "INSERT INTO products (id, name, cat, brand, gender, family, notes, descr, image_url, live, option_names, split_listing, pin_new, pin_best) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    id, name, cat, String(b.brand || "").trim(), b.gender || "Unisex", b.family || "",
    (b.notes || "").trim() || "—",
    (b.desc || "").trim() || "A new addition to the house — description coming soon.",
    productImage,
    b.live ? 1 : 0,
    JSON.stringify(optionNames),
    b.splitListing ? 1 : 0,
    b.pinNew ? 1 : 0,
    b.pinBest ? 1 : 0
  ).run();

  if (productImage) {
    await db.prepare("INSERT INTO product_images (product_id, variant_id, url, alt, sort) VALUES (?, NULL, ?, ?, 0)")
      .bind(id, productImage, name).run();
  }

  const stores = await locationIds(db);
  for (const [i, v] of variants.entries()) {
    const vr = await db.prepare(
      "INSERT INTO variants (product_id, size, option1, option2, option3, price_ngn, sku, image_url, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, v.size, v.option1 || v.size, v.option2, v.option3, v.price, await freeSku(db, v.sku || makeSku(id, v.size)), v.imageUrl, i).run();
    const vid = vr.meta.last_row_id;
    if (v.imageUrl) {
      await db.prepare("INSERT INTO product_images (product_id, variant_id, url, alt, sort) VALUES (?, ?, ?, ?, ?)")
        .bind(id, vid, v.imageUrl, `${name} — ${v.size}`, i + 1).run();
    }
    await db.batch(stores.map((l) =>
      db.prepare("INSERT INTO stock (variant_id, location_id, qty) VALUES (?, ?, ?)")
        .bind(vid, l, Math.max(0, parseInt(v.stock[l], 10) || 0))
    ));
  }
  return c.json({ ok: true, id, name, live: !!b.live });
});

// Add a variation to an existing product.
admin.post("/products/:id/variants", async (c) => {
  const b = await c.req.json();
  const pid = c.req.param("id");
  const s = optionLabel(b.option1 ?? b.size, b.option2, b.option3);
  const p = parseInt(b.price, 10) || 0;
  if (!s || !p) return c.json({ error: "A size and a price are required." }, 400);
  const db = c.env.DB;
  const dupe = await db.prepare("SELECT id FROM variants WHERE product_id=? AND lower(size)=lower(?)").bind(pid, s).first();
  if (dupe) return c.json({ error: "That size already exists on this product." }, 400);
  const next = await db.prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM variants WHERE product_id=?").bind(pid).first();
  const image = String(b.imageUrl || "").trim() || null;
  const vr = await db.prepare(
    "INSERT INTO variants (product_id, size, option1, option2, option3, price_ngn, sku, image_url, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    pid, s, String(b.option1 ?? b.size ?? s).trim(), String(b.option2 ?? "").trim() || null, String(b.option3 ?? "").trim() || null,
    p, await freeSku(db, String(b.sku || "").trim() || makeSku(pid, s)), image, next.n
  ).run();
  const vid = vr.meta.last_row_id;
  if (image) {
    await db.prepare("INSERT INTO product_images (product_id, variant_id, url, alt, sort) VALUES (?, ?, ?, ?, ?)")
      .bind(pid, vid, image, s, next.n).run();
  }
  await db.batch((await locationIds(db)).map((l) =>
    db.prepare("INSERT INTO stock (variant_id, location_id, qty) VALUES (?, ?, ?)")
      .bind(vid, l, Math.max(0, parseInt((b.stock || {})[l], 10) || 0))
  ));
  return c.json({ ok: true, id: vid });
});

admin.delete("/variants/:id", async (c) => {
  const vid = parseInt(c.req.param("id"), 10);
  const db = c.env.DB;
  const v = await db.prepare("SELECT product_id FROM variants WHERE id=?").bind(vid).first();
  if (!v) return c.json({ error: "No such size." }, 404);
  const count = await db.prepare("SELECT COUNT(*) AS n FROM variants WHERE product_id=?").bind(v.product_id).first();
  if (count.n <= 1) return c.json({ error: "A product needs at least one size — delete the product instead." }, 400);
  await db.batch([
    db.prepare("DELETE FROM product_images WHERE variant_id=?").bind(vid),
    db.prepare("DELETE FROM stock WHERE variant_id=?").bind(vid),
    db.prepare("DELETE FROM variants WHERE id=?").bind(vid),
  ]);
  return c.json({ ok: true });
});

// ---- Product gallery ----
// Images belong to the product; tagging one to a variation makes it the shot
// shown when that variation is selected. Untagged shots are shared by all.
//
// The listing photo and the gallery are two records of the same picture:
// creating a product writes its photo into `products.image_url` *and* into
// `product_images`, and the product page draws its hero from the gallery while
// every card draws it from the column. Change one without the other and the
// two disagree — the shop shows the new bottle and the product page still shows
// the one it replaced, which is the "the pictures have swapped" the house has
// been reporting. `syncGalleryPhoto` is what keeps the pair honest: it moves
// the *existing* row rather than adding a second one, so a gallery the house
// has curated by hand never quietly grows a ghost of every photo ever replaced.
export async function syncGalleryPhoto(db, productId, variantId, oldUrl, newUrl) {
  const from = String(oldUrl || "").trim();
  const to = String(newUrl || "").trim();
  if (from === to) return;
  const tagged = variantId ? "variant_id=?" : "variant_id IS NULL";
  const bindTag = variantId ? [variantId] : [];
  // Is the new picture already filed here? Then the old row is a duplicate to
  // retire, not a row to repoint.
  const already = to
    ? await db.prepare(`SELECT id FROM product_images WHERE product_id=? AND ${tagged} AND url=?`)
        .bind(productId, ...bindTag, to).first()
    : null;
  const stale = from
    ? await db.prepare(`SELECT id FROM product_images WHERE product_id=? AND ${tagged} AND url=? ORDER BY sort, id LIMIT 1`)
        .bind(productId, ...bindTag, from).first()
    : null;

  if (stale && already) {
    await db.prepare("DELETE FROM product_images WHERE id=?").bind(stale.id).run();
    return;
  }
  if (stale) {
    if (to) await db.prepare("UPDATE product_images SET url=? WHERE id=?").bind(to, stale.id).run();
    else await db.prepare("DELETE FROM product_images WHERE id=?").bind(stale.id).run();
    return;
  }
  if (to && !already) {
    // No row to move — the photo was set on a product whose gallery was built
    // by hand. Lead with it, since it is the one the listing is using.
    const first = await db.prepare("SELECT COALESCE(MIN(sort), 0) - 1 AS n FROM product_images WHERE product_id=?").bind(productId).first();
    const name = await db.prepare("SELECT name FROM products WHERE id=?").bind(productId).first();
    await db.prepare("INSERT INTO product_images (product_id, variant_id, url, alt, sort) VALUES (?, ?, ?, ?, ?)")
      .bind(productId, variantId || null, to, (name && name.name) || "", first ? first.n : 0).run();
  }
}

admin.get("/products/:id/images", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT * FROM product_images WHERE product_id=? ORDER BY sort, id").bind(c.req.param("id")).all()).results;
  return c.json({ images: rows.map((r) => ({ id: r.id, url: r.url, alt: r.alt, variantId: r.variant_id, sort: r.sort })) });
});

admin.post("/products/:id/images", async (c) => {
  const b = await c.req.json();
  const pid = c.req.param("id");
  const url = String(b.url || "").trim();
  if (!url) return c.json({ error: "An image URL is required." }, 400);
  const db = c.env.DB;
  const p = await db.prepare("SELECT name FROM products WHERE id=?").bind(pid).first();
  if (!p) return c.json({ error: "No such product." }, 404);
  const vid = b.variantId ? parseInt(b.variantId, 10) : null;
  if (vid) {
    const v = await db.prepare("SELECT id FROM variants WHERE id=? AND product_id=?").bind(vid, pid).first();
    if (!v) return c.json({ error: "That size doesn't belong to this product." }, 400);
  }
  const next = await db.prepare("SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM product_images WHERE product_id=?").bind(pid).first();
  const r = await db.prepare("INSERT INTO product_images (product_id, variant_id, url, alt, sort) VALUES (?, ?, ?, ?, ?)")
    .bind(pid, vid, url, String(b.alt || p.name), b.sort === undefined ? next.n : parseInt(b.sort, 10) || 0).run();
  // The first shot on a product with no photo becomes its listing image.
  await db.prepare("UPDATE products SET image_url=? WHERE id=? AND (image_url IS NULL OR image_url='')").bind(url, pid).run();
  // A shot tagged to a variation with no photo of its own becomes that one's.
  if (vid) await db.prepare("UPDATE variants SET image_url=? WHERE id=? AND (image_url IS NULL OR image_url='')").bind(url, vid).run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

admin.patch("/images/:id", async (c) => {
  const b = await c.req.json();
  const id = parseInt(c.req.param("id"), 10);
  const db = c.env.DB;
  const img = await db.prepare("SELECT * FROM product_images WHERE id=?").bind(id).first();
  if (!img) return c.json({ error: "No such image." }, 404);
  const sets = [], vals = [];
  if (b.variantId !== undefined) {
    const vid = b.variantId ? parseInt(b.variantId, 10) : null;
    if (vid) {
      const v = await db.prepare("SELECT id FROM variants WHERE id=? AND product_id=?").bind(vid, img.product_id).first();
      if (!v) return c.json({ error: "That size doesn't belong to this product." }, 400);
    }
    sets.push("variant_id=?"); vals.push(vid);
  }
  if (b.alt !== undefined) { sets.push("alt=?"); vals.push(String(b.alt || "")); }
  if (b.sort !== undefined) { sets.push("sort=?"); vals.push(parseInt(b.sort, 10) || 0); }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  await db.prepare(`UPDATE product_images SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  return c.json({ ok: true });
});

admin.delete("/images/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const db = c.env.DB;
  const img = await db.prepare("SELECT * FROM product_images WHERE id=?").bind(id).first();
  if (!img) return c.json({ error: "No such image." }, 404);
  await db.prepare("DELETE FROM product_images WHERE id=?").bind(id).run();
  // Drop the reference from anything still pointing at it, then re-point the
  // product at whatever shot is left so a listing never loses its picture.
  // Scoped to *this* product: two products can share an address (the same
  // upload reused, or an ERP feed handing the same URL to a pair of items), and
  // an unscoped blanking took the photo off the other one too.
  await db.prepare("UPDATE variants SET image_url=NULL WHERE image_url=? AND product_id=?").bind(img.url, img.product_id).run();
  const rest = await db.prepare("SELECT url FROM product_images WHERE product_id=? ORDER BY sort, id LIMIT 1").bind(img.product_id).first();
  await db.prepare("UPDATE products SET image_url=? WHERE id=? AND image_url=?").bind(rest ? rest.url : null, img.product_id, img.url).run();
  return c.json({ ok: true });
});

// Edit any product field (live toggle, name, category, family, gender, notes,
// description, image). Only the fields present in the body are changed.
admin.patch("/products/:id", async (c) => {
  const b = await c.req.json();
  const id = c.req.param("id");
  const db = c.env.DB;
  const map = { live: "live", name: "name", cat: "cat", brand: "brand", family: "family", gender: "gender", notes: "notes", desc: "descr", imageUrl: "image_url", splitListing: "split_listing", pinNew: "pin_new", pinBest: "pin_best" };
  const flags = ["live", "splitListing", "pinNew", "pinBest"];
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) { sets.push(`${col}=?`); vals.push(flags.includes(k) ? (b[k] ? 1 : 0) : b[k]); }
  }
  if (b.optionNames !== undefined) { sets.push("option_names=?"); vals.push(JSON.stringify(normaliseOptionNames(b.optionNames))); }
  if (!sets.length) return c.json({ ok: true });
  // Read the photo it is replacing before the write, so the gallery can follow.
  const before = b.imageUrl !== undefined
    ? await db.prepare("SELECT image_url FROM products WHERE id=?").bind(id).first()
    : null;
  vals.push(id);
  await db.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  if (b.imageUrl !== undefined) await syncGalleryPhoto(db, id, null, before && before.image_url, b.imageUrl);
  return c.json({ ok: true });
});

// Edit a variation. A variation is a product in its own right here — it carries
// its own price, SKU, photo, options, sort order and active flag.
admin.patch("/variants/:id", async (c) => {
  const b = await c.req.json();
  const vid = parseInt(c.req.param("id"), 10);
  const db = c.env.DB;
  const cur = await db.prepare("SELECT * FROM variants WHERE id=?").bind(vid).first();
  if (!cur) return c.json({ error: "No such size." }, 404);

  const sets = [], vals = [];
  const put = (col, val) => { sets.push(`${col}=?`); vals.push(val); };

  if (b.price !== undefined) {
    const p = parseInt(b.price, 10);
    if (!p || p < 0) return c.json({ error: "A valid price is required." }, 400);
    put("price_ngn", p);
  }
  if (b.compareAtNgn !== undefined) put("compare_at_ngn", parseInt(b.compareAtNgn, 10) || null);

  // Renaming an option relabels the variation. Carts and order lines address it
  // by id, so this no longer orphans anything.
  if (b.option1 !== undefined || b.option2 !== undefined || b.option3 !== undefined || b.size !== undefined) {
    const o1 = String(b.option1 ?? b.size ?? cur.option1 ?? cur.size ?? "").trim();
    const o2 = b.option2 === undefined ? cur.option2 : String(b.option2 || "").trim() || null;
    const o3 = b.option3 === undefined ? cur.option3 : String(b.option3 || "").trim() || null;
    const label = optionLabel(o1, o2, o3);
    if (!label) return c.json({ error: "Every size needs a label (e.g. 30ml)." }, 400);
    const dupe = await db.prepare("SELECT id FROM variants WHERE product_id=? AND lower(size)=lower(?) AND id IS NOT ?")
      .bind(cur.product_id, label, vid).first();
    if (dupe) return c.json({ error: "That size already exists on this product." }, 400);
    put("size", label); put("option1", o1); put("option2", o2); put("option3", o3);
  }
  if (b.sku !== undefined) put("sku", await freeSku(db, String(b.sku || "").trim() || makeSku(cur.product_id, cur.size), vid));
  if (b.imageUrl !== undefined) put("image_url", String(b.imageUrl || "").trim() || null);
  // Same pairing as the product's own photo: the shot tagged to this variation
  // in the gallery is the one the product page draws, so it moves with it.
  const photoMoved = b.imageUrl !== undefined;
  if (b.sort !== undefined) put("sort", parseInt(b.sort, 10) || 0);
  if (b.active !== undefined) put("active", b.active ? 1 : 0);
  // The line for this one piece. Empty means "whatever the store's is".
  if (b.lowStockAt !== undefined) {
    const n = parseInt(b.lowStockAt, 10);
    put("low_stock_at", b.lowStockAt === "" || b.lowStockAt === null || !Number.isFinite(n) || n < 0 ? null : n);
  }

  if (!sets.length) return c.json({ ok: true });
  vals.push(vid);
  await db.prepare(`UPDATE variants SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  if (photoMoved) await syncGalleryPhoto(db, cur.product_id, vid, cur.image_url, b.imageUrl);
  return c.json({ ok: true });
});

admin.delete("/products/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;
  const vs = (await db.prepare("SELECT id FROM variants WHERE product_id=?").bind(id).all()).results;
  const stmts = vs.map((v) => db.prepare("DELETE FROM stock WHERE variant_id=?").bind(v.id));
  stmts.push(db.prepare("DELETE FROM product_images WHERE product_id=?").bind(id));
  stmts.push(db.prepare("DELETE FROM variants WHERE product_id=?").bind(id));
  stmts.push(db.prepare("DELETE FROM wishlists WHERE product_id=?").bind(id));
  stmts.push(db.prepare("DELETE FROM products WHERE id=?").bind(id));
  await db.batch(stmts);
  return c.json({ ok: true });
});

// Where the low-stock line sits for every shelf in the shop, so the inventory
// screen colours a cell by the *same* rule the alert fires on — including a
// per-variation override and, in days-of-cover mode, a line that differs per
// store because the selling does.
admin.get("/stock/health", async (c) => {
  const db = c.env.DB;
  const settings = await getSettings(db);
  const scope = scopeFilter(effectiveScope(c, c.req.query("scope")));
  const health = await stockHealth(db, settings, scope);
  const thresholds = {};
  for (const s of health.states) thresholds[`${s.variantId}:${s.locationId}`] = s.threshold;
  return c.json({ cfg: health.cfg, thresholds, counts: { low: health.low.length, out: health.out.length } });
});

// Run the sweep by hand. Alerts ride the cron every fifteen minutes; this is for
// the moment after someone changes the threshold and wants to know what it
// caught, rather than waiting a quarter of an hour to find out.
admin.post("/stock/sweep", async (c) => c.json(await sweepStock(c.env)));

admin.patch("/stock", async (c) => {
  const { productId, variantId, size, location, delta } = await c.req.json();
  const db = c.env.DB;
  // Address the variation by id where the caller has one; the product+size
  // lookup stays for older admin builds.
  const v = variantId
    ? await db.prepare("SELECT id FROM variants WHERE id=?").bind(parseInt(variantId, 10)).first()
    : await db.prepare("SELECT id FROM variants WHERE product_id=? AND size=?").bind(productId, size).first();
  if (!v || !(await locationIds(db)).includes(location)) return c.json({ error: "Unknown variant." }, 400);
  const before = await db.prepare("SELECT qty FROM stock WHERE variant_id=? AND location_id=?").bind(v.id, location).first();
  await db.prepare(
    `INSERT INTO stock (variant_id, location_id, qty) VALUES (?, ?, MAX(0, ?))
     ON CONFLICT(variant_id, location_id) DO UPDATE SET qty = MAX(0, qty + ?)`
  ).bind(v.id, location, delta, delta).run();
  const row = await db.prepare("SELECT qty FROM stock WHERE variant_id=? AND location_id=?").bind(v.id, location).first();
  // Restock crossing 0 → in stock triggers the back-in-stock automation.
  if ((before ? before.qty : 0) === 0 && row.qty > 0) {
    const p = await db.prepare("SELECT name FROM products WHERE id=?").bind(productId).first();
    await emitEvent(c.env, "product_restocked", { entity: productId, payload: { productId, size, productName: p ? p.name : productId, city: location }, ctx: c.executionCtx });
  }
  return c.json({ ok: true, qty: row.qty });
});

admin.get("/promos", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT * FROM promos ORDER BY created_at DESC").all()).results;
  const today = todayInWAT();
  return c.json({
    promos: rows.map((p) => ({
      code: p.code, kind: p.kind, value: p.value, desc: p.descr, scope: p.scope,
      starts: p.starts, ends: p.ends, status: p.status, redemptions: p.redemptions,
      startsAt: p.starts_at || "", endsAt: p.ends_at || "",
      // What the *server* thinks right now, so the list can't claim a code is
      // running when checkout would refuse it.
      live: promoIsLive(p, today),
      expired: !!(p.ends_at && today > p.ends_at),
      scheduled: !!(p.starts_at && today < p.starts_at),
      // A promo created before dates were enforced may carry free text like
      // "Aug 9" that nothing can act on. Flag it so it can be re-entered
      // rather than quietly running forever.
      unenforceable: !p.ends_at && !!p.ends && !/^until ended$/i.test(String(p.ends).trim()),
    })),
  });
});

// Dates arrive as ISO from the admin's date pickers. Anything else is kept as
// display text only and left unenforced — guessing at "early August" would be
// worse than admitting the code runs until someone ends it.
const isoDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim()) ? String(s).trim() : null);

admin.post("/promos", async (c) => {
  const { code, kind, value, scope, starts, ends } = await c.req.json();
  const cleanCode = String(code || "").toUpperCase().replace(/\s/g, "");
  const v = parseInt(value, 10) || 0;
  if (!cleanCode || (!v && kind !== "ship")) return c.json({ error: "A code and a value make a sale." }, 400);
  const startsAt = isoDate(starts);
  const endsAt = isoDate(ends);
  if (startsAt && endsAt && endsAt < startsAt) return c.json({ error: "That sale would end before it starts." }, 400);
  const descr = kind === "pct" ? `${v}% off` : kind === "amt" ? `₦${v.toLocaleString("en-US")} off` : "Free delivery";
  // The display columns keep carrying human text for the admin table; the
  // *_at columns are what the storefront enforces.
  await c.env.DB.prepare(
    `INSERT INTO promos (code, kind, value, descr, scope, starts, ends, starts_at, ends_at, status, redemptions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 0)
     ON CONFLICT(code) DO UPDATE SET kind=excluded.kind, value=excluded.value, descr=excluded.descr, scope=excluded.scope,
       starts=excluded.starts, ends=excluded.ends, starts_at=excluded.starts_at, ends_at=excluded.ends_at, status='Active'`
  ).bind(cleanCode, kind || "pct", v, descr, scope || "Storewide", startsAt || starts || "Today", endsAt || ends || "Until ended", startsAt, endsAt).run();
  return c.json({ ok: true });
});

admin.post("/promos/:code/end", async (c) => {
  await c.env.DB.prepare("UPDATE promos SET status='Ended' WHERE code=?").bind(c.req.param("code")).run();
  return c.json({ ok: true });
});

// ---- Reward codes ----
//
// The admin side of `worker/rewards.js`. A promo is a sale; a reward is a
// single-use code belonging to one person — issued automatically when an order
// is paid for, or minted here for a giveaway, an apology or an influencer.

admin.get("/rewards", async (c) => {
  const db = c.env.DB;
  const q = c.req.query();
  const where = [];
  const binds = [];
  // "Active" here means what a shopper would find: not spent, not voided, and
  // not past its date. The status column alone would call an expired code
  // active, which is exactly the confusion this screen exists to avoid.
  if (q.status === "active") { where.push("status='Active' AND (expires_at IS NULL OR expires_at >= ?)"); binds.push(todayInWAT()); }
  else if (q.status === "redeemed") where.push("status='Redeemed'");
  else if (q.status === "void") where.push("status='Void'");
  else if (q.status === "expired") { where.push("status='Active' AND expires_at IS NOT NULL AND expires_at < ?"); binds.push(todayInWAT()); }
  if (q.source) { where.push("source=?"); binds.push(String(q.source)); }
  if (q.owner) { where.push("(owner_key LIKE ? OR owner_email LIKE ? OR owner_name LIKE ?)"); const like = `%${String(q.owner).toLowerCase().trim()}%`; binds.push(like, like, like); }
  if (q.code) { where.push("code LIKE ?"); binds.push(`%${cleanCode(q.code)}%`); }
  const limit = Math.min(500, Math.max(1, parseInt(q.limit || "100", 10) || 100));
  const sql = `SELECT * FROM reward_codes ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY issued_at DESC, rowid DESC LIMIT ${limit}`;
  const rows = (await db.prepare(sql).bind(...binds).all()).results;
  const today = todayInWAT();

  const totals = await db.prepare(
    `SELECT
       COUNT(*) AS issued,
       SUM(CASE WHEN status='Active' AND (expires_at IS NULL OR expires_at >= ?) THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN status='Redeemed' THEN 1 ELSE 0 END) AS redeemed,
       SUM(CASE WHEN status='Active' AND expires_at IS NOT NULL AND expires_at < ? THEN 1 ELSE 0 END) AS expired
     FROM reward_codes`
  ).bind(today, today).first();

  // What the rewards have actually cost, which is the number that decides
  // whether the earning rule is set too generously.
  const spend = await db.prepare(
    "SELECT COALESCE(SUM(o.discount), 0) AS n FROM orders o WHERE o.reward_code IS NOT NULL AND o.pay_status='paid'"
  ).first();

  const settings = await getSettings(c.env.DB);
  return c.json({
    rewards: rows.map((r) => rewardOut(r, today)),
    totals: {
      issued: totals.issued || 0, active: totals.active || 0,
      redeemed: totals.redeemed || 0, expired: totals.expired || 0,
      discountGiven: spend.n || 0,
    },
    rule: {
      on: !!settings.rewardsOn,
      kind: settings.rewardEarnKind || "pct",
      value: settings.rewardEarnValue ?? 10,
      minSpend: settings.rewardEarnMinSpend ?? 0,
      scope: settings.rewardEarnScope || "Storewide",
      expiryDays: settings.rewardEarnExpiryDays ?? 90,
      prefix: settings.rewardCodePrefix || "MR",
    },
  });
});

// Mint one code, or a batch of them for a campaign.
//
// `count` exists because a giveaway needs fifty codes that are not fifty
// separate decisions; it is capped so a typo in the box cannot fill the table.
admin.post("/rewards", requireSuper, async (c) => {
  const db = c.env.DB;
  const b = await c.req.json();
  const kind = ["pct", "amt", "ship", "item"].includes(b.kind) ? b.kind : "pct";
  const value = parseInt(b.value, 10) || 0;
  if ((kind === "pct" || kind === "amt") && value <= 0)
    return c.json({ error: "A percentage or amount reward needs a value above zero." }, 400);
  if (kind === "pct" && value > 100) return c.json({ error: "A percentage can't be more than 100." }, 400);

  // A free-product reward may name a size or leave it open ("the cheapest
  // thing in scope"). What it may not do is name a size that isn't for sale.
  let freeVariantId = null;
  if (kind === "item" && b.freeVariantId) {
    freeVariantId = parseInt(b.freeVariantId, 10) || null;
    const v = freeVariantId && (await db.prepare("SELECT id FROM variants WHERE id=?").bind(freeVariantId).first());
    if (!v) return c.json({ error: "That product size no longer exists." }, 400);
  }

  const count = Math.min(200, Math.max(1, parseInt(b.count, 10) || 1));
  // One named code is one code by definition — a batch of fifty all called
  // THANKYOU would collide on the primary key at the second row.
  if (b.code && count > 1) return c.json({ error: "Naming the code means issuing exactly one." }, 400);

  const who = c.get("admin");
  const issuedBy = who.name || who.username || `admin #${who.uid}`;
  const settings = await getSettings(db);
  const expiresAt = b.expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(b.expiresAt)
    ? b.expiresAt
    : expiryFromNow(b.expiryDays ?? settings.rewardEarnExpiryDays ?? 90);

  const base = {
    kind, value, freeVariantId, scope: b.scope || "Storewide", minSpend: parseInt(b.minSpend, 10) || 0,
    ownerContact: (b.ownerContact || "").trim(), ownerEmail: (b.ownerEmail || b.ownerContact || "").trim(),
    ownerName: (b.ownerName || "").trim(), source: "manual", earnedOrderNo: b.orderNo || null,
    issuedBy, expiresAt, note: (b.note || "").trim(), prefix: b.prefix || settings.rewardCodePrefix || "MR",
  };

  const issued = [];
  try {
    for (let i = 0; i < count; i++) {
      issued.push(await issueReward(db, { ...base, code: b.code ? cleanCode(b.code) : null }));
    }
  } catch (e) {
    // A named code that is already taken is the common case, and a shrug of a
    // 500 would leave the admin guessing at why nothing appeared.
    if (issued.length) return c.json({ ok: true, issued, warning: `Stopped after ${issued.length} — ${String(e.message || e)}` });
    return c.json({ error: String(e.message || e).includes("UNIQUE") ? "That code is already in use." : "Could not issue the reward." }, 400);
  }
  return c.json({ ok: true, issued });
});

// Withdraw a code that hasn't been spent. A redeemed one is history and stays
// as it is — rewriting it would make the order that used it unexplainable.
admin.post("/rewards/:code/void", requireSuper, async (c) => {
  const code = cleanCode(c.req.param("code"));
  const r = await c.env.DB
    .prepare("UPDATE reward_codes SET status='Void' WHERE code=? AND status='Active'")
    .bind(code)
    .run();
  if (!r.meta.changes) {
    const existing = await getReward(c.env.DB, code);
    if (!existing) return c.json({ error: "No such reward code." }, 404);
    return c.json({ error: existing.status === "Redeemed" ? "That reward has already been used." : "That reward is already void." }, 400);
  }
  return c.json({ ok: true });
});

// Put a voided code back into circulation — the undo for the button above.
admin.post("/rewards/:code/restore", requireSuper, async (c) => {
  const r = await c.env.DB
    .prepare("UPDATE reward_codes SET status='Active' WHERE code=? AND status='Void'")
    .bind(cleanCode(c.req.param("code")))
    .run();
  if (!r.meta.changes) return c.json({ error: "Only a voided reward can be restored." }, 400);
  return c.json({ ok: true });
});

// The sizes a free-product reward can name, for the picker on the form.
admin.get("/rewards/variants", async (c) => {
  const rows = (await c.env.DB.prepare(
    `SELECT v.id, v.size, v.price_ngn, p.name, p.cat
       FROM variants v JOIN products p ON p.id = v.product_id
      WHERE p.live = 1 AND v.active = 1
      ORDER BY p.name, v.sort, v.id`
  ).all()).results;
  return c.json({ variants: rows.map((v) => ({ id: v.id, label: `${v.name} — ${v.size}`, ngn: v.price_ngn, cat: v.cat })) });
});

admin.get("/campaigns", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT * FROM campaigns ORDER BY created_at DESC").all()).results;
  return c.json({ campaigns: rows.map((x) => ({ id: x.id, name: x.name, type: x.kind, audience: x.audience, status: x.status, stat: x.stat })) });
});

admin.post("/campaigns", async (c) => {
  const { kind, title, message, cta, audience } = await c.req.json();
  const db = c.env.DB;
  const name = (title || "Untitled campaign").trim() || "Untitled campaign";
  const status = kind === "Email" ? "Sent just now" : kind === "Push" ? "Scheduled" : "Live";
  // Only one live popup/banner at a time — new ones supersede.
  if (kind === "Popup" || kind === "Banner") {
    await db.prepare("UPDATE campaigns SET status='Ended' WHERE kind=? AND status='Live'").bind(kind).run();
  }
  await db.prepare(
    "INSERT INTO campaigns (name, kind, audience, status, stat, title, message, cta) VALUES (?, ?, ?, ?, '—', ?, ?, ?)"
  ).bind(name, kind, audience || "All visitors", status, title || "", message || "", cta || "").run();
  // Banners go live by rewriting the storefront announcement bar.
  if (kind === "Banner") {
    await putSettings(db, { announcement: [title, message].filter(Boolean).join(" — ") });
  }
  return c.json({ ok: true });
});

// The inbox shows live conversations by default; ?archived=1 shows the archive.
// Both counts come back either way so the UI can label the toggle.
admin.get("/inquiries", async (c) => {
  const db = c.env.DB;
  const archived = c.req.query("archived") === "1";
  const inqs = (await db.prepare("SELECT * FROM inquiries WHERE archived=? ORDER BY created_at DESC").bind(archived ? 1 : 0).all()).results;
  const msgs = (await db.prepare("SELECT * FROM inquiry_messages ORDER BY created_at, id").all()).results;
  const counts = await db.prepare("SELECT SUM(archived=0) AS live, SUM(archived=1) AS archived FROM inquiries").first();
  return c.json({
    archived,
    counts: { live: counts.live || 0, archived: counts.archived || 0 },
    inquiries: inqs.map((q) => ({
      id: q.id, name: q.name, contact: q.contact, channel: q.channel, subject: q.subject, city: q.city,
      status: q.status, time: relTime(q.created_at), archived: !!q.archived,
      thread: msgs.filter((m) => m.inquiry_id === q.id).map((m) => ({ from: m.from_us ? "us" : "them", text: m.text })),
    })),
  });
});

// Archiving clears a thread out of the working inbox without destroying the
// customer's record — so it is reversible, and reserved for the master account.
admin.post("/inquiries/:id/archive", requireSuper, async (c) => {
  const { archived } = await c.req.json().catch(() => ({}));
  const id = parseInt(c.req.param("id"), 10);
  const q = await c.env.DB.prepare("SELECT id FROM inquiries WHERE id=?").bind(id).first();
  if (!q) return c.json({ error: "No such conversation." }, 404);
  await c.env.DB.prepare("UPDATE inquiries SET archived=? WHERE id=?").bind(archived === false ? 0 : 1, id).run();
  return c.json({ ok: true, archived: archived !== false });
});

admin.post("/inquiries/:id/reply", async (c) => {
  const { text } = await c.req.json();
  if (!text || !String(text).trim()) return c.json({ error: "Write something first." }, 400);
  const id = parseInt(c.req.param("id"), 10);
  const db = c.env.DB;
  await db.prepare("INSERT INTO inquiry_messages (inquiry_id, from_us, text) VALUES (?, 1, ?)").bind(id, String(text).trim()).run();
  await db.prepare("UPDATE inquiries SET status='Pending' WHERE id=? AND status='Open'").bind(id).run();
  return c.json({ ok: true });
});

admin.post("/inquiries/:id/status", async (c) => {
  const { status } = await c.req.json();
  if (!["Open", "Pending", "Resolved"].includes(status)) return c.json({ error: "Bad status." }, 400);
  await c.env.DB.prepare("UPDATE inquiries SET status=? WHERE id=?").bind(status, parseInt(c.req.param("id"), 10)).run();
  return c.json({ ok: true });
});

const ORDER_STATUSES = ["Processing", "Packed", "In transit", "Ready for pickup", "Delivered", "Collected", "Cancelled"];

admin.patch("/orders/:no", async (c) => {
  const { status } = await c.req.json();
  if (!ORDER_STATUSES.includes(status)) return c.json({ error: "Bad status." }, 400);
  const no = c.req.param("no");
  const db = c.env.DB;
  await db.prepare("UPDATE orders SET status=? WHERE no=?").bind(status, no).run();
  await db.prepare("UPDATE order_events SET current=0 WHERE order_no=?").bind(no).run();
  const existing = await db.prepare("SELECT id FROM order_events WHERE order_no=? AND step=?").bind(no, status).first();
  if (existing) {
    await db.prepare("UPDATE order_events SET done=1, current=1, at=? WHERE id=?").bind(displayTime(), existing.id).run();
  } else {
    const last = await db.prepare("SELECT COALESCE(MAX(sort),0) AS s FROM order_events WHERE order_no=?").bind(no).first();
    await db.prepare("INSERT INTO order_events (order_no, step, detail, at, done, current, sort) VALUES (?, ?, '', ?, 1, 1, ?)")
      .bind(no, status, displayTime(), last.s + 1).run();
  }
  const o = await db.prepare("SELECT customer, email, phone FROM orders WHERE no=?").bind(no).first();
  await emitEvent(c.env, "order_status_changed", { entity: no, payload: { orderNo: no, status, name: o ? o.customer : "", email: o ? o.email : "", phone: o ? o.phone : "", contact: o ? (o.email || o.phone) : "" }, ctx: c.executionCtx });
  return c.json({ ok: true });
});

// An order counts against a store if the store fulfilled it or sent one of its
// parcels — either way, deleting the store would orphan that record.
const ORDERS_TOUCHING_STORE =
  `SELECT COUNT(*) AS n FROM orders WHERE fulfilled_from = ?
   OR no IN (SELECT order_no FROM order_shipments WHERE location_id = ?)`;

const locationOut = (l) => ({
  id: l.id, city: l.city, store: l.store, address: l.address, eta: l.eta, phone: l.phone,
  hours: l.hours || "", mapsUrl: l.maps_url || "",
  shipNGN: l.ship_ngn, shipUSD: l.ship_usd, sort: l.sort, active: !!l.active,
});

admin.get("/settings", async (c) => {
  const db = c.env.DB;
  const settings = await getSettings(db);
  const locations = (await allLocations(db)).map(locationOut);
  return c.json({ settings, locations });
});

admin.put("/settings", async (c) => {
  const { settings, locations } = await c.req.json();
  const db = c.env.DB;
  const allowed = [
    "announcement", "heroHeadline", "heroSub", "heroEyebrow", "heroImage", "footerTagline", "igUrl", "igHandle", "tiktokUrl", "facebookUrl",
    "contactPhone", "contactEmail", "contactHours", "ngnPerUsd",
    // Inventory: where the low-stock line sits, how it is drawn, whether it
    // leaves the building, and whether shoppers see it too.
    "lowStockThreshold", "lowStockMode", "lowStockCoverDays", "lowStockVelocityDays",
    "lowStockAlerts", "lowStockOnStorefront",
    // The behavioural stream: whether it runs, how long a raw event is kept,
    // and how long a cart sits before it counts as abandoned.
    "insightsOn", "insightsRetainDays", "abandonAfterMins",
    // Smart shopping: the leave-behind nudge, who the first-order pop-up is
    // for, and the two rails read off the stream.
    "nudgeOn", "nudgeTitle", "nudgeBody", "nudgeCta", "nudgeCode", "nudgeEveryDays",
    "promoPopupWhen", "recentlyViewedOn", "alsoViewedOn",
    // SEO
    "siteName", "siteUrl", "metaDescription", "ogImage",
    // Marketing & analytics tags
    "ga4Id", "metaPixelId", "tiktokPixelId", "googleAdsId", "googleAdsPurchaseLabel", "clarityId", "gscVerification",
    // The house's mark: the logo in the header, and a light version for the
    // near-black footer.
    "logoUrl", "logoLightUrl",
    // The founder's portrait, on the home page's story band and the About page.
    "founderImage",
    // The About page: its heading, what the house says about itself, the
    // founder's story (which the home page's story band reads too), whether the
    // stores grid shows, the band at the foot, and the page's own search
    // result. Empty means "use the copy the store shipped with" — see
    // `src/lib/about.js`.
    "aboutEyebrow", "aboutHeadline", "aboutIntro", "storyTitle", "storyBody",
    "founderName", "founderRole", "aboutStoresOn",
    "aboutCtaTitle", "aboutCtaSub", "aboutCtaLabel", "aboutSeoTitle", "aboutSeoDesc",
    // Storefront look & behaviour
    "heroDirection", "promoPopup", "defaultCity", "crossCityShipNGN", "crossCityEta", "freeShipAbujaOver", "freeShipCity",
    // Where a bank-transfer shopper is told to send the money. Empty until the
    // house fills it in, and the transfer option says so rather than inventing
    // an account number.
    "bankDetails",
    // Merchandising: how long a product reads as new, how far back the best
    // seller count looks, and whether the storefront shows live purchases.
    "newArrivalDays", "bestSellerDays", "purchasePopups", "purchasePopupDays", "purchasePopupIntervalMs",
    // The daily-deal card: whether it shows at all, whether it falls back to the
    // deepest markdown when nothing is scheduled, and what it is called.
    "dailyDealOn", "dailyDealAuto", "dailyDealHeadline",
    // The tiles under the hero were three fixed settings keys, one photograph
    // each. They are rows in home_blocks now (migration 0019 carried the
    // photographs across), so there is nothing here to keep.
    // Editorial
    "blogEnabled", "blogHeadline", "blogIntro", "reviewsHeadline", "reviewsIntro",
    // The Perfume Studio's consultation page: whether the studio is taking
    // bookings at all, the Calendly link the calendar is framed from, and the
    // words on the page. Empty copy means "use what the store shipped with" —
    // see `src/lib/consultation.js`. The Calendly link is a *link*, not a
    // credential: it is the public booking page, so it lives here rather than
    // in a Worker secret.
    "consultOn", "consultCalendlyUrl", "consultEyebrow", "consultHeadline", "consultIntro",
    "consultBody", "consultCtaLabel", "consultImage", "consultSeoTitle", "consultSeoDesc",
    // Rewards: whether a paid order earns a code, and what that code is worth.
    "rewardsOn", "rewardEarnKind", "rewardEarnValue", "rewardEarnMinSpend", "rewardEarnScope",
    "rewardEarnExpiryDays", "rewardCodePrefix",
  ];
  const patch = {};
  for (const k of allowed) if (settings && settings[k] !== undefined) patch[k] = settings[k];
  const next = await putSettings(db, patch);
  if (Array.isArray(locations)) {
    const known = (await allLocations(db)).map((l) => l.id);
    await db.batch(locations
      .filter((l) => known.includes(l.id))
      .map((l) => db.prepare("UPDATE locations SET store=?, address=?, eta=?, phone=?, hours=?, maps_url=? WHERE id=?")
        .bind(l.store, l.address, l.eta, l.phone, String(l.hours || "").trim(), String(l.mapsUrl || "").trim(), l.id)));
  }
  return c.json({ ok: true, settings: next });
});

// ---- Stores (super only) ----
// A store is a place with stock, a delivery rate and staff attached, so opening
// or closing one touches inventory and routing — hence super-admin only.
admin.get("/locations", async (c) => {
  const rows = await allLocations(c.env.DB);
  const db = c.env.DB;
  const out = [];
  for (const l of rows) {
    const orders = await db.prepare(ORDERS_TOUCHING_STORE).bind(l.id, l.id).first();
    const units = await db.prepare("SELECT COALESCE(SUM(qty),0) AS n FROM stock WHERE location_id=?").bind(l.id).first();
    const staff = await db.prepare("SELECT COUNT(*) AS n FROM admin_users WHERE scope=? AND active=1").bind(l.id).first();
    out.push({ ...locationOut(l), orders: orders.n, units: units.n, staff: staff.n });
  }
  return c.json({ locations: out });
});

admin.post("/locations", requireSuper, async (c) => {
  const b = await c.req.json();
  const db = c.env.DB;
  const city = String(b.city || "").trim();
  const store = String(b.store || "").trim();
  if (!city || !store) return c.json({ error: "A city and a store name are required." }, 400);
  const id = String(b.id || city).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!id) return c.json({ error: "That city name doesn't make a usable id." }, 400);
  if (await db.prepare("SELECT id FROM locations WHERE id=?").bind(id).first())
    return c.json({ error: `There is already a store with the id "${id}".` }, 400);
  const last = await db.prepare("SELECT COALESCE(MAX(sort),0) AS s FROM locations").first();
  await db.prepare(
    "INSERT INTO locations (id, city, store, address, ship_ngn, ship_usd, eta, phone, hours, maps_url, sort, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)"
  ).bind(
    id, city, store, String(b.address || "").trim(),
    Math.max(0, parseInt(b.shipNGN, 10) || 0), Math.max(0, parseInt(b.shipUSD, 10) || 0),
    String(b.eta || "1–2 days").trim(), String(b.phone || "").trim(),
    String(b.hours || "").trim(), String(b.mapsUrl || "").trim(),
    Number.isFinite(parseInt(b.sort, 10)) ? parseInt(b.sort, 10) : last.s + 1
  ).run();
  // Every existing size gets a stock row at the new store, so it appears in
  // inventory immediately (at zero) instead of only once someone restocks it.
  const variants = (await db.prepare("SELECT id FROM variants").all()).results;
  if (variants.length) {
    await db.batch(variants.map((v) =>
      db.prepare("INSERT INTO stock (variant_id, location_id, qty) VALUES (?, ?, 0) ON CONFLICT(variant_id, location_id) DO NOTHING").bind(v.id, id)
    ));
  }
  return c.json({ ok: true, id });
});

admin.patch("/locations/:id", requireSuper, async (c) => {
  const b = await c.req.json();
  const id = c.req.param("id");
  const db = c.env.DB;
  const l = await db.prepare("SELECT id FROM locations WHERE id=?").bind(id).first();
  if (!l) return c.json({ error: "No such store." }, 404);
  const map = { city: "city", store: "store", address: "address", eta: "eta", phone: "phone", hours: "hours", mapsUrl: "maps_url", sort: "sort", shipNGN: "ship_ngn", shipUSD: "ship_usd", active: "active" };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (b[k] === undefined) continue;
    sets.push(`${col}=?`);
    vals.push(["sort", "ship_ngn", "ship_usd"].includes(col) ? Math.max(0, parseInt(b[k], 10) || 0) : col === "active" ? (b[k] ? 1 : 0) : String(b[k]).trim());
  }
  if (!sets.length) return c.json({ ok: true });
  // Never close the last door: the storefront needs somewhere to ship from.
  if (b.active === false) {
    const others = await db.prepare("SELECT COUNT(*) AS n FROM locations WHERE active=1 AND id<>?").bind(id).first();
    if (!others.n) return c.json({ error: "This is the only open store — add another before closing this one." }, 400);
  }
  vals.push(id);
  await db.prepare(`UPDATE locations SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  return c.json({ ok: true });
});

// Removing a store that has shipped orders would orphan that history, so it is
// closed instead: hidden from the storefront and from routing, still readable
// on the orders it fulfilled. A store that never shipped anything is deleted
// outright, along with its (zero-value) stock rows.
admin.delete("/locations/:id", requireSuper, async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;
  const l = await db.prepare("SELECT * FROM locations WHERE id=?").bind(id).first();
  if (!l) return c.json({ error: "No such store." }, 404);
  const others = await db.prepare("SELECT COUNT(*) AS n FROM locations WHERE active=1 AND id<>?").bind(id).first();
  if (!others.n) return c.json({ error: "This is the only open store — add another before removing this one." }, 400);

  const orders = await db.prepare(ORDERS_TOUCHING_STORE).bind(id, id).first();
  if (orders.n) {
    await db.prepare("UPDATE locations SET active=0 WHERE id=?").bind(id).run();
    return c.json({
      ok: true, closed: true, orders: orders.n,
      message: `${l.store} has shipped ${orders.n} order${orders.n === 1 ? "" : "s"} (whole or in part), so it is closed rather than deleted — that history stays intact.`,
    });
  }
  await db.batch([
    db.prepare("DELETE FROM stock WHERE location_id=?").bind(id),
    db.prepare("UPDATE admin_users SET active=0 WHERE scope=?").bind(id),
    db.prepare("DELETE FROM locations WHERE id=?").bind(id),
  ]);
  return c.json({ ok: true, deleted: true });
});

// ---- Collections (curated sets shown above the catalogue) ----
admin.get("/collections", async (c) => {
  const db = c.env.DB;
  const rows = (await db.prepare("SELECT * FROM collections ORDER BY sort, created_at").all()).results;
  const items = (await db.prepare("SELECT * FROM collection_products ORDER BY sort").all()).results;
  return c.json({
    collections: rows.map((x) => ({
      id: x.id, title: x.title, desc: x.descr, sort: x.sort, live: !!x.live,
      productIds: items.filter((i) => i.collection_id === x.id).map((i) => i.product_id),
    })),
  });
});

admin.post("/collections", async (c) => {
  const b = await c.req.json();
  const db = c.env.DB;
  const title = String(b.title || "").trim();
  if (!title) return c.json({ error: "Give the collection a title." }, 400);
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "collection";
  const exists = await db.prepare("SELECT id FROM collections WHERE id=?").bind(base).first();
  const id = exists ? `${base}-${Date.now().toString(36)}` : base;
  const last = await db.prepare("SELECT COALESCE(MAX(sort),0) AS s FROM collections").first();
  await db.prepare("INSERT INTO collections (id, title, descr, sort, live) VALUES (?, ?, ?, ?, ?)")
    .bind(id, title, String(b.desc || "").trim(), last.s + 1, b.live === false ? 0 : 1).run();
  await setCollectionProducts(db, id, b.productIds);
  return c.json({ ok: true, id });
});

admin.patch("/collections/:id", async (c) => {
  const b = await c.req.json();
  const id = c.req.param("id");
  const db = c.env.DB;
  if (!(await db.prepare("SELECT id FROM collections WHERE id=?").bind(id).first())) return c.json({ error: "No such collection." }, 404);
  const map = { title: "title", desc: "descr", sort: "sort", live: "live" };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (b[k] === undefined) continue;
    sets.push(`${col}=?`);
    vals.push(col === "live" ? (b[k] ? 1 : 0) : col === "sort" ? parseInt(b[k], 10) || 0 : String(b[k]).trim());
  }
  if (sets.length) {
    vals.push(id);
    await db.prepare(`UPDATE collections SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  }
  if (Array.isArray(b.productIds)) await setCollectionProducts(db, id, b.productIds);
  return c.json({ ok: true });
});

admin.delete("/collections/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM collection_products WHERE collection_id=?").bind(id),
    c.env.DB.prepare("DELETE FROM collections WHERE id=?").bind(id),
  ]);
  return c.json({ ok: true });
});

// Membership is replaced wholesale — the admin sends the list it wants.
async function setCollectionProducts(db, id, productIds) {
  if (!Array.isArray(productIds)) return;
  const known = (await db.prepare("SELECT id FROM products").all()).results.map((p) => p.id);
  const wanted = productIds.filter((p) => known.includes(p));
  const stmts = [db.prepare("DELETE FROM collection_products WHERE collection_id=?").bind(id)];
  wanted.forEach((pid, i) => {
    stmts.push(db.prepare("INSERT INTO collection_products (collection_id, product_id, sort) VALUES (?, ?, ?)").bind(id, pid, i));
  });
  await db.batch(stmts);
}

// ---- Categories (the house's own shelves) ----
//
// Categories used to be seeded and then frozen: a product could be filed under
// one, but nobody could add, rename, describe or retire one without a
// migration. They are content now, so the team owns them — including which of
// the default sub-shelves (new arrivals, best sellers, gift sets) each one
// offers shoppers.

const CAT_GROUPS = ["", "fragrance", "gift", "care"];

const categoryOut = (x, counts) => ({
  id: x.id, label: x.label, desc: x.descr || "", sort: x.sort, live: !!x.live,
  grp: x.grp || "", imageUrl: x.image_url || null,
  parentId: x.parent_id || null,
  // Filed directly on this category. A parent's shelf also shows everything
  // under it; the page adds those up from the tree rather than the server
  // guessing which total the reader wanted.
  products: counts[x.id] || 0,
});

// A category may not be its own ancestor, and the tree is two deep: a category
// that has children cannot also become someone's child. Both rules are enforced
// here rather than trusted from the form, because a cycle would hang every page
// that walks the tree.
async function parentRefusal(db, id, parentId) {
  if (!parentId) return null;
  if (parentId === id) return "A category can't sit inside itself.";
  const parent = await db.prepare("SELECT id, parent_id FROM categories WHERE id=?").bind(parentId).first();
  if (!parent) return "No such parent category.";
  if (parent.parent_id) return `"${parentId}" is already inside another category — the tree is only two deep.`;
  if (id) {
    const kids = await db.prepare("SELECT COUNT(*) AS n FROM categories WHERE parent_id=?").bind(id).first();
    if (kids.n) return "This category has sub-categories of its own, so it has to stay at the top level.";
  }
  return null;
}

async function categoryCounts(db) {
  const rows = (await db.prepare("SELECT cat, COUNT(*) AS n FROM products GROUP BY cat").all()).results;
  return Object.fromEntries(rows.map((r) => [r.cat, r.n]));
}

admin.get("/categories", async (c) => {
  const db = c.env.DB;
  const rows = (await db.prepare("SELECT * FROM categories ORDER BY sort, id").all()).results;
  const counts = await categoryCounts(db);
  return c.json({ categories: rows.map((x) => categoryOut(x, counts)), groups: CAT_GROUPS });
});

admin.post("/categories", async (c) => {
  const b = await c.req.json();
  const db = c.env.DB;
  const label = String(b.label || "").trim();
  if (!label) return c.json({ error: "Give the category a name." }, 400);
  const base = String(b.id || label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!base) return c.json({ error: "That name doesn't make a usable id." }, 400);
  if (await db.prepare("SELECT id FROM categories WHERE id=?").bind(base).first())
    return c.json({ error: `There is already a category with the id "${base}".` }, 400);
  const parentId = String(b.parentId || "").trim() || null;
  const refusal = await parentRefusal(db, null, parentId);
  if (refusal) return c.json({ error: refusal }, 400);
  // A new child sorts after its siblings; a new shelf after the other shelves.
  const last = await db.prepare("SELECT COALESCE(MAX(sort),0) AS s FROM categories WHERE parent_id IS ?").bind(parentId).first();
  await db.prepare("INSERT INTO categories (id, label, descr, sort, live, grp, image_url, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(base, label, String(b.desc || "").trim(), Number.isFinite(parseInt(b.sort, 10)) ? parseInt(b.sort, 10) : last.s + 1,
      b.live === false ? 0 : 1, CAT_GROUPS.includes(b.grp) ? b.grp : "", String(b.imageUrl || "").trim() || null,
      parentId).run();
  return c.json({ ok: true, id: base });
});

admin.patch("/categories/:id", async (c) => {
  const b = await c.req.json();
  const id = c.req.param("id");
  const db = c.env.DB;
  if (!(await db.prepare("SELECT id FROM categories WHERE id=?").bind(id).first())) return c.json({ error: "No such category." }, 404);
  const sets = [], vals = [];
  const push = (col, val) => { sets.push(`${col}=?`); vals.push(val); };
  if (b.label !== undefined) push("label", String(b.label).trim());
  if (b.desc !== undefined) push("descr", String(b.desc).trim());
  if (b.sort !== undefined) push("sort", parseInt(b.sort, 10) || 0);
  if (b.live !== undefined) push("live", b.live ? 1 : 0);
  if (b.grp !== undefined) push("grp", CAT_GROUPS.includes(b.grp) ? b.grp : "");
  if (b.imageUrl !== undefined) push("image_url", String(b.imageUrl).trim() || null);
  if (b.parentId !== undefined) {
    const parentId = String(b.parentId || "").trim() || null;
    const refusal = await parentRefusal(db, id, parentId);
    if (refusal) return c.json({ error: refusal }, 400);
    push("parent_id", parentId);
  }
  // Hiding the last live category would empty the storefront's menu entirely.
  if (b.live === false) {
    const others = await db.prepare("SELECT COUNT(*) AS n FROM categories WHERE live=1 AND id<>?").bind(id).first();
    if (!others.n) return c.json({ error: "This is the only live category — make another live before hiding this one." }, 400);
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  await db.prepare(`UPDATE categories SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  return c.json({ ok: true });
});

// A category with products in it is the shelf those products live on — deleting
// it would break the foreign key that keeps them findable, so it is refused
// with the count rather than cascading. Move the products first, or hide it.
admin.delete("/categories/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;
  const used = await db.prepare("SELECT COUNT(*) AS n FROM products WHERE cat=?").bind(id).first();
  if (used.n) return c.json({ error: `${used.n} product${used.n === 1 ? " is" : "s are"} filed under this category — move them first, or hide it instead.` }, 400);
  // Deleting a parent would orphan its children, whose products are still on
  // the shop floor. Empty it first, the same rule as products.
  const kids = await db.prepare("SELECT COUNT(*) AS n FROM categories WHERE parent_id=?").bind(id).first();
  if (kids.n) return c.json({ error: `${kids.n} sub-categor${kids.n === 1 ? "y sits" : "ies sit"} inside this one — move or delete ${kids.n === 1 ? "it" : "them"} first.` }, 400);
  const others = await db.prepare("SELECT COUNT(*) AS n FROM categories WHERE id<>?").bind(id).first();
  if (!others.n) return c.json({ error: "A shop needs at least one category." }, 400);
  await db.prepare("DELETE FROM categories WHERE id=?").bind(id).run();
  return c.json({ ok: true });
});

// ---- Deals (a markdown the house runs for a period) ----
//
// A promo code is typed; a deal is seen. This is what fills the Deals tab: a
// title, a badge, the products, and a window it runs inside. Nothing has to be
// switched off by hand when the window closes.

admin.get("/deals", async (c) => {
  const db = c.env.DB;
  const rows = (await db.prepare("SELECT * FROM deals ORDER BY sort, created_at").all()).results;
  const items = (await db.prepare("SELECT * FROM deal_products ORDER BY sort").all()).results;
  return c.json({
    deals: rows.map((d) => ({
      id: d.id, title: d.title, desc: d.descr, badge: d.badge, status: d.status, sort: d.sort,
      startsAt: d.starts_at || "", endsAt: d.ends_at || "",
      live: dealIsLive(d, todayInWAT()),
      productIds: items.filter((i) => i.deal_id === d.id).map((i) => i.product_id),
    })),
  });
});

admin.post("/deals", async (c) => {
  const b = await c.req.json();
  const db = c.env.DB;
  const title = String(b.title || "").trim();
  if (!title) return c.json({ error: "Give the deal a title." }, 400);
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deal";
  const exists = await db.prepare("SELECT id FROM deals WHERE id=?").bind(base).first();
  const id = exists ? `${base}-${Date.now().toString(36)}` : base;
  const last = await db.prepare("SELECT COALESCE(MAX(sort),0) AS s FROM deals").first();
  await db.prepare("INSERT INTO deals (id, title, descr, badge, starts_at, ends_at, status, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, title, String(b.desc || "").trim(), String(b.badge || "Hot deal").trim(),
      isoDate(b.startsAt), isoDate(b.endsAt), b.status === "Ended" ? "Ended" : "Active", last.s + 1).run();
  await setDealProducts(db, id, b.productIds);
  return c.json({ ok: true, id });
});

admin.patch("/deals/:id", async (c) => {
  const b = await c.req.json();
  const id = c.req.param("id");
  const db = c.env.DB;
  if (!(await db.prepare("SELECT id FROM deals WHERE id=?").bind(id).first())) return c.json({ error: "No such deal." }, 404);
  const sets = [], vals = [];
  const push = (col, val) => { sets.push(`${col}=?`); vals.push(val); };
  if (b.title !== undefined) push("title", String(b.title).trim());
  if (b.desc !== undefined) push("descr", String(b.desc).trim());
  if (b.badge !== undefined) push("badge", String(b.badge).trim() || "Hot deal");
  if (b.startsAt !== undefined) push("starts_at", isoDate(b.startsAt));
  if (b.endsAt !== undefined) push("ends_at", isoDate(b.endsAt));
  if (b.status !== undefined) push("status", b.status === "Ended" ? "Ended" : "Active");
  if (b.sort !== undefined) push("sort", parseInt(b.sort, 10) || 0);
  if (sets.length) {
    vals.push(id);
    await db.prepare(`UPDATE deals SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  }
  if (Array.isArray(b.productIds)) await setDealProducts(db, id, b.productIds);
  return c.json({ ok: true });
});

admin.delete("/deals/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM deal_products WHERE deal_id=?").bind(id),
    c.env.DB.prepare("DELETE FROM deals WHERE id=?").bind(id),
  ]);
  return c.json({ ok: true });
});

async function setDealProducts(db, id, productIds) {
  if (!Array.isArray(productIds)) return;
  const known = (await db.prepare("SELECT id FROM products").all()).results.map((p) => p.id);
  const wanted = productIds.filter((p) => known.includes(p));
  const stmts = [db.prepare("DELETE FROM deal_products WHERE deal_id=?").bind(id)];
  wanted.forEach((pid, i) => stmts.push(db.prepare("INSERT INTO deal_products (deal_id, product_id, sort) VALUES (?, ?, ?)").bind(id, pid, i)));
  await db.batch(stmts);
}

// ---- Daily deals (one piece, one price, one clock) ----
//
// The countdown card on the home page. The house queues them ahead — Monday's
// piece, Tuesday's — and the storefront shows whichever window contains right
// now. The price named here is the price the shopper is charged, because
// worker/shop.js lays it over the catalogue before anything reads a row.

// 'YYYY-MM-DDTHH:MM' in WAT, which is what <input type="datetime-local"> hands
// back. Anything else is refused rather than stored as a window nothing matches.
const isoMinute = (s) => {
  const v = String(s || "").trim().replace(" ", "T").slice(0, 16);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? v : null;
};
const money = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// A row as the panel shows it: the schedule, plus what the shopper would
// actually see — resolved against the catalogue so a deal pointing at a piece
// that has since been unpublished says so instead of looking fine.
function dailyDealView(row, products, now) {
  const product = products.find((p) => p.id === row.product_id) || null;
  const variants = product ? (product.variants || []).filter((v) => v.active !== false) : [];
  const variant = (row.variant_id ? variants.find((v) => v.id === row.variant_id) : null) || variants[0] || null;
  const from = watToMs(row.starts_at);
  const to = watToMs(row.ends_at);
  const price = row.price_ngn || (variant ? variant.ngn : 0);
  const compareAt = row.compare_at_ngn || (variant ? variant.compareAtNgn : 0) || 0;
  return {
    id: row.id,
    productId: row.product_id,
    productName: product ? product.name : "(deleted product)",
    productLive: !!(product && product.live),
    variantId: row.variant_id || null,
    variantLabel: variant ? variant.size : "",
    variantMissing: !variant,
    headline: row.headline,
    priceNgn: row.price_ngn || null,
    compareAtNgn: row.compare_at_ngn || null,
    // What a shopper would read on the card, once the blanks fall back to the
    // variation's own numbers.
    shownPriceNgn: price,
    shownCompareAtNgn: compareAt > price ? compareAt : null,
    off: compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    state: row.status === "Paused" ? "Paused"
      : Number.isNaN(from) || Number.isNaN(to) ? "Unscheduled"
      : now < from ? "Upcoming"
      : now >= to ? "Finished"
      : "Running",
  };
}

admin.get("/daily-deals", async (c) => {
  const db = c.env.DB;
  const now = Date.now();
  const settings = await getSettings(db);
  const products = await loadProducts(db);
  const rows = (await db.prepare("SELECT * FROM daily_deals ORDER BY starts_at DESC, id DESC").all()).results;
  const live = products.filter((p) => p.live);
  // The same two calls the storefront makes, so the panel's "on the storefront
  // now" line is the storefront's answer rather than a second opinion.
  const showing = settings.dailyDealOn === false ? null : resolveDailyDeal({
    products: live,
    row: pickDailyDeal(rows, now),
    auto: settings.dailyDealAuto !== false,
    headline: settings.dailyDealHeadline || "Daily Deal",
    now,
  });
  return c.json({
    dailyDeals: rows.map((r) => dailyDealView(r, products, now)),
    showing,
    settings: {
      dailyDealOn: settings.dailyDealOn !== false,
      dailyDealAuto: settings.dailyDealAuto !== false,
      dailyDealHeadline: settings.dailyDealHeadline || "Daily Deal",
    },
    now: msToWat(now),
  });
});

admin.post("/daily-deals", async (c) => {
  const b = await c.req.json();
  const db = c.env.DB;
  const productId = String(b.productId || "").trim();
  if (!productId) return c.json({ error: "Choose the piece to feature." }, 400);
  if (!(await db.prepare("SELECT id FROM products WHERE id=?").bind(productId).first())) return c.json({ error: "No such product." }, 404);
  const startsAt = isoMinute(b.startsAt);
  const endsAt = isoMinute(b.endsAt);
  if (!startsAt || !endsAt) return c.json({ error: "A daily deal needs a start and an end." }, 400);
  if (watToMs(endsAt) <= watToMs(startsAt)) return c.json({ error: "The deal has to end after it starts." }, 400);
  const variantId = await resolveVariant(db, productId, b.variantId);
  const r = await db.prepare(
    `INSERT INTO daily_deals (product_id, variant_id, headline, price_ngn, compare_at_ngn, starts_at, ends_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    productId, variantId, String(b.headline || "Daily Deal").trim() || "Daily Deal",
    money(b.priceNgn), money(b.compareAtNgn), startsAt, endsAt,
    b.status === "Paused" ? "Paused" : "Scheduled"
  ).run();
  return c.json({ ok: true, id: r.meta ? r.meta.last_row_id : null });
});

admin.patch("/daily-deals/:id", async (c) => {
  const b = await c.req.json();
  const id = parseInt(c.req.param("id"), 10);
  const db = c.env.DB;
  const row = await db.prepare("SELECT * FROM daily_deals WHERE id=?").bind(id).first();
  if (!row) return c.json({ error: "No such daily deal." }, 404);
  const sets = [], vals = [];
  const push = (col, val) => { sets.push(`${col}=?`); vals.push(val); };
  if (b.productId !== undefined) {
    const pid = String(b.productId).trim();
    if (!(await db.prepare("SELECT id FROM products WHERE id=?").bind(pid).first())) return c.json({ error: "No such product." }, 404);
    push("product_id", pid);
    // A new product invalidates the old variation, so the two move together.
    push("variant_id", await resolveVariant(db, pid, b.variantId));
  } else if (b.variantId !== undefined) {
    push("variant_id", await resolveVariant(db, row.product_id, b.variantId));
  }
  if (b.headline !== undefined) push("headline", String(b.headline).trim() || "Daily Deal");
  if (b.priceNgn !== undefined) push("price_ngn", money(b.priceNgn));
  if (b.compareAtNgn !== undefined) push("compare_at_ngn", money(b.compareAtNgn));
  const startsAt = b.startsAt !== undefined ? isoMinute(b.startsAt) : row.starts_at;
  const endsAt = b.endsAt !== undefined ? isoMinute(b.endsAt) : row.ends_at;
  if (b.startsAt !== undefined || b.endsAt !== undefined) {
    if (!startsAt || !endsAt) return c.json({ error: "A daily deal needs a start and an end." }, 400);
    if (watToMs(endsAt) <= watToMs(startsAt)) return c.json({ error: "The deal has to end after it starts." }, 400);
    push("starts_at", startsAt);
    push("ends_at", endsAt);
  }
  if (b.status !== undefined) push("status", b.status === "Paused" ? "Paused" : "Scheduled");
  if (sets.length) {
    vals.push(id);
    await db.prepare(`UPDATE daily_deals SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  }
  return c.json({ ok: true });
});

admin.delete("/daily-deals/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM daily_deals WHERE id=?").bind(parseInt(c.req.param("id"), 10)).run();
  return c.json({ ok: true });
});

// The variation to feature: the one named, if it belongs to this product and is
// still on sale, otherwise the product's first active one. Never a variation of
// some other product — that would price the wrong piece.
async function resolveVariant(db, productId, variantId) {
  const rows = (await db.prepare("SELECT id FROM variants WHERE product_id=? AND active=1 ORDER BY sort, id").bind(productId).all()).results;
  const wanted = parseInt(variantId, 10);
  if (Number.isFinite(wanted) && rows.some((v) => v.id === wanted)) return wanted;
  return rows.length ? rows[0].id : null;
}

// ---- Insights ----
//
// The first screen in this admin that answers "why didn't they buy" rather than
// "what did they buy". Everything historical reads `insight_daily`; only today
// and a drill-down into one segment touch a session row, and nothing here ever
// scans the raw event log — which is the whole reason the rollup exists.

admin.get("/insights", async (c) => {
  const days = parseInt(c.req.query("days") || "30", 10);
  const db = c.env.DB;
  const settings = await getSettings(db);
  const [data, segments, soldOut] = await Promise.all([
    insightOverview(c.env, { days }),
    segmentCounts(c.env, { days, settings }),
    soldOutDemand(c.env, { days }),
  ]);
  // A stream switched off, or one that has not run long enough to have folded a
  // single day, should say so rather than drawing a chart of zeroes and letting
  // the reader conclude nobody came.
  const folded = await db.prepare("SELECT COUNT(*) AS n FROM insight_daily").first();
  return c.json({
    ...data, segments, soldOut,
    cfg: insightsConfig(settings),
    warming: folded.n === 0,
  });
});

admin.get("/insights/segments/:id", async (c) => {
  const r = await segmentRows(c.env, c.req.param("id"), { days: parseInt(c.req.query("days") || "30", 10) });
  return r ? c.json(r) : c.json({ error: "No such segment." }, 404);
});

// Catch the derived data up now rather than waiting for the cron — for the
// moment after switching the stream on, when an empty screen is
// indistinguishable from a broken one. Both jobs, because both are "fold what
// has happened into what the shop reads", and two buttons would only ever be
// pressed together.
admin.post("/insights/rollup", async (c) => {
  const folded = await rollup(c.env);
  const graph = await rebuildAffinity(c.env);
  return c.json({ ...folded, ...graph });
});

// ---- The home page ----
//
// Every band, shelf, heading and tile on the home page is a row here. What the
// house gets out of that: reorder the page, rewrite any heading, swap a
// photograph, point a button somewhere else, switch a section off, add a band
// of its own — and, the thing actually asked for, choose by hand which products
// sit under "Best sellers" and "Ready at your store" instead of taking whatever
// the arithmetic picked.
//
// The kinds whose body is structural (the story, the rewards steps, the
// newsletter box) can be reordered, retitled and switched off but not invented:
// there is no drawing for a kind this file has never heard of, so creating one
// is refused rather than rendering nothing on the storefront.
const BLOCK_KINDS = ["tile", "band", "shelf"];
const FIXED_KINDS = ["perks", "categories", "story", "rewards", "reviews", "blog", "newsletter", "instagram"];

admin.get("/home-blocks", async (c) => {
  const blocks = await loadHomeBlocks(c.env.DB);
  return c.json({ blocks, kinds: BLOCK_KINDS, fixedKinds: FIXED_KINDS, sources: SOURCES });
});

admin.post("/home-blocks", async (c) => {
  const b = await c.req.json();
  const db = c.env.DB;
  const kind = String(b.kind || "").trim();
  if (!BLOCK_KINDS.includes(kind)) {
    return c.json({ error: `A new block can be a ${BLOCK_KINDS.join(", a ")}. The rest of the page is already on it.` }, 400);
  }
  const base = String(b.id || b.title || kind).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || kind;
  let id = base;
  for (let n = 2; await db.prepare("SELECT id FROM home_blocks WHERE id=?").bind(id).first(); n++) id = `${base}-${n}`;
  const last = await db.prepare("SELECT COALESCE(MAX(sort), 0) + 100 AS n FROM home_blocks WHERE kind IS NOT 'tile'").first();
  const tileLast = await db.prepare("SELECT COALESCE(MAX(sort), 0) + 10 AS n FROM home_blocks WHERE kind = 'tile'").first();
  await db.prepare(
    `INSERT INTO home_blocks (id, kind, layout, source, ref_id, count, eyebrow, title, sub, lines, cta_label, cta_target, image_url, dark, sort, live)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, kind,
    b.layout === "cta-band" ? "cta-band" : "product-band",
    SOURCES.includes(b.source) ? b.source : (kind === "band" ? "category" : "segment"),
    String(b.refId || "").trim(),
    Math.max(0, Math.min(24, parseInt(b.count, 10) || (kind === "band" ? 3 : 4))),
    String(b.eyebrow || "").trim(), String(b.title || "").trim(), String(b.sub || "").trim(),
    String(b.lines || ""), String(b.ctaLabel || "").trim(), String(b.ctaTarget || "").trim(),
    String(b.imageUrl || "").trim() || null,
    b.dark === false ? 0 : 1,
    kind === "tile" ? tileLast.n : last.n,
    // A new block opens hidden. Nobody wants their first half-written band to
    // land on the shop floor the instant they name it.
    0
  ).run();
  return c.json({ ok: true, id });
});

admin.patch("/home-blocks/:id", async (c) => {
  const b = await c.req.json();
  const db = c.env.DB;
  const id = c.req.param("id");
  const row = await db.prepare("SELECT * FROM home_blocks WHERE id=?").bind(id).first();
  if (!row) return c.json({ error: "No such block." }, 404);
  const sets = ["updated_at=datetime('now')"], vals = [];
  const put = (col, val) => { sets.push(`${col}=?`); vals.push(val); };
  if (b.layout !== undefined) put("layout", b.layout === "cta-band" ? "cta-band" : "product-band");
  if (b.source !== undefined && SOURCES.includes(b.source)) put("source", b.source);
  if (b.refId !== undefined) put("ref_id", String(b.refId).trim());
  if (b.count !== undefined) put("count", Math.max(0, Math.min(24, parseInt(b.count, 10) || 0)));
  if (b.eyebrow !== undefined) put("eyebrow", String(b.eyebrow).trim());
  if (b.title !== undefined) put("title", String(b.title).trim());
  if (b.sub !== undefined) put("sub", String(b.sub).trim());
  if (b.lines !== undefined) put("lines", String(b.lines));
  if (b.ctaLabel !== undefined) put("cta_label", String(b.ctaLabel).trim());
  if (b.ctaTarget !== undefined) put("cta_target", String(b.ctaTarget).trim());
  if (b.imageUrl !== undefined) put("image_url", String(b.imageUrl || "").trim() || null);
  if (b.dark !== undefined) put("dark", b.dark ? 1 : 0);
  if (b.sort !== undefined) put("sort", parseInt(b.sort, 10) || 0);
  if (b.live !== undefined) put("live", b.live ? 1 : 0);
  vals.push(id);
  await db.prepare(`UPDATE home_blocks SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();

  // The hand-picked list, replaced wholesale in the order it arrives.
  if (Array.isArray(b.productIds)) {
    const known = new Set((await db.prepare("SELECT id FROM products").all()).results.map((p) => p.id));
    const ids = [...new Set(b.productIds.map(String))].filter((p) => known.has(p)).slice(0, 24);
    await db.prepare("DELETE FROM home_block_products WHERE block_id=?").bind(id).run();
    if (ids.length) {
      await db.batch(ids.map((pid, i) =>
        db.prepare("INSERT INTO home_block_products (block_id, product_id, sort) VALUES (?, ?, ?)").bind(id, pid, i)));
    }
  }
  return c.json({ ok: true });
});

// Reorder in one call, so dragging a block up does not leave the page in a
// half-sorted state if the second request never lands.
admin.put("/home-blocks/order", async (c) => {
  const { ids } = await c.req.json();
  if (!Array.isArray(ids) || !ids.length) return c.json({ error: "Send the blocks in their new order." }, 400);
  const db = c.env.DB;
  const known = new Set((await db.prepare("SELECT id FROM home_blocks").all()).results.map((r) => r.id));
  const ordered = ids.map(String).filter((id) => known.has(id));
  // Tiles and the flow of the page are two sequences; each is renumbered
  // within itself so neither can push the other around.
  const rows = (await db.prepare("SELECT id, kind FROM home_blocks").all()).results;
  const kindOf = new Map(rows.map((r) => [r.id, r.kind]));
  let tile = 0, flow = 0;
  await db.batch(ordered.map((id) => {
    const sort = kindOf.get(id) === "tile" ? (tile += 10) : (flow += 100);
    return db.prepare("UPDATE home_blocks SET sort=?, updated_at=datetime('now') WHERE id=?").bind(sort, id);
  }));
  return c.json({ ok: true, ordered: ordered.length });
});

admin.delete("/home-blocks/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const row = await db.prepare("SELECT kind FROM home_blocks WHERE id=?").bind(id).first();
  if (!row) return c.json({ error: "No such block." }, 404);
  // The structural blocks can be switched off but not destroyed: there is no
  // way to make another one, so deleting the story would lose it for good.
  if (FIXED_KINDS.includes(row.kind)) {
    return c.json({ error: "This section can be hidden, but not deleted — there is no way to make another one." }, 400);
  }
  await db.batch([
    db.prepare("DELETE FROM home_block_products WHERE block_id=?").bind(id),
    db.prepare("DELETE FROM home_blocks WHERE id=?").bind(id),
  ]);
  return c.json({ ok: true });
});

// ---- Information & legal pages ----
//
// The privacy notice used to be JSX, down to a "last updated" date only a
// deploy could move — which is how a shop ends up publishing a policy nobody in
// the house can correct. It is content now, written the way the blog is written:
// plain text, `## ` for a heading, `> ` for a quote, rendered by the same
// PostBody. Nothing user-written is ever handed to dangerouslySetInnerHTML.
//
// The slug is the URL. It is fixed at creation for the four pages that ship, so
// /privacy stays /privacy however the title is reworded.

const pageOut = (r) => ({
  slug: r.slug, title: r.title, eyebrow: r.eyebrow || "", body: r.body || "",
  seoTitle: r.seo_title || "", seoDesc: r.seo_desc || "",
  inFooter: !!r.in_footer, live: !!r.live, sort: r.sort, updatedAt: r.updated_at,
});

async function freePageSlug(db, want) {
  const base = String(want || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
  for (let n = 0; n < 50; n++) {
    const candidate = n ? `${base}-${n + 1}` : base;
    if (!(await db.prepare("SELECT slug FROM content_pages WHERE slug=?").bind(candidate).first())) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// Paths the storefront already answers for itself. A page may not claim one, or
// it would shadow the shop and never be reachable.
const RESERVED_SLUGS = new Set([
  "shop", "product", "blog", "about", "faq", "track", "contact", "checkout", "confirm",
  "account", "wishlist", "locations", "reviews", "consultation", "brand", "brands", "admin", "api", "images",
  "new-arrivals", "best-sellers", "deals", "gift-sets", "robots.txt", "sitemap.xml",
]);

admin.get("/pages", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT * FROM content_pages ORDER BY sort, slug").all()).results;
  return c.json({ pages: rows.map(pageOut) });
});

admin.post("/pages", async (c) => {
  const b = await c.req.json();
  const db = c.env.DB;
  const title = String(b.title || "").trim();
  if (!title) return c.json({ error: "Give the page a title." }, 400);
  const wanted = String(b.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (RESERVED_SLUGS.has(wanted)) return c.json({ error: `"/${wanted}" is already a page of the shop — choose another address.` }, 400);
  const slug = await freePageSlug(db, wanted);
  const next = await db.prepare("SELECT COALESCE(MAX(sort), 0) + 10 AS n FROM content_pages").first();
  await db.prepare(
    "INSERT INTO content_pages (slug, title, eyebrow, body, seo_title, seo_desc, in_footer, live, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    slug, title, String(b.eyebrow || "").trim(), String(b.body || ""),
    String(b.seoTitle || "").trim(), String(b.seoDesc || "").trim(),
    b.inFooter === false ? 0 : 1, b.live ? 1 : 0, next.n
  ).run();
  return c.json({ ok: true, slug });
});

admin.patch("/pages/:slug", async (c) => {
  const b = await c.req.json();
  const db = c.env.DB;
  const slug = c.req.param("slug");
  const row = await db.prepare("SELECT * FROM content_pages WHERE slug=?").bind(slug).first();
  if (!row) return c.json({ error: "No such page." }, 404);
  const sets = ["updated_at=datetime('now')"], vals = [];
  const put = (col, val) => { sets.push(`${col}=?`); vals.push(val); };
  if (b.title !== undefined) {
    const t = String(b.title).trim();
    if (!t) return c.json({ error: "A page needs a title." }, 400);
    put("title", t);
  }
  if (b.eyebrow !== undefined) put("eyebrow", String(b.eyebrow).trim());
  if (b.body !== undefined) put("body", String(b.body));
  if (b.seoTitle !== undefined) put("seo_title", String(b.seoTitle).trim());
  if (b.seoDesc !== undefined) put("seo_desc", String(b.seoDesc).trim());
  if (b.inFooter !== undefined) put("in_footer", b.inFooter ? 1 : 0);
  if (b.live !== undefined) put("live", b.live ? 1 : 0);
  if (b.sort !== undefined) put("sort", parseInt(b.sort, 10) || 0);
  vals.push(slug);
  await db.prepare(`UPDATE content_pages SET ${sets.join(", ")} WHERE slug=?`).bind(...vals).run();
  return c.json({ ok: true });
});

admin.delete("/pages/:slug", async (c) => {
  const slug = c.req.param("slug");
  // Privacy is linked from the consent banner and the footer, and a shop that
  // takes payments has to have one. Hiding it is a decision; deleting it by
  // accident should not be possible.
  if (slug === "privacy") return c.json({ error: "The privacy notice can be unpublished, but not deleted." }, 400);
  await c.env.DB.prepare("DELETE FROM content_pages WHERE slug=?").bind(slug).run();
  return c.json({ ok: true });
});

// ---- The blog ----
//
// The slug is the URL, so it is derived from the title once and then only ever
// changed deliberately: renaming a post must not silently break a link someone
// has shared.
//
// A preview is a preview, and a heading fits on a card. The screen shows the
// writer a count as they type, but a limit only a browser enforces is not one:
// the API holds the same line, and the storefront clamps once more on the way
// out so the posts written before any of this existed come back short too.
const clampPreview = (v) => clampText(String(v ?? ""), PREVIEW_MAX);
const clampTitle = (v) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);

const blogOut = (r) => ({
  id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt, body: r.body,
  coverUrl: r.cover_url || "", author: r.author, tags: r.tags, status: r.status,
  publishedAt: r.published_at || "", updatedAt: r.updated_at,
});

async function freeSlug(db, want, exceptId = -1) {
  const base = String(want || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "post";
  for (let n = 0; n < 50; n++) {
    const candidate = n ? `${base}-${n + 1}` : base;
    const taken = await db.prepare("SELECT id FROM blog_posts WHERE slug=? AND id IS NOT ?").bind(candidate, exceptId).first();
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

admin.get("/blog", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT * FROM blog_posts ORDER BY COALESCE(published_at, created_at) DESC").all()).results;
  return c.json({ posts: rows.map(blogOut) });
});

admin.post("/blog", async (c) => {
  const b = await c.req.json();
  const db = c.env.DB;
  const title = clampTitle(b.title);
  if (!title) return c.json({ error: "Give the story a title." }, 400);
  const slug = await freeSlug(db, b.slug || title);
  const status = b.status === "published" ? "published" : "draft";
  const r = await db.prepare(
    "INSERT INTO blog_posts (slug, title, excerpt, body, cover_url, author, tags, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    slug, title, clampPreview(b.excerpt), String(b.body || ""), String(b.coverUrl || "").trim() || null,
    String(b.author || "").trim() || "Majestic Roobee", String(b.tags || "").trim(), status,
    status === "published" ? (isoDate(b.publishedAt) || new Date().toISOString().slice(0, 19).replace("T", " ")) : null
  ).run();
  return c.json({ ok: true, id: r.meta.last_row_id, slug });
});

admin.patch("/blog/:id", async (c) => {
  const b = await c.req.json();
  const id = parseInt(c.req.param("id"), 10);
  const db = c.env.DB;
  const cur = await db.prepare("SELECT * FROM blog_posts WHERE id=?").bind(id).first();
  if (!cur) return c.json({ error: "No such post." }, 404);
  const sets = [], vals = [];
  const push = (col, val) => { sets.push(`${col}=?`); vals.push(val); };
  if (b.title !== undefined) {
    const t = clampTitle(b.title);
    if (!t) return c.json({ error: "Give the story a title." }, 400);
    push("title", t);
  }
  if (b.slug !== undefined && String(b.slug).trim() && String(b.slug).trim() !== cur.slug) push("slug", await freeSlug(db, b.slug, id));
  if (b.excerpt !== undefined) push("excerpt", clampPreview(b.excerpt));
  if (b.body !== undefined) push("body", String(b.body));
  if (b.coverUrl !== undefined) push("cover_url", String(b.coverUrl).trim() || null);
  if (b.author !== undefined) push("author", String(b.author).trim() || "Majestic Roobee");
  if (b.tags !== undefined) push("tags", String(b.tags).trim());
  if (b.status !== undefined) {
    const status = b.status === "published" ? "published" : "draft";
    push("status", status);
    // The publish date is stamped the first time it goes out and then left
    // alone, so editing a live post doesn't reorder the blog.
    if (status === "published" && !cur.published_at) push("published_at", new Date().toISOString().slice(0, 19).replace("T", " "));
  }
  if (b.publishedAt !== undefined && isoDate(b.publishedAt)) push("published_at", isoDate(b.publishedAt));
  push("updated_at", new Date().toISOString().slice(0, 19).replace("T", " "));
  vals.push(id);
  await db.prepare(`UPDATE blog_posts SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  return c.json({ ok: true });
});

admin.delete("/blog/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM blog_posts WHERE id=?").bind(parseInt(c.req.param("id"), 10)).run();
  return c.json({ ok: true });
});

// ---- Reviews & testimonials ----
//
// Most of the house's proof already lives on Instagram and TikTok, so the admin
// pastes the link they copied and the server reduces it to the post's id. The
// kind is inferred from the address rather than chosen from a menu — a pasted
// Instagram link that has to be labelled "Instagram" is a step that exists only
// to be got wrong.

const testimonialOut = (t) => ({
  id: t.id, kind: t.kind, url: t.url, ref: t.ref, embedUrl: embedUrlFor(t.kind, t.ref),
  author: t.author, handle: t.handle, quote: t.quote, rating: t.rating, city: t.city,
  productId: t.product_id || "", thumbUrl: t.thumb_url || "", sort: t.sort, live: !!t.live,
});

admin.get("/testimonials", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT * FROM testimonials ORDER BY sort, id").all()).results;
  return c.json({ testimonials: rows.map(testimonialOut) });
});

admin.post("/testimonials", async (c) => {
  const b = await c.req.json();
  const db = c.env.DB;
  const url = String(b.url || "").trim();
  const parsed = parseEmbed(url);
  const quote = String(b.quote || "").trim();
  if (parsed.kind === "quote" && !quote)
    return c.json({ error: url ? "That link isn't an Instagram, TikTok or YouTube post — paste the post's URL, or write the testimonial out as a quote." : "Paste a post link, or write the testimonial out as a quote." }, 400);
  const last = await db.prepare("SELECT COALESCE(MAX(sort),0) AS s FROM testimonials").first();
  const r = await db.prepare(
    "INSERT INTO testimonials (kind, url, ref, author, handle, quote, rating, city, product_id, thumb_url, sort, live) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    parsed.kind, url, parsed.ref, String(b.author || "").trim(), String(b.handle || "").trim(), quote,
    Math.max(1, Math.min(5, parseInt(b.rating, 10) || 5)), String(b.city || "").trim(),
    String(b.productId || "").trim() || null, String(b.thumbUrl || "").trim() || null,
    last.s + 1, b.live === false ? 0 : 1
  ).run();
  return c.json({ ok: true, id: r.meta.last_row_id, kind: parsed.kind });
});

admin.patch("/testimonials/:id", async (c) => {
  const b = await c.req.json();
  const id = parseInt(c.req.param("id"), 10);
  const db = c.env.DB;
  if (!(await db.prepare("SELECT id FROM testimonials WHERE id=?").bind(id).first())) return c.json({ error: "No such testimonial." }, 404);
  const sets = [], vals = [];
  const push = (col, val) => { sets.push(`${col}=?`); vals.push(val); };
  // Re-parsing on every URL change keeps kind and ref in step with the link.
  if (b.url !== undefined) {
    const parsed = parseEmbed(b.url);
    push("url", String(b.url).trim());
    push("kind", parsed.kind);
    push("ref", parsed.ref);
  }
  if (b.author !== undefined) push("author", String(b.author).trim());
  if (b.handle !== undefined) push("handle", String(b.handle).trim());
  if (b.quote !== undefined) push("quote", String(b.quote).trim());
  if (b.rating !== undefined) push("rating", Math.max(1, Math.min(5, parseInt(b.rating, 10) || 5)));
  if (b.city !== undefined) push("city", String(b.city).trim());
  if (b.productId !== undefined) push("product_id", String(b.productId).trim() || null);
  if (b.thumbUrl !== undefined) push("thumb_url", String(b.thumbUrl).trim() || null);
  if (b.sort !== undefined) push("sort", parseInt(b.sort, 10) || 0);
  if (b.live !== undefined) push("live", b.live ? 1 : 0);
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  await db.prepare(`UPDATE testimonials SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  return c.json({ ok: true });
});

admin.delete("/testimonials/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM testimonials WHERE id=?").bind(parseInt(c.req.param("id"), 10)).run();
  return c.json({ ok: true });
});

// ---- Media (product imagery) ----
// Upload the raw file as the request body with its content-type. Stored in D1
// and served from /images/<id>; the URL shape is stable if storage moves to R2.
const MAX_IMAGE_BYTES = 1_500_000;

// Upload one image, original or derivative.
//
// The admin resizes in the browser and posts the set: the original first, then
// each narrower width with `x-parent` and `x-width` set. Storage backend is
// chosen inside putMedia — R2 when the bucket is bound, D1 until then.
admin.post("/media", async (c) => {
  const mime = (c.req.header("content-type") || "").split(";")[0].trim();
  if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(mime)) {
    return c.json({ error: "Upload a JPEG, PNG, WebP, AVIF or GIF image." }, 400);
  }
  const buf = await c.req.arrayBuffer();
  if (!buf.byteLength) return c.json({ error: "That file was empty." }, 400);
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    return c.json({ error: `Image is ${(buf.byteLength / 1e6).toFixed(1)}MB — please use one under 1.5MB (resize or compress it first).` }, 413);
  }
  const parentId = (c.req.header("x-parent") || "").trim() || null;
  const width = Math.max(0, parseInt(c.req.header("x-width") || "0", 10) || 0);
  if (parentId) {
    // A derivative must belong to an image that exists, or a caller could
    // scatter rows under any id it liked.
    const parent = await c.env.DB.prepare("SELECT id FROM media WHERE id=? AND parent_id IS NULL").bind(parentId).first();
    if (!parent) return c.json({ error: "No such original image." }, 400);
    if (!width) return c.json({ error: "A derivative needs its width." }, 400);
  }
  const id = parentId || "img_" + randHex(8);
  const stored = await putMedia(c.env, {
    id, mime, bytes: buf, width, parentId,
    alt: (c.req.header("x-alt") || "").slice(0, 200),
  });
  // Derivatives are addressed through the original's URL plus ?w=, so the URL
  // handed back is always the original's.
  return c.json({ ok: true, id, url: `/images/${id}`, size: stored.size, storage: c.env.MEDIA ? "r2" : "d1" });
});

// Where the images live, and how much of the database they are still taking up.
admin.get("/media/status", requireSuper, async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN storage='d1' AND length(bytes) > 0 THEN 1 ELSE 0 END) AS in_d1,
            SUM(CASE WHEN storage='r2' THEN 1 ELSE 0 END) AS in_r2,
            COALESCE(SUM(CASE WHEN storage='d1' THEN size ELSE 0 END), 0) AS d1_bytes,
            SUM(CASE WHEN parent_id IS NOT NULL THEN 1 ELSE 0 END) AS derivatives
       FROM media`
  ).first();
  return c.json({
    bucketBound: !!c.env.MEDIA,
    total: row.total || 0,
    inD1: row.in_d1 || 0,
    inR2: row.in_r2 || 0,
    d1Bytes: row.d1_bytes || 0,
    derivatives: row.derivatives || 0,
  });
});

// Move whatever is still in D1 into the bucket. Batched and re-runnable — the
// UI calls it until `remaining` is zero.
admin.post("/media/migrate", requireSuper, async (c) => {
  const { batch } = await c.req.json().catch(() => ({}));
  const out = await migrateToR2(c.env, Math.min(50, Math.max(1, parseInt(batch, 10) || 20)));
  return out.error ? c.json({ error: out.error }, 400) : c.json({ ok: true, ...out });
});

// ---- F2: automations & activity ----
admin.get("/automations", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT * FROM automations ORDER BY rowid").all()).results;
  const runs = (await c.env.DB.prepare("SELECT automation_id, status, COUNT(*) AS n FROM automation_runs GROUP BY automation_id, status").all()).results;
  return c.json({ automations: rows.map((a) => ({ ...a, enabled: !!a.enabled })), runStats: runs });
});

admin.patch("/automations/:id", async (c) => {
  const { enabled } = await c.req.json();
  await c.env.DB.prepare("UPDATE automations SET enabled=? WHERE id=?").bind(enabled ? 1 : 0, c.req.param("id")).run();
  return c.json({ ok: true });
});

admin.get("/automation-runs", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT r.*, a.name AS automation FROM automation_runs r JOIN automations a ON a.id=r.automation_id ORDER BY r.created_at DESC LIMIT 40").all()).results;
  return c.json({ runs: rows });
});

admin.get("/events", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT id, type, entity, at FROM events ORDER BY id DESC LIMIT 40").all()).results;
  return c.json({ events: rows });
});

// ---- Payments: gateway status + the reconciliation log ----
//
// The key itself is never returned. Only its *prefix* is read, to say whether
// the shop is pointed at Paystack's test environment or at real money — which
// is the single thing you most want confirmed before taking a live order, and
// the thing that is otherwise invisible from inside the app.
admin.get("/payments", requireSuper, async (c) => {
  const key = c.env.PAYSTACK_SECRET_KEY || "";
  const mode = !key ? "off" : key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "unknown";
  const rows = (await c.env.DB.prepare(
    `SELECT p.id, p.order_no, p.reference, p.amount, p.currency, p.status, p.channel, p.source, p.detail, p.at,
            o.total AS order_total, o.customer
       FROM payments p LEFT JOIN orders o ON o.no = p.order_no
      ORDER BY p.id DESC LIMIT 50`
  ).all()).results;
  const unpaid = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM orders WHERE pay_status IN ('pending','failed') AND status <> 'Cancelled'"
  ).first();
  return c.json({
    gateway: { provider: "paystack", mode, configured: !!key },
    webhookPath: "/api/paystack/webhook",
    unpaidOrders: unpaid ? unpaid.n : 0,
    payments: rows,
  });
});

// Run the lapsed-payment sweep now rather than waiting for the next cron.
//
// Same code the cron runs, so this is a nudge and never a second implementation:
// useful when a shopper is on the phone asking why the last bottle shows as out
// of stock, and it makes the sweep observable instead of something that only
// ever happens on a timer.
admin.post("/payments/sweep", requireSuper, async (c) => {
  return c.json(await releaseExpiredOrders(c.env));
});

// Settle a bank-transfer or WhatsApp order by hand, once the money has landed.
// Deliberately not available for card orders: those are settled by the gateway,
// and a human marking one paid would be inventing a payment.
admin.post("/orders/:no/mark-paid", requireSuper, async (c) => {
  const db = c.env.DB;
  const no = String(c.req.param("no") || "").toUpperCase();
  const order = await db.prepare("SELECT * FROM orders WHERE no=?").bind(no).first();
  if (!order) return c.json({ error: "Order not found." }, 404);
  if (order.pay === "Paystack") return c.json({ error: "Card orders are settled by Paystack, not by hand." }, 400);
  if (order.pay_status === "paid") return c.json({ ok: true, already: true });
  const who = c.get("admin");
  await markPaidManually(c.env, order, who.name || who.username || `admin #${who.uid}`);
  return c.json({ ok: true });
});

// ---- F3: webhooks & API keys (super only) ----
admin.get("/webhooks", requireSuper, async (c) => {
  const rows = (await c.env.DB.prepare("SELECT id, url, events, enabled, last_status, created_at FROM webhooks ORDER BY id DESC").all()).results;
  return c.json({ webhooks: rows.map((w) => ({ ...w, enabled: !!w.enabled })) });
});

admin.post("/webhooks", requireSuper, async (c) => {
  const { url, events } = await c.req.json();
  if (!url || !/^https?:\/\//.test(url)) return c.json({ error: "A valid https URL is required." }, 400);
  const secret = "whsec_" + randHex(20);
  await c.env.DB.prepare("INSERT INTO webhooks (url, secret, events) VALUES (?, ?, ?)").bind(url.trim(), secret, (events || "*").trim() || "*").run();
  // Secret shown once so the receiver can verify the x-mr-signature HMAC.
  return c.json({ ok: true, secret });
});

admin.delete("/webhooks/:id", requireSuper, async (c) => {
  await c.env.DB.prepare("DELETE FROM webhooks WHERE id=?").bind(parseInt(c.req.param("id"), 10)).run();
  return c.json({ ok: true });
});

admin.get("/api-keys", requireSuper, async (c) => {
  const rows = (await c.env.DB.prepare("SELECT id, name, prefix, scopes, enabled, last_used, created_at FROM api_keys ORDER BY id DESC").all()).results;
  return c.json({ keys: rows.map((k) => ({ ...k, enabled: !!k.enabled })) });
});

admin.post("/api-keys", requireSuper, async (c) => {
  const { name, scopes } = await c.req.json();
  if (!name || !String(name).trim()) return c.json({ error: "Name the key." }, 400);
  const scope = ["read", "write"].includes(scopes) ? scopes : "read";
  const key = "mr_" + randHex(24);
  await c.env.DB.prepare("INSERT INTO api_keys (name, key_hash, prefix, scopes) VALUES (?, ?, ?, ?)")
    .bind(String(name).trim(), await sha256hex(key), key.slice(0, 10), scope).run();
  // Full key returned exactly once.
  return c.json({ ok: true, key });
});

admin.delete("/api-keys/:id", requireSuper, async (c) => {
  await c.env.DB.prepare("DELETE FROM api_keys WHERE id=?").bind(parseInt(c.req.param("id"), 10)).run();
  return c.json({ ok: true });
});

// ---- Go-live: purge demo/seed data (super only) ----
// Selective so the owner decides exactly what goes. Each key maps to a set of
// deletes; nothing is removed unless explicitly requested.
// Two families of scope, kept apart on purpose.
//
// DEMO_PURGE removes only rows migration 0002 seeded (tagged by 0007). It can
// never touch a product, order or promo the shop created itself, so it is safe
// to run at any point — including after real trading has started.
//
// REAL_PURGE deletes genuine records. `customers` and `leads` were never seeded,
// so there is no demo version of them to clear; the only thing these scopes can
// delete is real data. The UI keeps them in a separate, clearly-marked group.
const DEMO_PURGE = {
  orders: ["DELETE FROM orders WHERE seeded = 1"], // order_items / order_events cascade
  inquiries: ["DELETE FROM inquiries WHERE seeded = 1"], // inquiry_messages cascade
  checkouts: ["DELETE FROM abandoned_checkouts WHERE seeded = 1"],
  marketing: ["DELETE FROM promos WHERE seeded = 1", "DELETE FROM campaigns WHERE seeded = 1", "DELETE FROM reward_codes WHERE seeded = 1"],
  products: [
    "DELETE FROM wishlists WHERE product_id IN (SELECT id FROM products WHERE seeded = 1)",
    "DELETE FROM products WHERE seeded = 1", // variants -> stock cascade
  ],
};

const REAL_PURGE = {
  customers: ["DELETE FROM wishlists", "DELETE FROM customer_addresses", "DELETE FROM customers"],
  leads: ["DELETE FROM leads"],
  activity: ["DELETE FROM automation_runs", "DELETE FROM events", "DELETE FROM stock_waitlist"],
  // Reward codes issued while testing. The orders that spent them let go of
  // them first — an order carries the code it used as a real reference, and a
  // delete that left one dangling would fail rather than clear anything.
  rewards: ["UPDATE orders SET reward_code = NULL", "DELETE FROM reward_codes"],
};

const PURGE = { ...DEMO_PURGE, ...REAL_PURGE };

admin.get("/data-counts", requireSuper, async (c) => {
  const q = async (sql) => (await c.env.DB.prepare(sql).first()).n;
  // `demo` is what a scope would actually delete; `real` is what it would leave
  // behind, so the Go-live page can say "17 samples, 1 of yours stays".
  return c.json({
    demo: {
      orders: await q("SELECT COUNT(*) AS n FROM orders WHERE seeded = 1"),
      inquiries: await q("SELECT COUNT(*) AS n FROM inquiries WHERE seeded = 1"),
      checkouts: await q("SELECT COUNT(*) AS n FROM abandoned_checkouts WHERE seeded = 1"),
      marketing: await q("SELECT (SELECT COUNT(*) FROM promos WHERE seeded=1)+(SELECT COUNT(*) FROM campaigns WHERE seeded=1)+(SELECT COUNT(*) FROM reward_codes WHERE seeded=1) AS n"),
      products: await q("SELECT COUNT(*) AS n FROM products WHERE seeded = 1"),
    },
    real: {
      orders: await q("SELECT COUNT(*) AS n FROM orders WHERE seeded = 0"),
      inquiries: await q("SELECT COUNT(*) AS n FROM inquiries WHERE seeded = 0"),
      checkouts: await q("SELECT COUNT(*) AS n FROM abandoned_checkouts WHERE seeded = 0"),
      marketing: await q("SELECT (SELECT COUNT(*) FROM promos WHERE seeded=0)+(SELECT COUNT(*) FROM campaigns WHERE seeded=0) AS n"),
      rewards: await q("SELECT COUNT(*) AS n FROM reward_codes"),
      products: await q("SELECT COUNT(*) AS n FROM products WHERE seeded = 0"),
      customers: await q("SELECT COUNT(*) AS n FROM customers"),
      leads: await q("SELECT COUNT(*) AS n FROM leads"),
      activity: await q("SELECT (SELECT COUNT(*) FROM events)+(SELECT COUNT(*) FROM automation_runs) AS n"),
    },
  });
});

admin.post("/purge", requireSuper, async (c) => {
  const { scopes, confirm } = await c.req.json();
  if (confirm !== "DELETE") return c.json({ error: 'Type DELETE to confirm.' }, 400);
  const want = (Array.isArray(scopes) ? scopes : []).filter((s) => PURGE[s]);
  if (!want.length) return c.json({ error: "Pick at least one thing to clear." }, 400);
  const stmts = [];
  for (const s of want) for (const sql of PURGE[s]) stmts.push(c.env.DB.prepare(sql));
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, cleared: want });
});
