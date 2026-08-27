# Majestic Roobee — Requirements Audit

**Date:** 17 August 2026 · **Audited against:** the working tree at `claude/majestic-requirements-audit-oxmet9`
**Method:** every claim below was checked against the code, the schema and the tests — not against the build map. Where the two disagree, the code wins and the build map has been corrected.

**Legend** `✅ Built & verified` · `🟡 Partial` · `🔑 Built, waiting on an account/key/decision` · `⬜ Not started`

---

## 0. The short answer

**Q1 — Can it support a scalable multi-location e-commerce business?**
Yes for the Nigerian business, today. Multi-location inventory, split-shipment routing, accounts, tracking, click-and-collect, discount codes and wishlists are live and tested. **Three things block the "international" half of that sentence:** there is no international gateway, currency is display-only, and there are no gift cards. Mobile is responsive but not yet *optimised* — the image pipeline is the single biggest gap.

**Q2 — Third-party tools?**
The integration plane is genuinely finished (scoped API keys, HMAC webhooks, `/api/v1`, an MCP endpoint). **No connector is actually connected.** Section 3 lists what to buy, what it costs, and where each one plugs in. Total recommended run-rate: **~$95–150/month** to start.

**Q3 — Digital marketing?**
All six tags are coded, consent-gated and firing canonical ecommerce events. **They are inert until the IDs are pasted into Admin → Settings** — which takes about fifteen minutes and is the highest-value quarter-hour available right now. SEO fundamentals are done; the missing piece is server-side rendering and review markup.

**Q4 — Fragrance features?**
Back-in-stock is live (the build map was wrong). Discovery sets are half-live. Everything else in that list — quiz, comparison, layering, personalised recs, gift finder, consultation booking — is not started, and together they are the largest remaining body of work. On security, four of five measures are in place; the exceptions are **no rate limiting on the admin login** and **WAF not switched on**, both of which should be closed this week.

---

## 1. Commerce core

| Requirement | Status | What exists, verified | What is left |
|---|---|---|---|
| **Multi-location inventory** | ✅ | Stores are data (`locations`), not constants — add/edit/close from Settings; per-store stock rows; a real routing planner (`worker/fulfilment.js`) that packs for *fewest parcels*; `order_shipments` one row per parcel; stock reserved at the store that actually ships each line; 12 planner cases gate the deploy | Stock **transfers** between stores, purchase orders / goods-receiving, a stock **audit log** (who changed what), low-stock reorder alerts, cycle counts |
| **Scalability** | 🟡 | Cloudflare Workers + D1 at the edge; code-split SPAs; catalogue reads are cached-friendly | **Product images live in D1 as BLOBs** (`media` table, 1.5 MB cap each). D1 is not a blob store — this inflates the database, the backup export and every restore. Move to **R2 or Cloudflare Images** before the photo library lands. The `/images/:id` URL shape was designed for exactly this move, so it is a swap, not a rewrite |
| **Multiple currencies** | 🟡 | NGN/USD **display** toggle in the header; `fmtCurrency()` divides by an admin-set rate | **Display only.** `worker/payments.js:25` hard-codes `CURRENCY = "NGN"`; a charge in any other currency is refused by design. No live FX feed (the rate is typed in by hand and goes stale), no per-currency price points, no rounding rules, no currency-aware tax/duty |
| **Local payment gateways** | ✅ | Paystack, and done properly: server-side init + verify, **amount and currency checked against what the server initialised**, signed webhook with constant-time compare, idempotent settlement, full `payments` audit trail, 45-minute stock hold with a cron sweep that re-checks the gateway before cancelling, resume-payment endpoint. 32 assertions gate the deploy. Bank transfer + WhatsApp handoff as manual fallbacks | Add the live key. That is all |
| **International gateways** | ⬜ | — | Nothing exists. Needs **Stripe** (cards, Apple/Google Pay) or **PayPal**, plus the multi-currency work above — the two are one project, not two |
| **Customer accounts** | ✅ | Register/login, guest-first with guest-record *claiming*, profile edit, saved addresses, order history auto-linked by email, checkout prefill, one-tap account creation on the confirmation page | **No password reset** (verified: no such route exists — a customer who forgets their password is locked out permanently). No email verification. No customer 2FA. No social/Google login |
| **Order tracking** | ✅ | Guest tracking by order number + phone/email, per-parcel timelines, status updates from the admin | Push/WhatsApp notifications on status change (the automation enqueues; the sender is missing — see §3) |
| **Click & collect** | ✅ | Per-store pickup at checkout, free, and blocked when the home store cannot fill the whole order | Pickup slot booking, collection-ready notification, in-store handover confirmation |
| **Gift cards** | ⬜ | **Zero code.** No table, no route, no UI | Issue (digital, with a code), redeem at checkout as a tender type, balance ledger, partial redemption, expiry policy, resend. Roughly one focused phase |
| **Discount codes** | 🟡 | Scoped %/₦/free-delivery codes, redemption counter, removable at checkout with an ✕ | **`starts`/`ends` dates are not enforced** — `promoIsActive()` (`worker/shop.js:20`) checks `status === "Active"` only, so a code with a past end date keeps working until a human flips it. Also missing: usage limits, per-customer caps, minimum spend, first-order-only, auto-apply, stacking rules |
| **Wishlists** | ✅ | Heart on cards and product pages, synced to the account, shown on the dashboard | Guest wishlists (currently requires an account), price-drop and back-in-stock alerts *from* the wishlist, shareable wishlist — the last one matters for a gifting category |
| **Mobile experience** | 🟡 | Responsive throughout (breakpoint hooks in all storefront modules), collapsible mobile checkout summary carrying the total and arrival date, mobile-first cart | **No image pipeline** — one size served to every device, no WebP/AVIF conversion, no `srcset`, no lazy-loading strategy. No PWA (no manifest, no service worker, no add-to-home-screen, no offline). No Lighthouse budget in CI. No font-loading strategy. This is where the conversion money is |

