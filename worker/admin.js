// Admin API — Bearer-token protected.
import { Hono } from "hono";
import {
  getSettings, putSettings, loadProducts, issueToken, verifyToken, displayTime, displayDate,
  hashPassword, verifyPassword, randomPassphrase, randomTotpSecret, totpVerify, otpauthUri,
} from "./util.js";

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
    const token = await issueToken(c.env.ADMIN_TOKEN_SECRET, { uid: u.id, role: u.role, scope: u.scope || null });
    return c.json({ token, role: roleLabel(u), name: u.name, scope: u.scope || null, mustChange: !!u.must_change, totpEnabled: !!u.totp_enabled });
  }

  // Master passphrase (break-glass super admin)
  if (password && c.env.ADMIN_PASSWORD && password === c.env.ADMIN_PASSWORD) {
    const token = await issueToken(c.env.ADMIN_TOKEN_SECRET, { uid: 0, role: "super", scope: null, master: true });
    return c.json({ token, role: "Super admin", name: "Master", scope: null, master: true });
  }
  return c.json({ error: "That's not the key to the house." }, 401);
});

admin.use("*", async (c, next) => {
  if (c.req.path.endsWith("/login")) return next();
  const auth = c.req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const claims = await verifyToken(c.env.ADMIN_TOKEN_SECRET, token);
  if (!claims) return c.json({ error: "Unauthorized" }, 401);
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

admin.post("/products", async (c) => {
  const { name, cat, size, price, notes, desc } = await c.req.json();
  if (!name || !String(name).trim() || !price || !parseInt(price, 10))
    return c.json({ error: "A name and a price are the minimum for a draft." }, 400);
  const db = c.env.DB;
  const id = "new-" + String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
  await db.prepare(
    "INSERT INTO products (id, name, cat, gender, family, notes, descr, live) VALUES (?, ?, ?, 'Unisex', 'Amber', ?, ?, 0)"
  ).bind(id, String(name).trim(), cat || "extrait", notes || "—", (desc || "").trim() || "A new addition to the house — description coming soon.").run();
  const vr = await db.prepare("INSERT INTO variants (product_id, size, price_ngn) VALUES (?, ?, ?)").bind(id, size || "30ml", parseInt(price, 10)).run();
  await db.batch(["abuja", "lagos", "ibadan"].map((l) =>
    db.prepare("INSERT INTO stock (variant_id, location_id, qty) VALUES (?, ?, 0)").bind(vr.meta.last_row_id, l)
  ));
  return c.json({ ok: true, id, name: String(name).trim() });
});

admin.patch("/products/:id", async (c) => {
  const { live } = await c.req.json();
  await c.env.DB.prepare("UPDATE products SET live=? WHERE id=?").bind(live ? 1 : 0, c.req.param("id")).run();
  return c.json({ ok: true });
});

admin.patch("/stock", async (c) => {
  const { productId, size, location, delta } = await c.req.json();
  const db = c.env.DB;
  const v = await db.prepare("SELECT id FROM variants WHERE product_id=? AND size=?").bind(productId, size).first();
  if (!v || !["abuja", "lagos", "ibadan"].includes(location)) return c.json({ error: "Unknown variant." }, 400);
  await db.prepare(
    `INSERT INTO stock (variant_id, location_id, qty) VALUES (?, ?, MAX(0, ?))
     ON CONFLICT(variant_id, location_id) DO UPDATE SET qty = MAX(0, qty + ?)`
  ).bind(v.id, location, delta, delta).run();
  const row = await db.prepare("SELECT qty FROM stock WHERE variant_id=? AND location_id=?").bind(v.id, location).first();
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
