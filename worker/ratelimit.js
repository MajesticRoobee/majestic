// Login throttling.
//
// The audit found nothing anywhere in this Worker throttling anything, so
// /api/admin/login would accept passphrase guesses until the heat death of the
// universe. Cloudflare rate-limiting rules are the right outer layer and are
// still worth turning on, but they are a dashboard setting that does not exist
// in this repo, cannot be tested here, and does not apply on workers.dev. This
// is the layer that ships with the code.
//
// There is no KV binding on this Worker, so the counter is a D1 table: one row
// per failed attempt, counted inside a sliding window.

// A failure is remembered for this long; the limit is per window.
const WINDOW_MINUTES = 15;

// Deliberately different limits for the two bucket shapes. A human mistyping
// their own passphrase rarely does it eight times in a quarter of an hour; an
// attacker spraying one guess each across many usernames never trips that
// bucket at all, which is what the wider per-IP limit is for.
export const LIMITS = { identity: 8, ip: 30 };

const clean = (s) => String(s == null ? "" : s).trim().toLowerCase().slice(0, 120);

// Cloudflare sets CF-Connecting-IP on every request that reaches the edge.
// Locally it is absent, so throttling falls back to a single shared bucket —
// which is fine for `wrangler dev` and is what the tests exercise.
export function clientIp(req) {
  return req.header("cf-connecting-ip") || req.header("x-forwarded-for") || "local";
}

// The two buckets a login attempt belongs to: the narrow one (this IP against
// this identity) and the wide one (this IP against anything).
//
// `kind` separates namespaces that could otherwise collide — a real staff
// account called "master" must not share a bucket with the master passphrase,
// and nothing validates usernames, so the two are kept apart structurally
// rather than by hoping no one picks that name.
export function loginBuckets(scope, ip, identity, kind = "u") {
  const wide = `${scope}:${clean(ip)}`;
  return identity ? [`${wide}|${kind}:${clean(identity)}`, wide] : [wide];
}

/**
 * Is this attempt allowed through? Call *before* checking the credential.
 * Returns { ok: true } or { ok: false, retryAfter } in seconds.
 */
export async function checkThrottle(db, buckets) {
  const since = `-${WINDOW_MINUTES} minutes`;
  for (let i = 0; i < buckets.length; i++) {
    // buckets[0] is the narrow identity bucket, the rest are wider.
    const limit = i === 0 && buckets.length > 1 ? LIMITS.identity : LIMITS.ip;
    const row = await db
      .prepare("SELECT COUNT(*) AS n, MIN(at) AS oldest FROM login_attempts WHERE bucket=? AND at > datetime('now', ?)")
      .bind(buckets[i], since)
      .first();
    if (row && row.n >= limit) {
      // Locked out until the oldest attempt in the window ages out.
      const oldest = Date.parse(String(row.oldest).replace(" ", "T") + "Z");
      const retryAfter = Math.max(30, Math.ceil((oldest + WINDOW_MINUTES * 60000 - Date.now()) / 1000));
      return { ok: false, retryAfter };
    }
  }
  return { ok: true };
}

/** Record a failure against every bucket the attempt belongs to. */
export async function recordFailure(db, buckets) {
  await db.batch(buckets.map((b) => db.prepare("INSERT INTO login_attempts (bucket, at) VALUES (?, datetime('now'))").bind(b)));
  // Opportunistic sweep, so this table never needs a cron of its own. Cheap:
  // it only ever runs on a failed login, which is rare and already slow.
  await db.prepare("DELETE FROM login_attempts WHERE at <= datetime('now', ?)").bind(`-${WINDOW_MINUTES} minutes`).run();
}

/** A success clears the slate, so a legitimate user is never half-locked. */
export async function clearFailures(db, buckets) {
  await db.batch(buckets.map((b) => db.prepare("DELETE FROM login_attempts WHERE bucket=?").bind(b)));
}

/**
 * The whole dance for one credential check, so no caller can forget a step.
 * `verify` is an async function returning the success value (anything truthy)
 * or a falsy value for "wrong credential".
 *
 * Returns { locked, retryAfter } when throttled, else { result }.
 */
export async function throttled(db, buckets, verify) {
  const gate = await checkThrottle(db, buckets);
  if (!gate.ok) return { locked: true, retryAfter: gate.retryAfter };
  const result = await verify();
  if (result) await clearFailures(db, buckets);
  else await recordFailure(db, buckets);
  return { locked: false, result };
}

// The message a locked-out caller sees. Deliberately says nothing about
// whether the identity exists — only that this client is being slowed down.
export function lockedMessage(retryAfter) {
  const mins = Math.ceil(retryAfter / 60);
  return `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}