---

## 2. What "left to do" actually means for §1

Ordered by value ÷ effort, not by section number:

1. **Paste the analytics IDs** (15 min) — you are currently flying blind on every other decision here.
2. **Image pipeline: D1 → R2 / Cloudflare Images + responsive sizes** — fixes mobile performance, database bloat and backup weight in one move.
3. **Password reset** — small, and right now a locked-out customer is a lost customer.
4. **Promo date enforcement** — a three-line fix for a live commercial leak.
5. **Rate-limit the admin login + switch on the WAF** (see §5).
6. **Gift cards** — explicitly requested, wholly absent, and a genuine revenue line for a fragrance brand at Christmas.
7. **Stripe + real multi-currency** — only if international sales are actually a near-term goal; it is the most expensive item on this list and it is worth being honest about whether it is needed in 2026 or 2027.

---

## 3. Third-party tools, integrations and licences

### 3.1 The plane they plug into is already built

| Capability | Status | Detail |
|---|---|---|
| Partner REST API `/api/v1` | ✅ | Scoped API keys (read/write), SHA-256 hashed, last-used tracking. Endpoints: products, inventory, orders, order-by-number, customers, catalogue sync |
| Outbound webhooks | ✅ | HMAC-SHA256 signed POST of any or all domain events to any URL — this is what Zapier/Make/n8n consume |
| MCP endpoint `/api/mcp` | ✅ | JSON-RPC tools (`list_products`, `get_inventory`, `list_orders`, `get_order`) — AI agents can query the store directly |
| ERP catalogue sync | ✅ | `POST /api/v1/catalog/sync`, idempotent on the ERP's own IDs, `dryRun` mode, audit trail, drafts-by-default |
| Automation engine | ✅ | Event log → rules → outbox → 15-minute cron drain. Six automations seeded: abandoned cart, post-purchase, back-in-stock, order status, welcome, birthday |

**So the honest position is:** every integration below is a *connector* onto a finished socket, not an architecture project. The engine already enqueues the messages — most of them are sitting in the outbox marked `queued: awaiting email provider`.

**One gap in the plane:** `/api/v1` is read-only apart from catalogue sync. A POS cannot write an in-store sale back, and a WMS cannot push a fulfilment status. Add `POST /api/v1/orders` and `PATCH /api/v1/orders/:no` when the first such system is actually chosen.

### 3.2 Recommended stack

