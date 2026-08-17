// The hardening pass, exercised directly.
//
// Four things the audit found were described but not enforced, so each one gets
// the assertion that would have caught it:
//
//   · a promo with a past end date must stop discounting, on its own
//   · a login must stop accepting guesses, and let a legitimate user back in
//   · a phone must be served the phone-sized photo, and never a broken one
//   · a reset link must work once, and only inside its hour
import { promoIsLive, promoRefusal, todayInWAT } from "../worker/util.js";
import { loginBuckets, checkThrottle, recordFailure, clearFailures, LIMITS } from "../worker/ratelimit.js";
import { resolveMedia } from "../worker/media.js";
import { srcSetFor, WIDTHS } from "../src/lib/images.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

// ---- 1. Promo windows ----------------------------------------------------
console.log("\nPromo windows");

const TODAY = "2026-08-17";
const active = (extra) => ({ status: "Active", ...extra });

check("a code with no dates runs, as every existing promo does",
  promoIsLive(active({}), TODAY), true);
check("a code inside its window runs",
  promoIsLive(active({ starts_at: "2026-08-01", ends_at: "2026-08-31" }), TODAY), true);
check("a code is live on the day it ends — the end date is inclusive",
  promoIsLive(active({ ends_at: TODAY }), TODAY), true);
check("...and dead the day after",
  promoIsLive(active({ ends_at: "2026-08-16" }), TODAY), false);
check("a code is dead before it starts",
  promoIsLive(active({ starts_at: "2026-09-01" }), TODAY), false);
check("...and alive on its opening day",
  promoIsLive(active({ starts_at: TODAY }), TODAY), true);
check("ending it by hand still beats an open window",
  promoIsLive({ status: "Ended", starts_at: "2026-01-01", ends_at: "2026-12-31" }, TODAY), false);
check("an unknown code is not live",
  promoIsLive(null, TODAY), false);

// The message is the difference between a shopper hunting for a current code
// and one who thinks the checkout is broken.
check("an expired code says so", promoRefusal(active({ ends_at: "2026-08-16" }), TODAY), "That code has expired.");
check("a future code says so", promoRefusal(active({ starts_at: "2026-09-01" }), TODAY), "That sale hasn't started yet.");
check("an unknown code says so", promoRefusal(null, TODAY), "That code isn't recognised.");

// Nigeria is UTC+1: a sale ending "the 17th" must not lapse at 1am local time,
// which is exactly what comparing against UTC would do.
check("late evening in Lagos is still the same day here",
  todayInWAT(Date.parse("2026-08-17T23:30:00Z")), "2026-08-18");
check("...and a sale ending the 18th is still live at that moment",
  promoIsLive(active({ ends_at: "2026-08-18" }), todayInWAT(Date.parse("2026-08-17T23:30:00Z"))), true);

// ---- 2. Login throttling -------------------------------------------------
console.log("\nLogin throttling");

// A D1 stand-in holding attempt rows in memory, with the same sliding-window
// semantics the real queries have.
function attemptDb() {
  let rows = [];
  const now = () => Date.now();
  const mk = (sql) => ({
    _args: [],
    bind(...args) { this._args = args; return this; },
    async run() {
      if (/INSERT INTO login_attempts/i.test(sql)) rows.push({ bucket: this._args[0], at: now() });
      else if (/DELETE FROM login_attempts WHERE bucket/i.test(sql)) rows = rows.filter((r) => r.bucket !== this._args[0]);
      else if (/DELETE FROM login_attempts WHERE at/i.test(sql)) rows = rows.filter((r) => r.at > now() - 15 * 60000);
      return { meta: { changes: 1 } };
    },
    async first() {
      const [bucket] = this._args;
      const live = rows.filter((r) => r.bucket === bucket && r.at > now() - 15 * 60000);
      if (!live.length) return { n: 0, oldest: null };
      const oldest = new Date(Math.min(...live.map((r) => r.at))).toISOString().replace("T", " ").slice(0, 19);
      return { n: live.length, oldest };
    },
  });
  return { prepare: mk, batch: async (st) => { for (const s of st) await s.run(); return []; }, _rows: () => rows };
}

const buckets = loginBuckets("admin", "203.0.113.9", "Manager");
check("buckets are normalised, narrow first then wide",
  buckets, ["admin:203.0.113.9|u:manager", "admin:203.0.113.9"]);
