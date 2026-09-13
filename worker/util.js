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

// The category groups a promo or a reward can be scoped to.
//
// One list, shared: a reward must never be able to name a scope a promo can't,
// or the admin would be offering two different meanings of "Fragrances".
// Anything outside these groups is written Storewide.
export const SCOPE_CATS = {
  Storewide: null,
  Fragrances: ["perfumes", "perfume-oils", "designer", "custom-oil", "mist"],
  "Gift packages": ["fragrance-set", "mist-set", "custom-oil-set", "gift-set"],
  "Feminine care": ["care", "deo"],
};

/** The category ids a scope covers — null meaning "no category filter". */
export function scopeCats(scope) {
  return SCOPE_CATS[scope] ?? null;
}

/** Is this line (by its category) inside that scope? */
export function inScope(scope, cat) {
  const cats = scopeCats(scope);
  return !cats || cats.includes(cat);
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

// Every store, or only the ones still trading. Stores are data now — nothing
// may assume a fixed set of three.
export async function allLocations(db) {
  return (await db.prepare("SELECT * FROM locations ORDER BY sort, id").all()).results;
}
export async function activeLocations(db) {
  return (await db.prepare("SELECT * FROM locations WHERE active=1 ORDER BY sort, id").all()).results;
}
export async function locationIds(db) {
  return (await activeLocations(db)).map((l) => l.id);
}

// The display label for a variation, built from its options — "50ml", or
// "50ml / Gold" when a product has a second axis. Stored back into
// variants.size, which stays the canonical label the rest of the app reads.
export function optionLabel(...options) {
  return options.map((o) => String(o ?? "").trim()).filter(Boolean).join(" / ");
}

// A readable, stable SKU from a product slug and an option label:
// ("dynasty", "50ml") -> "dynasty-50ml".
export function makeSku(productId, label) {
  const tail = String(label || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return tail ? `${productId}-${tail}` : productId;
}

// Load the full catalogue: products, their variations as SKU-level entities
// (own imagery, own price, own per-store stock), and the image gallery.
//
// liveOnly is the storefront's view — draft products and deactivated
// variations are dropped. Admin and the partner API load everything.
export async function loadProducts(db, { liveOnly = false } = {}) {
  const products = (await db.prepare(`SELECT * FROM products ${liveOnly ? "WHERE live=1" : ""} ORDER BY rowid`).all()).results;
  const variants = (await db.prepare(`SELECT * FROM variants ${liveOnly ? "WHERE active=1" : ""} ORDER BY sort, id`).all()).results;
  const stock = (await db.prepare("SELECT * FROM stock").all()).results;
  const images = (await db.prepare("SELECT * FROM product_images ORDER BY sort, id").all()).results;
  // Zero for every store that exists, so callers can read v.stock[anyStore]
  // without checking, however many stores the house has.
  const zeroes = Object.fromEntries((await allLocations(db)).map((l) => [l.id, 0]));

  const stockByVariant = {};
  for (const s of stock) {
    (stockByVariant[s.variant_id] ||= {})[s.location_id] = s.qty;
  }
  const imagesByProduct = {};
  for (const im of images) {
    (imagesByProduct[im.product_id] ||= []).push({ id: im.id, url: im.url, alt: im.alt, variantId: im.variant_id, sort: im.sort });
  }

  return products.map((p) => {
    const gallery = imagesByProduct[p.id] || [];
    let optionNames;
    try {
      optionNames = JSON.parse(p.option_names || '["Size"]');
    } catch {
      optionNames = ["Size"];
    }
    if (!Array.isArray(optionNames) || !optionNames.length) optionNames = ["Size"];

    return {
      id: p.id,
      name: p.name,
      cat: p.cat,
      brand: p.brand || "",
      gender: p.gender,
      family: p.family,
      notes: p.notes,
      desc: p.descr,
      imageUrl: p.image_url,
      live: !!p.live,
      createdAt: p.created_at,
      // Manual overrides on the computed shelves — see worker/merch.js.
      pinNew: !!p.pin_new,
      pinBest: !!p.pin_best,
      optionNames,
      splitListing: !!p.split_listing,
      externalId: p.external_id || null,
      externalSource: p.external_source || null,
      images: gallery.map((im) => ({ id: im.id, url: im.url, alt: im.alt, variantId: im.variantId })),
      variants: variants
        .filter((v) => v.product_id === p.id)
        .map((v) => {
          const own = gallery.filter((im) => im.variantId === v.id);
          return {
            id: v.id,
            sku: v.sku,
            size: v.size,
            options: [v.option1, v.option2, v.option3].filter((o) => o !== null && o !== undefined && o !== ""),
            ngn: v.price_ngn,
            compareAtNgn: v.compare_at_ngn || null,
            // The variation's own shot, falling back to the first image tagged
            // to it, then to the parent product's photo.
            imageUrl: v.image_url || (own[0] ? own[0].url : null) || p.image_url || null,
            images: own.map((im) => ({ id: im.id, url: im.url, alt: im.alt })),
            active: v.active === undefined ? true : !!v.active,
            // This variation's own low-stock line, or null for the store's.
            lowStockAt: v.low_stock_at === null || v.low_stock_at === undefined ? null : v.low_stock_at,
            sort: v.sort,
            externalId: v.external_id || null,
            stock: { ...zeroes, ...(stockByVariant[v.id] || {}) },
          };
        }),
    };
  });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

// ---- Promo scheduling ----
//
// The house and its customers are in Nigeria (UTC+1, no daylight saving), and
// a sale that reads "ends 20 August" should run to the end of that day *here*,
// not cut out at 1am because the server thinks in UTC. So the comparison is
// made against the current date in West Africa Time.
const WAT_OFFSET_MS = 60 * 60 * 1000;

export function todayInWAT(now = Date.now()) {
  return new Date(now + WAT_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * A wall-clock moment in West Africa Time → epoch milliseconds.
 *
 * Daily deals are scheduled to the minute rather than the day, so they need the
 * hour as well as the date. The house writes "2026-09-04T18:00" meaning six in
 * the evening *here*; this is the one place that knows that means 17:00 UTC.
 * NaN for anything unparseable — a caller treats that as "no window", which is
 * safer than a deal that silently runs forever.
 */
export function watToMs(local) {
  const s = String(local || "").trim().replace(" ", "T");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return NaN;
  return Date.parse(`${m[1]}T${m[2]}:${m[3]}:00Z`) - WAT_OFFSET_MS;
}

/** Epoch milliseconds → 'YYYY-MM-DDTHH:MM' in WAT, the form the admin edits. */
export function msToWat(ms) {
  return new Date(ms + WAT_OFFSET_MS).toISOString().slice(0, 16);
}

/** Midnight tonight, WAT, as epoch ms — where an unscheduled daily deal ends. */
export function endOfDayWAT(now = Date.now()) {
  return watToMs(todayInWAT(now) + "T00:00") + 86400000;
}

/**
 * Is this promo live right now?
 *
 * Status is still the manual switch ("End now" in the admin), and the dates are
 * the automatic one. Either can stop a code; neither alone can revive it.
 * A missing date means unbounded on that side, which is what every promo
 * created before this existed has, so none of them change behaviour.
 *
 * `ends_at` is inclusive — a code ending on the 20th works all day on the 20th.
 */
export function promoIsLive(promo, today = todayInWAT()) {
  if (!promo || promo.status !== "Active") return false;
  if (promo.starts_at && today < promo.starts_at) return false;
  if (promo.ends_at && today > promo.ends_at) return false;
  return true;
}

/** Why a code was refused, for a message a shopper can act on. */
export function promoRefusal(promo, today = todayInWAT()) {
  if (!promo) return "That code isn't recognised.";
  if (promo.starts_at && today < promo.starts_at) return "That sale hasn't started yet.";
  if (promo.ends_at && today > promo.ends_at) return "That code has expired.";
  return "That promo code isn't active.";
}