Prices are indicative monthly figures for a store of this size and **must be confirmed at purchase** — vendors reprice often.

| Need | Recommendation | Why this one | Indicative /mo | Integration effort |
|---|---|---|---|---|
| **Transactional email** | **Resend** | Already coded — `worker/events.js` sends the moment `RESEND_API_KEY` exists. Nothing to build | Free 3k/mo → **$20** (50k) | **Zero.** Add the key |
| **Email marketing + CRM** | **Klaviyo** | For a DTC fragrance brand this is CRM and email automation in one product; best-in-class segmentation and flow builder; ecommerce-native | Free ≤250 contacts → **$20–45** at 500–1,500 | Low — webhooks push events; their API accepts profiles |
| *(budget alternative)* | Omnisend | Cheaper, and bundles SMS + WhatsApp in the same flows | Free ≤250 → **$16–35** | Low |
| **WhatsApp Business** | **Meta Cloud API** via a BSP — **Wati** or **Interakt** | Nigeria is a WhatsApp-first market; a shared team inbox out of the box beats building one. Direct Cloud API is cheaper but gives you no inbox | **$39–49** + Meta's per-conversation fees | Medium — templates need Meta approval (allow 1–2 weeks) |
| **Live chat** | **Tawk.to** (free) *or* route chat into WhatsApp | The built-in concierge already stores threads and lets the admin reply; it just isn't real-time. Given the market, pushing chat into WhatsApp is the better spend than a second chat vendor | **$0** (Tawk) / Crisp $25/seat | Low — a script tag, consent-gated like the pixels |
| **Shipping** | **Terminal Africa** *or* **Sendbox** | Aggregators: one integration gives GIG, DHL, UPS, FedEx and local couriers, with rates, labels and tracking. Integrating GIG alone locks you to one carrier | Pay-per-shipment, no licence | Medium — rates at checkout, label on fulfilment, tracking webhook back |
| **Customer reviews** | **Build in-house** *(recommended)* — else Judge.me | Most review apps are Shopify-shaped; on this stack you fight their widget. The schema is small, and the **SEO value requires review JSON-LD on our own pages**, which is easier when the data is ours | **$0** in-house / Judge.me ~$15 | Medium in-house — form, moderation queue, per-product display, schema |
| **Loyalty & referral** | **Build in-house** *(recommended)* — else Smile.io | Same reasoning, plus the event backbone (F2) already emits exactly the events a points ledger consumes. Avoids ~$50–110/mo forever and keeps customer data in one place | **$0** in-house / Smile.io free ≤200 orders then ~$49 | Medium — points ledger, tiers, earn/burn, referral codes + attribution |
| **Workflow automation** | **n8n** (self-hosted) or **Make** | Consumes the signed webhooks already emitted. Use for the glue nobody should hand-code: Slack alerts, spreadsheet exports, ad-hoc syncs | n8n self-host **$0** / Make ~$10–30 | **Zero.** Point it at a webhook |
| **Analytics** | GA4 + Search Console + Clarity | All free, all already coded | **$0** | Paste IDs |
| **Media/CDN** | **Cloudflare Images** or **R2** | Solves the D1-blob problem and gives per-device resizing | **~$5–10** | Medium — swap the `/images/:id` backing store |
| **Edge security** | **Cloudflare Pro** | Managed WAF ruleset, better rate limiting, image optimisation | **$20** | Dashboard only |

**Starting run-rate: ~$95–150/month**, dominated by WhatsApp and Klaviyo. Building reviews and loyalty in-house rather than renting them saves roughly **$65–110/month indefinitely** and is the reason the recommendation goes that way.

### 3.3 The requested automated workflows

| Workflow | Status |
|---|---|
| Abandoned cart recovery | ✅ Engine live — carts captured, cron enqueues one chase per stale cart. 🔑 Sends on Resend key |
| Post-purchase follow-up | ✅ Enqueues on `order_paid`. 🔑 Sends on Resend key |
| Birthday campaigns | 🟡 Automation seeded and the `customers.birthday` column exists, but it is **disabled and has no cron branch** — the abandoned-cart cron path was written, the birthday one was not. Needs the scheduler branch + a way to collect birthdays |
| Repeat customer engagement | ⬜ No win-back or replenishment logic. For fragrance, a **replenishment reminder timed to bottle size** is the highest-value one to build and it does not exist |
| Order status updates | ✅ Enqueues. 🔑 Sends on key |
| Welcome series | ✅ Single welcome message enqueues; a multi-step *series* needs Klaviyo or a delay chain |
| Back-in-stock | ✅ Fully wired end to end, per variation. 🔑 Sends on key |

