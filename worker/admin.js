// Admin API — Bearer-token protected.
import { Hono } from "hono";
import {
  getSettings, putSettings, loadProducts, issueToken, verifyToken, displayTime, displayDate,
  hashPassword, verifyPassword, randomPassphrase, randomTotpSecret, totpVerify, otpauthUri, sha256hex,
} from "./util.js";
import { emitEvent } from "./events.js";

const randHex = (n = 24) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

export const admin = new Hono();

const roleLabel = (u) => (u.role === "super" ? "Super admin" : `${(u.scope || "").charAt(0).toUpperCase() + (u.scope || "").slice(1)} manager`);

admin.post("/login", async (c) => {
  const { username, password, totp } = await c.req.json();
  const db = c.env.DB;

  // Per-user account login
  if (username) {
    const u = await db.prepare("SELECT * FROM admin_users WHERE username=? AND active=1").bind(String(username).trim().toLowerCase()).first();
    if (!u || !(await verifyPassword(password || "", u.pass_salt, u.pass_hash))) {
      return c.json({ error: "That username or passphrase isn't right." }, 401);
    }
    if (u.totp_enabled) {
      if (!totp) return c.json({ error: "2FA required.", needTotp: true }, 401);
      if (!(await totpVerify(u.totp_secret, totp))) return c.json({ error: "That 2FA code isn't right.", needTotp: true }, 401);
    }
    await db.prepare("UPDATE admin_users SET last_login=datetime('now') WHERE id=?").bind(u.id).run();
    const token = await issueToken(c.env.ADMIN_TOKEN_SECRET, { typ: "admin", uid: u.id, role: u.role, scope: u.scope || null });
    return c.json({ token, role: roleLabel(u), name: u.name, scope: u.scope || null, mustChange: !!u.must_change, totpEnabled: !!u.totp_enabled });
  }

  // Master passphrase (break-glass super admin)
  if (password && c.env.ADMIN_PASSWORD && password === c.env.ADMIN_PASSWORD) {
    const token = await issueToken(c.env.ADMIN_TOKEN_SECRET, { typ: "admin", uid: 0, role: "super", scope: null, master: true });
    return c.json({ token, role: "Super admin", name: "Master", scope: null, master: true });
  }
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
  if (role === "manager" && !["abuja", "lagos", "ibadan"].includes(scope)) return c.json({ error: "Managers need a store." }, 400);
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
  const TH = settings.lowStockThreshold ?? 5;
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

  // Stock health.
  const products = await loadProducts(db);
  let lowCount = 0, outCount = 0;
  for (const p of products) for (const v of p.variants) {
    const t = scope ? (v.stock[scope] || 0) : v.stock.abuja + v.stock.lagos + v.stock.ibadan;
    if (t === 0) outCount++;
    else if (t <= TH) lowCount++;
  }

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
    orders: orders.map((o) => ({
      no: o.no, customer: o.customer, phone: o.phone, email: o.email, city: o.city,
      fulfilledFrom: o.fulfilled_from, method: o.method, pay: o.pay, payStatus: o.pay_status,
      status: o.status, total: o.total, placed: displayDate(new Date(o.placed_at.replace(" ", "T") + "Z")),
    })),
    abandoned: abandoned.map((a) => ({
      name: a.name, phone: a.phone, email: a.email, city: a.city, value: a.value_ngn, stage: a.stage, time: relTime(a.updated_at),
    })),
  });
});

admin.get("/products", async (c) => c.json({ products: await loadProducts(c.env.DB) }));

const LOCS = ["abuja", "lagos", "ibadan"];

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
    .map((v) => ({ size: String(v.size || "").trim(), price: parseInt(v.price, 10) || 0, stock: v.stock || {} }))
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
  const cat = String(b.cat || "extrait").trim();
  const catRow = await db.prepare("SELECT id FROM categories WHERE id=?").bind(cat).first();
  if (!catRow) {
    const all = await db.prepare("SELECT id FROM categories ORDER BY sort").all();
    return c.json({ error: `"${cat}" isn't one of the categories. Pick one of: ${all.results.map((r) => r.id).join(", ")}.` }, 400);
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
  const exists = await db.prepare("SELECT id FROM products WHERE id=?").bind(slug).first();
  const id = exists ? `${slug}-${Date.now().toString(36)}` : slug;

  await db.prepare(
    "INSERT INTO products (id, name, cat, gender, family, notes, descr, image_url, live) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    id, name, cat, b.gender || "Unisex", b.family || "Amber",
    (b.notes || "").trim() || "—",
    (b.desc || "").trim() || "A new addition to the house — description coming soon.",
    (b.imageUrl || "").trim() || null,
    b.live ? 1 : 0
  ).run();

  for (const v of variants) {
    const vr = await db.prepare("INSERT INTO variants (product_id, size, price_ngn) VALUES (?, ?, ?)").bind(id, v.size, v.price).run();
    await db.batch(LOCS.map((l) =>
      db.prepare("INSERT INTO stock (variant_id, location_id, qty) VALUES (?, ?, ?)")
        .bind(vr.meta.last_row_id, l, Math.max(0, parseInt(v.stock[l], 10) || 0))
    ));
  }
  return c.json({ ok: true, id, name, live: !!b.live });
});