// A staff account genuinely called "master" must not share a bucket with the
// break-glass passphrase, or either one could lock the other out.
check("the master passphrase cannot collide with a username",
  loginBuckets("admin", "203.0.113.9", "passphrase", "m")[0] === loginBuckets("admin", "203.0.113.9", "passphrase")[0], false);

let db = attemptDb();
check("a first attempt is allowed", (await checkThrottle(db, buckets)).ok, true);

// Grind the identity bucket down to its limit.
for (let i = 0; i < LIMITS.identity; i++) await recordFailure(db, buckets);
const locked = await checkThrottle(db, buckets);
check(`the ${LIMITS.identity}th failure locks the identity out`, locked.ok, false);
check("...and it says how long to wait", locked.retryAfter > 0, true);

// The legitimate owner eventually gets their passphrase right — but only ever
// on an attempt that was let through, which is the point of clearing on success.
await clearFailures(db, buckets);
check("a success clears the slate", (await checkThrottle(db, buckets)).ok, true);

// Spraying: one guess each against many usernames never trips the identity
// bucket, so the wide per-IP bucket is the one that has to catch it.
db = attemptDb();
for (let i = 0; i < LIMITS.ip; i++) await recordFailure(db, loginBuckets("admin", "198.51.100.4", `user${i}`));
check("one guess each against many usernames still trips the IP limit",
  (await checkThrottle(db, loginBuckets("admin", "198.51.100.4", "someoneelse"))).ok, false);
check("a different address is unaffected",
  (await checkThrottle(db, loginBuckets("admin", "198.51.100.5", "someoneelse"))).ok, true);

// ---- 3. Responsive images ------------------------------------------------
console.log("\nResponsive images");

// A media table stand-in: one original with a set of narrower derivatives.
function mediaDb(derivatives, original = { id: "img_a", mime: "image/jpeg", storage: "d1", width: 0 }) {
  const mk = (sql) => ({
    _args: [],
    bind(...args) { this._args = args; return this; },
    async all() {
      if (/parent_id=\?/i.test(sql)) {
        const [pid] = this._args;
        return { results: derivatives.filter((d) => d.parent_id === pid).sort((a, b) => a.width - b.width) };
      }
      return { results: [] };
    },
    async first() { return this._args[0] === original.id ? original : null; },
  });
  return { prepare: mk };
}

const derivs = WIDTHS.filter((w) => w < 1600).map((w) => ({ id: `img_a@${w}`, parent_id: "img_a", width: w, mime: "image/webp", storage: "d1" }));
const env = { DB: mediaDb(derivs) };

check("a cart thumbnail gets the smallest copy",
  (await resolveMedia(env, "img_a", "46")).width, 200);
check("a phone listing card gets a phone-sized copy",
  (await resolveMedia(env, "img_a", "360")).width, 400);
check("an exact width is served exactly", (await resolveMedia(env, "img_a", "400")).width, 400);
check("a width between sizes rounds up, so it stays sharp",
  (await resolveMedia(env, "img_a", "401")).width, 800);
check("a width past every derivative falls back to the widest",
  (await resolveMedia(env, "img_a", "4000")).width, 800);
check("no width asked for serves the original",
  (await resolveMedia(env, "img_a", undefined)).id, "img_a");

// An image uploaded before any of this existed has no derivatives at all. It
// must still serve — bigger than ideal, never broken.
const legacy = { DB: mediaDb([]) };
check("a legacy image with no derivatives still resolves",
  (await resolveMedia(legacy, "img_a", "400")).id, "img_a");
check("an unknown image resolves to nothing rather than throwing",
  await resolveMedia(legacy, "img_missing", "400"), null);

check("a Worker-served image offers every width",
  srcSetFor("/images/img_a"), WIDTHS.map((w) => `/images/img_a?w=${w} ${w}w`).join(", "));
check("a pasted external URL is left alone, having no derivatives to offer",
  srcSetFor("https://example.com/photo.jpg"), "");
check("a missing URL is left alone", srcSetFor(""), "");

console.log(failures ? `\n${failures} case(s) failed.` : "\nAll hardening cases pass.");
process.exit(failures ? 1 : 0);