---

## 4. Digital marketing

| Requirement | Status | Verified detail | Left |
|---|---|---|---|
| **Google Analytics 4** | 🔑 | `startAnalytics()` loads gtag, consent-gated; `view_item` / `add_to_cart` / `begin_checkout` / `purchase` fire with items, value, currency | Paste the ID |
| **Google Search Console** | 🟡 | The verification-token field exists in Admin → Settings and renders into the page head | Claim the property, submit `/sitemap.xml`, watch coverage |
| **Microsoft Clarity** | 🔑 | Loader coded, consent-gated | Paste the ID |
| **Meta Pixel** | 🔑 | Loader + full event map (`ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`) | Paste the ID. **Add the Conversions API** later — iOS signal loss makes browser-only pixels increasingly lossy, and the server already has the events |
| **Google Ads conversion tracking** | 🔑 | Both the Ads ID *and* the purchase conversion label are settings; a purchase fires a `conversion` event with `transaction_id` | Paste both |
| **TikTok Pixel** | 🔑 | Loader + event map (`CompletePayment` on purchase) | Paste the ID |
| **SEO** | 🟡 | Path-based URLs, per-page title/meta/OG, JSON-LD (Product / Organization / WebSite), **per-variation canonicals and AggregateOffer**, `sitemap.xml` with one entry per variation, `robots.txt` | **The storefront is client-rendered only.** Google executes JS; Bing, and every social and WhatsApp link preview, are far less reliable. **SSR or pre-rendering for product and collection pages is the biggest SEO item left.** Also: no breadcrumb schema, no review schema (no reviews yet), no blog/editorial engine, no hreflang |
| **Performance** | 🟡 | Edge-served, code-split, small bundles, immutable image caching | Image pipeline (§1), Lighthouse budget in CI, font strategy, Core Web Vitals monitoring. No RUM today |
| **POS / accounting / WMS / mobile APIs** | ✅ | `/api/v1` + webhooks + MCP + ERP sync all live and documented in the README | Write endpoints for order push/status (§3.1). Named connectors when the systems are chosen. **A mobile app can be built against `/api/v1` today** |

**The single most valuable action in this whole document** is pasting six IDs into Admin → Settings. Every tag is written, tested and consent-gated; without the IDs, none of them exist.

---

## 5. Fragrance-brand features and security

### 5.1 Discovery & conversion features

| Feature | Status | Note |
|---|---|---|
| **Back-in-stock notifications** | ✅ | **Live** — per-variation waitlist, "Notify me" on every sold-out variation, `product_restocked` fires one message per waiting shopper. *(The build map had this as not-started; it was wrong and has been corrected.)* 🔑 Email sends on the Resend key |
| **Discovery / sample sets** | 🟡 | Collections are live — curated groupings with their own URLs, built in the admin. **No sample-size SKUs and no build-your-own discovery set**, which is the actual conversion mechanic for a fragrance brand people cannot smell online |
| **Fragrance finder / quiz** | ⬜ | Not started. Highest-impact item in this section: it converts browsers who don't know what they want, and it collects preference data the personalisation engine later needs |
| **Product comparison** | ⬜ | Not started. Data model is ready — notes, worn-by, family and price per variation all exist |
| **Layering suggestions** | ⬜ | Not started. Needs a pairing relation between products; can start hand-curated in the admin before any algorithm |
| **Personalised recommendations** | ⬜ | Not started. Foundations exist (F1 identity + F2 event stream); it is a query and a surface, not new plumbing |
| **Gift finder** | ⬜ | Not started. Filter by recipient / occasion / budget. Cheap to build on the existing catalogue filters and directly relevant to the category |
| **Consultation booking** | ⬜ | Not started. Slot booking → calendar → CRM. Consider Calendly embed first — the cheapest version of this is a link |
| **Customer reviews** | ⬜ | **Zero code.** Blocks review JSON-LD, star ratings in search results, and Google Shopping seller ratings. See §3.2 |
| **Scent-family navigation** | 🟡 | The `family` column exists but was deliberately removed from the storefront in v9. Worth revisiting once comparison/layering land, since both want it |