// Add a size to an existing product.
admin.post("/products/:id/variants", async (c) => {
  const { size, price, stock } = await c.req.json();
  const pid = c.req.param("id");
  const s = String(size || "").trim();
  const p = parseInt(price, 10) || 0;
  if (!s || !p) return c.json({ error: "A size and a price are required." }, 400);
  const db = c.env.DB;
  const dupe = await db.prepare("SELECT id FROM variants WHERE product_id=? AND lower(size)=lower(?)").bind(pid, s).first();
  if (dupe) return c.json({ error: "That size already exists on this product." }, 400);
  const vr = await db.prepare("INSERT INTO variants (product_id, size, price_ngn) VALUES (?, ?, ?)").bind(pid, s, p).run();
  await db.batch(LOCS.map((l) =>
    db.prepare("INSERT INTO stock (variant_id, location_id, qty) VALUES (?, ?, ?)")
      .bind(vr.meta.last_row_id, l, Math.max(0, parseInt((stock || {})[l], 10) || 0))
  ));
  return c.json({ ok: true, id: vr.meta.last_row_id });
});

admin.delete("/variants/:id", async (c) => {
  const vid = parseInt(c.req.param("id"), 10);
  const db = c.env.DB;
  const v = await db.prepare("SELECT product_id FROM variants WHERE id=?").bind(vid).first();
  if (!v) return c.json({ error: "No such size." }, 404);
  const count = await db.prepare("SELECT COUNT(*) AS n FROM variants WHERE product_id=?").bind(v.product_id).first();
  if (count.n <= 1) return c.json({ error: "A product needs at least one size — delete the product instead." }, 400);
  await db.batch([
    db.prepare("DELETE FROM stock WHERE variant_id=?").bind(vid),
    db.prepare("DELETE FROM variants WHERE id=?").bind(vid),
  ]);
  return c.json({ ok: true });
});

// Edit any product field (live toggle, name, category, family, gender, notes,
// description, image). Only the fields present in the body are changed.
admin.patch("/products/:id", async (c) => {
  const b = await c.req.json();
  const map = { live: "live", name: "name", cat: "cat", family: "family", gender: "gender", notes: "notes", desc: "descr", imageUrl: "image_url" };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) { sets.push(`${col}=?`); vals.push(k === "live" ? (b[k] ? 1 : 0) : b[k]); }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(c.req.param("id"));
  await c.env.DB.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  return c.json({ ok: true });
});

admin.patch("/variants/:id", async (c) => {
  const { price } = await c.req.json();
  const p = parseInt(price, 10);
  if (!p || p < 0) return c.json({ error: "A valid price is required." }, 400);
  await c.env.DB.prepare("UPDATE variants SET price_ngn=? WHERE id=?").bind(p, parseInt(c.req.param("id"), 10)).run();
  return c.json({ ok: true });
});

admin.delete("/products/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;
  const vs = (await db.prepare("SELECT id FROM variants WHERE product_id=?").bind(id).all()).results;
  const stmts = vs.map((v) => db.prepare("DELETE FROM stock WHERE variant_id=?").bind(v.id));
  stmts.push(db.prepare("DELETE FROM variants WHERE product_id=?").bind(id));
  stmts.push(db.prepare("DELETE FROM wishlists WHERE product_id=?").bind(id));
  stmts.push(db.prepare("DELETE FROM products WHERE id=?").bind(id));
  await db.batch(stmts);
  return c.json({ ok: true });
});

admin.patch("/stock", async (c) => {
  const { productId, size, location, delta } = await c.req.json();
  const db = c.env.DB;
  const v = await db.prepare("SELECT id FROM variants WHERE product_id=? AND size=?").bind(productId, size).first();
  if (!v || !["abuja", "lagos", "ibadan"].includes(location)) return c.json({ error: "Unknown variant." }, 400);
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
  return c.json({ promos: rows.map((p) => ({ code: p.code, kind: p.kind, value: p.value, desc: p.descr, scope: p.scope, starts: p.starts, ends: p.ends, status: p.status, redemptions: p.redemptions })) });
});

admin.post("/promos", async (c) => {
  const { code, kind, value, scope, starts, ends } = await c.req.json();
  const cleanCode = String(code || "").toUpperCase().replace(/\s/g, "");
  const v = parseInt(value, 10) || 0;
  if (!cleanCode || (!v && kind !== "ship")) return c.json({ error: "A code and a value make a sale." }, 400);
  const descr = kind === "pct" ? `${v}% off` : kind === "amt" ? `₦${v.toLocaleString("en-US")} off` : "Free delivery";
  await c.env.DB.prepare(
    `INSERT INTO promos (code, kind, value, descr, scope, starts, ends, status, redemptions) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', 0)
     ON CONFLICT(code) DO UPDATE SET kind=excluded.kind, value=excluded.value, descr=excluded.descr, scope=excluded.scope,
       starts=excluded.starts, ends=excluded.ends, status='Active'`
  ).bind(cleanCode, kind || "pct", v, descr, scope || "Storewide", starts || "Today", ends || "Until ended").run();
  return c.json({ ok: true });
});

