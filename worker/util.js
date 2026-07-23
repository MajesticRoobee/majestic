// Shared helpers: settings, auth tokens, misc.

const te = new TextEncoder();

export async function getSettings(db) {
  const row = await db.prepare("SELECT value FROM settings WHERE key='site'").first();
  return row ? JSON.parse(row.value) : {};
}

export async function putSettings(db, patch) {
  const cur = await getSettings(db);
  const next = { ...cur, ...patch };
  await db
    .prepare("INSERT INTO settings (key, value) VALUES ('site', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(JSON.stringify(next))
    .run();
  return next;
}

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, te.encode(msg)));
}

export async function issueToken(secret, ttlSeconds = 60 * 60 * 12) {
  const payload = b64url(te.encode(JSON.stringify({ exp: Date.now() + ttlSeconds * 1000 })));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyToken(secret, token) {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if ((await hmac(secret, payload)) !== sig) return false;
  try {
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function normalizeContact(s) {
  return String(s || "").toLowerCase().replace(/[\s\-()]/g, "");
}

export function fmtNaira(n) {
  return "₦" + Number(n).toLocaleString("en-US");
}

// "Jul 14, 9:12 AM" — display timestamps for order timelines (WAT).
export function displayTime(date = new Date()) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).replace(" at ", ", ");
}

export function displayDate(date = new Date()) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Lagos" });
}

// Load full product list with variants + per-location stock.
export async function loadProducts(db, { liveOnly = false } = {}) {
  const products = (await db.prepare(`SELECT * FROM products ${liveOnly ? "WHERE live=1" : ""} ORDER BY rowid`).all()).results;
  const variants = (await db.prepare("SELECT * FROM variants ORDER BY id").all()).results;
  const stock = (await db.prepare("SELECT * FROM stock").all()).results;
  const stockByVariant = {};
  for (const s of stock) {
    (stockByVariant[s.variant_id] ||= {})[s.location_id] = s.qty;
  }
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    cat: p.cat,
    gender: p.gender,
    family: p.family,
    notes: p.notes,
    desc: p.descr,
    imageUrl: p.image_url,
    live: !!p.live,
    variants: variants
      .filter((v) => v.product_id === p.id)
      .map((v) => ({ id: v.id, size: v.size, ngn: v.price_ngn, stock: { abuja: 0, lagos: 0, ibadan: 0, ...(stockByVariant[v.id] || {}) } })),
  }));
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}
