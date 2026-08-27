# Majestic Roobee — Project Tracker

The running list of work: what shipped, what is next, and what is waiting on
someone. Seeded from the [requirements audit](./REQUIREMENTS-AUDIT.md) of
17 Aug 2026 so nothing in it gets lost.

**How to use this** — one line per item, newest sprint at the top. Move a line
between sections rather than deleting it; a shipped line keeps its date so we
can see what a month actually produced. The audit is the *finding*; this is the
*doing*. [`BUILD-MAP.md`](./BUILD-MAP.md) stays the architectural map.

**Status** `✅ Done` · `🔄 In progress` · `⬜ To do` · `🔑 Blocked — needs an account, key or decision`

---

## Sprint 1 — Hardening (17 Aug 2026) — ✅ shipped

The five items pulled from the audit's "do these first", plus the R2 move that
became possible mid-sprint when the bucket was created.

| # | Item | Status | What actually shipped |
|---|------|--------|----------------------|
| 1 | Rate-limit the admin login | ✅ | D1-backed sliding window (no KV on this Worker). Two buckets per attempt: 8 failures per identity per 15 min, 30 per IP — the second catches someone spraying one guess each across many usernames. A success clears the slate; a wrong 2FA code counts, a *missing* one doesn't. The master passphrase gets its own namespaced bucket, so the break-glass credential isn't the least-throttled thing on the box. Customer login and the reset request ride the same engine. |
| 2 | Enforce promo dates | ✅ | `starts_at` / `ends_at` as real ISO columns, backfilled from any old free text that parsed. Enforced against *today in West Africa Time*, so a sale ending the 20th runs all day on the 20th in Lagos rather than lapsing at 1am. End date inclusive; either bound optional. The admin form now uses date pickers, the list shows Active/Scheduled/Expired as the server computes it, and legacy free-text dates are flagged "not enforced" instead of silently running forever. |
| 3 | Dismissible promos for shoppers | ✅ | The announcement bar gained an ✕. Dismissal is keyed on the message itself, so the *next* promotion still shows rather than being suppressed by a dismissal of the last one. (The first-order pop-up already had one.) |
| 4 | Customer password reset | ✅ | Request → single-use hashed token (1 hour) → choose a new password → signed straight in. The request endpoint answers identically for known and unknown addresses, so it can't be used to test who shops here. Asking for a new link kills any outstanding one. Only the token's hash is stored. Sends via Resend the moment the key exists; until then the link is recorded in Admin → Integrations rather than lost, so the house can help someone today. |
| 5 | Images to R2 + responsive sizes | ✅ | Bytes now go to the `majesticroobee` bucket; `worker/media.js` reads R2 or D1 per row, so existing photos kept serving throughout and no stored URL changed. The admin's browser makes 200/400/800/1600px WebP copies at upload; `/images/<id>?w=` serves the narrowest that covers the request, rounding up so it stays sharp, and falling back to the original for anything uploaded before this existed. Admin → Integrations shows where the bytes live and moves the stragglers in batches. Measured: a 390px phone now pulls 1.4KB where it used to pull 11.2KB. |
| 6 | Content-Security-Policy | ✅ | Written against the pixel domains actually in use, plus Google Fonts, Paystack and the storefront's own bundles. `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`, `upgrade-insecure-requests`. Verified in a real browser on the storefront, shop, account and admin: zero violations, nothing blocked. |
| — | Tests | ✅ | `scripts/hardening.test.mjs` — 33 assertions covering promo windows (including the WAT boundary), throttle behaviour (lockout, clearing, spraying, bucket collision) and image width resolution (rounding, fallback, legacy, unknown). Gating the deploy alongside the fulfilment and payment suites. |

**Verified end to end** against a local Worker on a freshly migrated database:
throttle locks at the 9th attempt and 429s with a retry time · master passphrase
throttled separately and still works from a clean address · expired and future
codes refused with the right message while dateless codes keep working · a
backwards date range refused at creation · reset link works once and only once,
old password dead, new one live · derivative upload rejected for an unknown
parent · widths served correctly and the D1→R2 migration re-runnable and
idempotent · all four pages render with no CSP violations.

---

## Next up — the audit's "this month"