admin.post("/promos/:code/end", async (c) => {
  await c.env.DB.prepare("UPDATE promos SET status='Ended' WHERE code=?").bind(c.req.param("code")).run();
  return c.json({ ok: true });
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

admin.get("/inquiries", async (c) => {
  const db = c.env.DB;
  const inqs = (await db.prepare("SELECT * FROM inquiries ORDER BY created_at DESC").all()).results;
  const msgs = (await db.prepare("SELECT * FROM inquiry_messages ORDER BY created_at, id").all()).results;
  return c.json({
    inquiries: inqs.map((q) => ({
      id: q.id, name: q.name, contact: q.contact, channel: q.channel, subject: q.subject, city: q.city,
      status: q.status, time: relTime(q.created_at),
      thread: msgs.filter((m) => m.inquiry_id === q.id).map((m) => ({ from: m.from_us ? "us" : "them", text: m.text })),
    })),
  });
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

admin.get("/settings", async (c) => {
  const db = c.env.DB;
  const settings = await getSettings(db);
  const locations = (await db.prepare("SELECT * FROM locations ORDER BY sort").all()).results.map((l) => ({
    id: l.id, city: l.city, store: l.store, address: l.address, eta: l.eta, phone: l.phone,
  }));
  return c.json({ settings, locations });
});

admin.put("/settings", async (c) => {
  const { settings, locations } = await c.req.json();
  const db = c.env.DB;
  const allowed = [
    "announcement", "heroHeadline", "heroSub", "footerTagline", "igUrl", "igHandle",
    "contactPhone", "contactEmail", "contactHours", "ngnPerUsd", "lowStockThreshold",
    // SEO
    "siteName", "metaDescription", "ogImage",
    // Marketing & analytics tags
    "ga4Id", "metaPixelId", "tiktokPixelId", "googleAdsId", "googleAdsPurchaseLabel", "clarityId", "gscVerification",
    // Storefront look & behaviour
    "heroDirection", "promoPopup", "defaultCity", "crossCityShipNGN", "crossCityEta", "freeShipAbujaOver",
  ];
  const patch = {};
  for (const k of allowed) if (settings && settings[k] !== undefined) patch[k] = settings[k];
  const next = await putSettings(db, patch);
  if (Array.isArray(locations)) {
    await db.batch(locations
      .filter((l) => ["abuja", "lagos", "ibadan"].includes(l.id))
      .map((l) => db.prepare("UPDATE locations SET store=?, address=?, eta=?, phone=? WHERE id=?").bind(l.store, l.address, l.eta, l.phone, l.id)));
  }
  return c.json({ ok: true, settings: next });
});

// ---- Media (product imagery) ----
// Upload the raw file as the request body with its content-type. Stored in D1
// and served from /images/<id>; the URL shape is stable if storage moves to R2.
const MAX_IMAGE_BYTES = 1_500_000;

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
  const id = "img_" + randHex(8);
  await c.env.DB.prepare("INSERT INTO media (id, mime, bytes, size, alt) VALUES (?, ?, ?, ?, ?)")
    .bind(id, mime, buf, buf.byteLength, (c.req.header("x-alt") || "").slice(0, 200)).run();
  return c.json({ ok: true, id, url: `/images/${id}`, size: buf.byteLength });
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
const PURGE = {
  orders: ["DELETE FROM order_events", "DELETE FROM order_items", "DELETE FROM orders"],
  customers: ["DELETE FROM wishlists", "DELETE FROM customer_addresses", "DELETE FROM customers"],
  inquiries: ["DELETE FROM inquiry_messages", "DELETE FROM inquiries"],
  checkouts: ["DELETE FROM abandoned_checkouts"],
  marketing: ["DELETE FROM promos", "DELETE FROM campaigns", "DELETE FROM leads"],
  activity: ["DELETE FROM automation_runs", "DELETE FROM events", "DELETE FROM stock_waitlist"],
  products: ["DELETE FROM stock", "DELETE FROM variants", "DELETE FROM wishlists", "DELETE FROM products"],
};

admin.get("/data-counts", requireSuper, async (c) => {
  const q = async (sql) => (await c.env.DB.prepare(sql).first()).n;
  return c.json({
    orders: await q("SELECT COUNT(*) AS n FROM orders"),
    customers: await q("SELECT COUNT(*) AS n FROM customers"),
    inquiries: await q("SELECT COUNT(*) AS n FROM inquiries"),
    checkouts: await q("SELECT COUNT(*) AS n FROM abandoned_checkouts"),
    marketing: await q("SELECT (SELECT COUNT(*) FROM promos)+(SELECT COUNT(*) FROM campaigns)+(SELECT COUNT(*) FROM leads) AS n"),
    activity: await q("SELECT (SELECT COUNT(*) FROM events)+(SELECT COUNT(*) FROM automation_runs) AS n"),
    products: await q("SELECT COUNT(*) AS n FROM products"),
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
