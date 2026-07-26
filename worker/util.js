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

function b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64url(buf) {
  return b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64(s) {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, te.encode(msg)));
}

// Signed session token carrying claims ({ uid, role, scope }).
export async function issueToken(secret, claims = {}, ttlSeconds = 60 * 60 * 12) {
  const payload = b64url(te.encode(JSON.stringify({ ...claims, exp: Date.now() + ttlSeconds * 1000 })));
  return `${payload}.${await hmac(secret, payload)}`;
}

// Returns the claims object if valid, else null.
export async function verifyToken(secret, token) {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if ((await hmac(secret, payload)) !== sig) return null;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof claims.exp !== "number" || claims.exp <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

// ---- Password hashing (PBKDF2-SHA256) ----
export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return { salt: b64(salt), hash: b64(bits) };
}
export async function verifyPassword(password, saltB64, hashB64) {
  const { hash } = await hashPassword(password, saltB64);
  // constant-time-ish compare
  if (hash.length !== hashB64.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ hashB64.charCodeAt(i);
  return diff === 0;
}

// Human-friendly issued passphrase, e.g. "roobee-7f3a-9c21".
export function randomPassphrase() {
  const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(2))).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `roobee-${hex()}-${hex()}`;
}

// ---- TOTP (RFC 6238, SHA-1, 6 digits, 30s) ----
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function randomTotpSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let out = "";
  for (const b of bytes) out += B32[b % 32];
  return out;
}
function base32Decode(s) {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = "";
  for (const c of clean) {
    const v = B32.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}
async function totpAt(secret, counter) {
  const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(4, counter);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return (bin % 1000000).toString().padStart(6, "0");
}
export async function totpVerify(secret, code, window = 1) {
  if (!secret || !/^\d{6}$/.test(String(code || ""))) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (await totpAt(secret, counter + w) === code) return true;
  }
  return false;
}
export function otpauthUri(secret, label, issuer = "Majestic Roobee") {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6`;
}

export function normalizeContact(s) {
  return String(s || "").toLowerCase().replace(/[\s\-()]/g, "");
}

export async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", te.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