| Item | Status | Notes |
|---|---|---|
| Uptime + error monitoring | ⬜ | Nothing exists. You'd learn about an outage from a customer. Cheapest item on the list — an uptime check and Sentry's free tier. |
| Cloudflare WAF managed ruleset | 🔑 | Dashboard-only, and needs the custom domain attached. Steps in [BUILD-MAP §6](./BUILD-MAP.md). The app-level throttle from Sprint 1 is the inner layer; this is the outer one. |
| POS / WMS write endpoints | ⬜ | `/api/v1` is read-only apart from catalogue sync, so a POS can't write an in-store sale back and a warehouse system can't push a fulfilment status. Build when the first such system is chosen. |
| WhatsApp Business connector | 🔑 | Needs a BSP account (Wati or Interakt) and Meta template approval — allow 1–2 weeks for the templates. |
| Backup restore drill | ⬜ | Backups run daily, but an untested backup is a hypothesis. Also copy the artifacts off GitHub's retention window. |
| Email verification on signup | ⬜ | Rides the same Resend key as the reset flow. |

## Then — new capability

| Item | Status | Notes |
|---|---|---|
| Gift cards | ⬜ | Explicitly requested, wholly absent. Issue, redeem as a tender type, balance ledger, partial redemption, expiry. |
| Customer reviews + moderation | ⬜ | Zero code today. Unblocks review markup, star ratings in search results and Shopping seller ratings. Recommended in-house — see the audit. |
| Fragrance finder quiz | ⬜ | Highest-impact discovery feature; also feeds personalisation later. |
| Gift finder | ⬜ | Recipient / occasion / budget. Cheap on the existing filters. |
| Sample & discovery sets | ⬜ | Collections are live; sample-size SKUs and build-your-own are not. |
| Loyalty + referral ledger | ⬜ | The event backbone already emits what a points ledger consumes. |
| Unified CRM profile | ⬜ | Stitch orders, inquiries, leads and abandoned carts into one profile per identity. |
| SSR / pre-render for product pages | ⬜ | The biggest remaining SEO item — Google copes with client rendering, Bing and link previews don't. |
| Promo usage limits | ⬜ | Dates are enforced now; usage caps, per-customer limits, minimum spend and auto-apply are not. |
| Discount stacking rules | ⬜ | Currently one code at a time, no interaction rules. |

## Later — when the business calls for it

| Item | Status | Notes |
|---|---|---|
| Stripe + true multi-currency | 🔑 | The server hard-codes NGN by design. Needs a decision on whether international selling is a 2026 or 2027 goal — the most expensive item in the audit. |
| Live FX rate source | 🔑 | Today the USD rate is typed in by hand and goes stale. |
| Consultation booking | ⬜ | Cheapest version is an embedded scheduling link. |
| Product comparison & layering | ⬜ | Data model is ready (notes, worn-by, family, price per variation). |
| Personalised recommendations | ⬜ | After the quiz, which is what feeds it. |
| Customer 2FA | ⬜ | Lower priority than reset, which shipped in Sprint 1. |
| Stock transfers & purchase orders | ⬜ | Plus a stock audit log and low-stock reorder alerts. |
| PWA / native app | ⬜ | A mobile app can already be built against `/api/v1`. |
| Malware scanning on uploads | ⬜ | The type filter trusts the browser's declared content type. Tighten before user-supplied review photos ship. |

---

## Waiting on you

These cannot be done from the code, and several unblock work that is already built.

| # | Action | Unblocks | Effort |
|---|--------|----------|--------|
| 1 | Paste the six analytics IDs into **Admin → Settings** (GA4, Google Ads + conversion label, Meta, TikTok, Clarity) | All measurement. Every tag is written and consent-gated; none of them exist until the IDs are in. | 15 min |
| 2 | Add `RESEND_API_KEY` as a Worker secret | Seven built automations, **and** password-reset emails sending by themselves | 10 min |
| 3 | Deploy the Cloudflare WAF managed ruleset + a rate-limiting rule | The outer security layer | 15 min, dashboard |
| 4 | Claim the Search Console property and submit `/sitemap.xml` | Search visibility reporting | 15 min |
| 5 | Add the live Paystack key when ready to take real money | Real card payments (test mode works today) | 5 min |
| 6 | Decide: international selling in 2026, or not? | Sizes the Stripe + multi-currency project, or takes it off the list | A conversation |

---

## Change log

- **17 Aug 2026** — Tracker created. Audited the platform against the client's
  requirements, corrected four drifted rows in the build map, then shipped
  Sprint 1: login throttling, enforced promo dates with a dismissible
  announcement bar, customer password reset, images moved to R2 with responsive
  widths, and a Content-Security-Policy. R2 was enabled on the account
  mid-sprint, which turned the image item from "R2-ready with a D1 fallback"
  into an actual migration.