**Recommendation:** the quiz, the gift finder and sample/discovery sets are the three that move revenue for a fragrance brand, roughly in that order. Comparison and layering are cheaper but move less. Personalisation should come *after* the quiz, because the quiz is what feeds it.

### 5.2 Security

| Measure | Status | Verified | Left |
|---|---|---|---|
| **SSL/TLS** | ✅ | Automatic via Cloudflare, HSTS `max-age=31536000; includeSubDomains` set in `public/_headers` | Nothing |
| **Backups** | ✅ | D1 Time Travel (30-day point-in-time restore) **plus** a daily GitHub Action `wrangler d1 export` artifact | Artifacts expire with GitHub's retention — copy them to R2 or off-site for real retention. **Test a restore**; an untested backup is a hypothesis |
| **Firewall / WAF** | 🟡 | Cloudflare DDoS baseline is automatic | **Managed ruleset not deployed.** Dashboard-only, and needs a custom domain attached. Steps are in BUILD-MAP §6 |
| **Rate limiting** | ⬜ | **Nothing, at any layer.** Verified: no rate-limit, throttle or attempt-counting code anywhere in `worker/` | `/api/admin/login` accepts unlimited passphrase guesses. Add a Cloudflare rate-limit rule *and* an application-level attempt counter. **Do this first** |
| **Malware scanning** | 🟡 | Image uploads are capped at 1.5 MB and MIME-filtered | The filter trusts the client's `content-type` header — no magic-byte check, no AV scan. Tighten when review photos (user-supplied images) ship |
| **Two-factor authentication** | ✅ / ⬜ | **Admin: live** — TOTP with per-user staff accounts, roles, store scoping, issued one-time passphrases with forced change, master-passphrase break-glass | **Customer 2FA: not started.** Lower priority than customer *password reset*, which does not exist at all |
| **Security headers** | ✅ | nosniff, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, `/admin` noindex | **No Content-Security-Policy.** Now that the pixel domains are known and fixed, this can and should be written |
| **Secrets** | ✅ | Worker secrets, gitignored `.dev.vars`, CI-synced. No credentials in the repo | Nothing |
| **Privacy/consent** | ✅ | Non-blocking consent banner gates every tag; `/privacy` page live | NDPR-specific review before scale |
| **Observability** | ⬜ | Nothing | No structured logging, no error alerting, no uptime check. You will learn about an outage from a customer. Cheapest fix on the list: an uptime monitor and Sentry's free tier |

---

## 6. Consolidated "what is left", by priority

**This week — small, high value**
Paste the six analytics IDs · rate-limit the admin login · deploy the Cloudflare WAF ruleset · enforce promo end dates · add the Resend key (switches on *seven* already-built automations at once).

**This month — the real gaps**
Customer password reset · image pipeline to R2/Cloudflare Images with responsive sizes · Content-Security-Policy · uptime + error monitoring · POS/WMS write endpoints on `/api/v1` · WhatsApp Business connector.

**Next quarter — new capability**
Gift cards · customer reviews with moderation (unblocks review schema) · fragrance quiz · gift finder · sample/discovery sets · loyalty + referral ledger · unified CRM profile view · SSR/pre-render for product pages.

**When the business calls for it**
Stripe + true multi-currency settlement · consultation booking · comparison and layering · personalised recommendations · customer 2FA · stock transfers and purchase orders · PWA/mobile app.

---

## 7. Corrections made to the build map

- **Back-in-stock notifications** were recorded as not started (§2E). They are fully live — waitlist table, per-variation "Notify me", restock event, one enqueued message per waiting shopper. Corrected.
- **Discount codes** were recorded as fully live. The `starts`/`ends` dates are not enforced; downgraded to partial with the gap named.
- **Multi-currency** and **international gateway** rows were accurate and are unchanged.
- **Rate limiting** was implied by the WAF row but had no row of its own; it is now called out as its own gap, because the application layer has none either.
