# Majestic Roobee — Build Map & Systems Plan

The living tracker for what the platform is, what the client wants, and where each
piece sits. Update the **Status** column as we go. This is the source of truth for
"where are we in relation to what we're building."

**Legend**
`✅ Live` · `🟡 Partial (foundation exists)` · `⬜ Not started` · `🔑 Blocked on a decision or external account`

---

## 1. The systems-thinking frame

Today's platform is a well-built **transactional storefront**: it converts an
*anonymous visitor* into a *paid order*, with multi-location inventory and routing
underneath. Almost everything the client now wants is a different shape of problem —
it's about **relationships, lifecycle, and connecting the store to a wider business
system**. That's a shift from a *stateless commerce app* to a
**customer-data-centric platform**.

Three foundations unlock ~70% of the wish-list. Build these first, or every feature
on top of them gets re-invented in a one-off way:

| # | Foundation | Why it's load-bearing | Unlocks |
|---|------------|----------------------|---------|
| **F1** | **Customer identity** — accounts, unified profile, auth | Nothing on the list about *knowing a customer over time* works without a persistent customer record | CRM, loyalty, referral, wishlist-sync, order history, birthday campaigns, personalized recs, review attribution, back-in-stock, customer 2FA |
| **F2** ✅ | **Event + automation backbone** — record "what happened", trigger actions | Every automated workflow is the same engine: *event → rule → action*. Pixels and analytics also tap this stream | **LIVE**: event log, 6 seeded automations (abandoned-cart, post-purchase, back-in-stock, order-status, welcome, birthday), outbox + cron drain, waitlist. Sends activate when Resend connects. |
| **F3** ✅ | **Integration layer (incl. the MCP)** — one normalized way to push/pull with the outside world | Shipping, email, WhatsApp, POS, accounting, WMS, and AI agents are all "external systems we exchange data with." Build the plane once | **LIVE**: signed outbound webhooks, scoped API keys, `/api/v1` partner API, `/api/mcp` MCP endpoint (tools). Individual connectors (GIG, Resend, WhatsApp) plug in on top. |

Everything else is a **feature that plugs into F1–F3**. So the sequencing rule is:
_foundations → features that ride them → polish._

---

## 2. Capability map (by pillar)

### A. Commerce Core — *mostly done; deepen where noted*
| Capability | Status | Current capacity | Gap to close |
|---|---|---|---|
| Product catalogue & variants | ✅ | **The real catalogue is loaded** — 188 products, 198 sizes (migration 0008), filed on the eight categories the client's copy names (migration 0016). Admin fully edits existing products (name, category, worn-by, notes, description, per-size price) and can delete; storefront look (homepage layout, first-order popup, default city) is admin-controlled | Product photos (client uploads), copy for the 90 products the source catalogue had none for, per-store stock counts, media on R2 |
| Multi-location inventory | ✅ | **Stores are data** — open, edit, close or remove one from Admin → Settings, and inventory, routing, staff scoping and the storefront city picker all follow. Per-store stock, manual restock | Reservations, stock transfers, purchase orders, audit log |
| Cart & checkout | ✅ | Guest checkout, server-side pricing and validation, **fulfilment quote with multi-parcel delivery shown before payment**, removable promo, mobile summary. Copy carries only what a shopper decides on — routing internals are gone from the UI and from the API payload | Account-linked checkout (rides F1) |
| Payments — Paystack | ✅ | **Settled server-side only**: amount + currency verified on both the redirect leg and the signed webhook, idempotent so the two can't double-fire, constant-time signature compare, full `payments` audit trail. Unpaid card orders hold stock 45 min then release it on the cron (verifying with the gateway first); a failed hand-off stands the order down and returns its stock; `POST /api/orders/:no/pay` resumes an abandoned one. **Admin → Integrations → Payments** shows whether a key is set and whether it is test or live, the webhook URL to copy, every exchange with the gateway (including refusals), and an on-demand lapsed-hold sweep | — (add the key: see README → Paystack) |
| Payments — transfer / WhatsApp | ✅ | Manual-confirm + click-to-chat handoff; bank details are an admin setting | — |
| International gateway | 🔑⬜ | — | Stripe/PayPal for true USD settlement (decision) |
| Multi-currency | 🟡 | NGN/USD **display** toggle, static rate 1550 | Live FX source; optional multi-currency settlement |
| Click & collect | ✅ | Per-store pickup at checkout | — |
| Discount codes | 🟡 | Scoped %/₦/free-ship, redemptions, removable at checkout, **dates enforced** (ISO `starts_at`/`ends_at`, compared against today in WAT, end date inclusive) and the announcement bar is dismissible | Usage limits, per-customer caps, minimum spend, auto-apply, stacking rules |
| Gift cards | ⬜ | — | Issue, redeem, balance ledger |
| Reward codes | ✅ | **Live** — `reward_codes` + `worker/rewards.js`. One code, one person, one use: earned automatically when an order is paid for (rule in Settings: on/off, worth, qualifying spend, scope, expiry) or minted from **Admin → Rewards** singly or up to 200 at a time. Worth a %, an amount, free delivery, or **one product free** (a named size, or the cheapest thing in scope). Bound to the contact it was issued to, or bearer. Single use enforced by a conditional claim taken *before* the order is written, released if that write fails. Guests redeem in the same checkout box as a sale code | Emailing the code to the customer (rides Resend); a customer-facing rewards page beyond the account panel |
| Order tracking | ✅ | Guest by order# + contact, timeline | Account order history (rides F1) |
| Shipping rates | 🟡 | Flat per-store + cross-city fee, **charged per parcel on a split order** | Carrier-calculated rates → **GIG** (F3) |

### B. Customer Identity — **Foundation F1**
| Capability | Status | Notes |
|---|---|---|
| Customer accounts | ✅ | **Live** — password register/login (guest-first & optional), a guest record is *claimed* into an account, profile edit, marketing opt-in, and **password reset** (single-use hashed token, 1 hour, non-enumerating; emails send on the Resend key and are recoverable from the admin until then). Email verification still deferred to Resend. |
| Saved addresses & order history | ✅ | Orders auto-linked by email; addresses CRUD; checkout prefills for signed-in shoppers |
| Wishlists | ✅ | Heart on cards + product page; synced to the account; shown on the dashboard |
| Progressive prompts | ✅ | Confirmation page offers one-tap account creation from the just-placed order |
| Customer 2FA | ⬜ | Optional later; password reset via email comes with Resend |

### C. CRM & Engagement — *rides F1*
| Capability | Status | Current capacity | Gap |
|---|---|---|---|
| Unified customer profile (CRM) | 🟡 | Fragments exist: orders, inquiries, leads, abandoned carts | Stitch into one profile keyed by identity; segments, tags, notes, lifetime value |
| Customer reviews | ⬜ | — | Admin-authored **and** public-form submissions → moderation queue → approve → live; per-product + photos |
| Loyalty program | ⬜ | — | Points ledger, tiers, earn/burn rules |
| Referral program | ⬜ | — | Referral codes, attribution, rewards |
| Live chat | 🟡 | Concierge widget stores to DB, admin replies (not real-time), **threads archivable by the master account** | Real-time presence, agent routing, or 3rd-party (decision) |

### D. Marketing, Automation & Analytics — *rides F2 + F3*
| Capability | Status | Current capacity | Gap |
|---|---|---|---|
| Campaign composer | 🟡 | Banner **publishes**; email/push are **preview-only** | Real sends via connectors (F3) |
| Abandoned-cart recovery | ✅ | Capture ✅ + **cron enqueues a recovery** per stale cart into the outbox | Email send flips on with Resend |
| Lifecycle automations | ✅ | **Engine live** — post-purchase, back-in-stock (waitlist-driven), order-status, welcome all enqueue; birthday scaffolded | Email/WhatsApp dispatch via connectors |
| Email marketing integration | 🔑⬜ | — | Provider decision (Resend / Klaviyo / Mailchimp) |
| WhatsApp Business API | 🔑⬜ | Click-to-chat link only | Real 2-way API (Meta Cloud / 360dialog / Twilio) |
| Analytics & pixels | 🟡 | **Consent-gated tag loader live** (GA4, Google Ads, Meta Pixel, TikTok, Clarity) + admin-managed IDs; canonical events (view_item/add_to_cart/begin_checkout/purchase) wired | Paste IDs in Admin → Settings to activate; GSC verify |
| SEO | 🟡 | **Path-based URLs** (`/product/:id`), per-page title/meta/OG, JSON-LD (Product/Org/WebSite), `sitemap.xml`, `robots.txt` all live | Optional SSR/pre-render; review structured data once reviews exist |
| Performance | 🟡 | Edge + code-split SPAs, small bundles, **responsive images on R2** — 200/400/800/1600 WebP built at upload, `?w=` serves the narrowest that covers the request (a 390px phone pulls 1.4KB where it pulled 11.2KB) | Lighthouse pass, font strategy, RUM |

### E. Fragrance Discovery & Merchandising — *conversion features; several ride F1/F2*
| Capability | Status | Notes |
|---|---|---|
| Fragrance finder / quiz | ⬜ | Guided quiz → recommended scents |
| Product comparison | ⬜ | Side-by-side notes/family/price |
| Layering suggestions | ⬜ | "Pairs well with" from scent-family graph |
| Personalized recommendations | ⬜ | Rides F1 identity + F2 events |
| Gift finder | ⬜ | Filter by recipient/occasion/budget |
| Discovery / sample sets | 🟡 | **Collections/sets are live** — curated groupings built in the admin, shown above the catalogue. Sample-size products still to come |
| Merchandising shelves | ✅ | **Live** — New arrivals, Best sellers, Deals and Gift sets, each at its own URL and each computed rather than curated (`worker/merch.js`): listing age, paid-order counts, a deal's date window, and the categories grouped as gift. A pin on the product overrides either of the first two |
| Daily deal + countdown | ✅ | **Live** — Admin → Daily Deals schedules one piece, one price and a window to the minute in WAT; the storefront shows whichever window contains right now, with the clock running down beside it. The price is laid over the catalogue in `worker/shop.js`, so the grid, the product page, the cart and the Paystack charge carry it too, and it lifts on its own when the window closes. With nothing scheduled the card falls back to the deepest markdown on the floor, until midnight |
| Editable categories (one tree) | ✅ | **Live** — seven shelves, sub-categories one level under them (Perfumes → Extrait / Designer Oils / Custom Oils), owned by Admin → Categories. A shelf shows everything beneath it. It is the store's *only* category system: the header rail is the one picker, and the shop page carries a breadcrumb rather than a second menu |
| Brands | ✅ | **Live** — a `brand` on the product and `/brand/<name>` filtering the grid. The `/brands` index page was retired; the URL now lands on the full grid |
| Editorial / blog | ✅ | **Live** — `blog_posts` with a full admin (draft → publish), `/blog` + `/blog/<slug>`, three on the home page, in the sitemap, `BlogPosting` JSON-LD |
| Reviews & testimonials wall | 🟡 | **Curated embeds are live** — the customer's own Instagram / TikTok / YouTube post framed by that platform's `/embed` URL, or a written quote. Shopper-**submitted** reviews with moderation (and therefore review markup / star ratings) are still to come |
| Social proof on-site | ✅ | **Live** — a rotating note of real, paid purchases; first name and city only, window and interval configurable, off-switch in Settings |
| Wishlist | ✅ | **Live** — guest-first in the browser, merged into the account on sign-in, with its own page and a count in the header |
| Consultation booking | ⬜ | Slot booking → calendar; ties to CRM |
| Back-in-stock notifications | ✅ | **Live** — per-variation waitlist, "Notify me" on every sold-out variation, `product_restocked` enqueues one message per waiting shopper. Sends activate with Resend |

### F. Integration Platform — **Foundation F3 (incl. MCP)**
| Capability | Status | Notes |
|---|---|---|
| Integration API (`/api/v1`) | ✅ | Key-scoped REST: products, inventory, orders, customers |
| Outbound webhooks | ✅ | HMAC-signed POST of any/all events to external URLs (Zapier/Make/n8n/CRM) |
| MCP endpoint (`/api/mcp`) | ✅ | JSON-RPC (initialize/tools/list/tools/call) exposing list_products, get_inventory, list_orders, get_order as **tools** to AI agents — the "MCP tool for connections" |
| Shipping / GIG connector | 🔑⬜ | Rides F3 — rates, label, tracking sync |
| Email marketing connector (Resend) | 🔑⬜ | Dispatcher stub in place; add `RESEND_API_KEY` to activate sends |
| WhatsApp Business connector | 🔑⬜ | Templated + session messages |
| POS / accounting / WMS / mobile | 🟢 | Can integrate today via `/api/v1` + webhooks + MCP |

### G. Platform, Security & Ops
| Capability | Status | Current capacity | Gap |
|---|---|---|---|
| SSL / TLS | ✅ | Automatic via Cloudflare | — |
| DDoS protection | ✅ | Cloudflare default | — |
| WAF / firewall | 🟡 | Cloudflare WAF available; needs dashboard enablement (see §6) | Turn on managed ruleset + admin/API rate-limit rule |
| Rate limiting | ✅ | **Application layer live** — D1-backed sliding window on admin login, customer login and password-reset requests: 8 failures per identity / 15 min, 30 per IP, cleared on success. Master passphrase bucketed separately | Cloudflare rate-limit rule as the outer layer (dashboard, §6) |
| Backups | ✅ | D1 Time Travel (30-day PITR) **plus** a daily GitHub Action `wrangler d1 export` artifact | — |
| Security headers | ✅ | `_headers`: nosniff, HSTS, frame-options, referrer-policy, permissions-policy, `/admin` noindex, **and a Content-Security-Policy** covering the pixel domains, Google Fonts, Paystack and own bundles — verified violation-free in a browser | — |
| Malware scanning | 🟡 | No server surface; matters for **uploads** (review/product images) | Scan-on-upload once media uploads exist |
| Admin 2FA & accounts | ✅ | **Per-user staff accounts** (super/manager + store scope), issued one-time passphrases w/ forced change, **TOTP 2FA**, deactivate; **master passphrase** break-glass via `ADMIN_PASSWORD` | Full per-endpoint manager scoping (overview done; inventory/products next) |
| Secrets management | ✅ | Worker secrets, gitignored dev vars | — |
| Observability | ⬜ | — | Structured logs, error alerting, uptime checks |
| Consent / privacy | ✅ | Non-blocking consent banner (shown to all, welcomes + invites shopping) gates every tag; **privacy & cookies page** live at `/privacy` | — |

---

## 3. Phase plan (sequenced by dependency × value ÷ effort)

**Phase 0 — Instrument & harden (fast, low-risk, immediate value)**
- ✅ **0a Instrument** — consent-gated analytics/pixels (GA4, Google Ads, Meta, TikTok, Clarity), admin-managed IDs, ecommerce event tracking.
- ✅ **0b Discover** — path-based URLs, per-page SEO meta/OG, JSON-LD, sitemap, robots.
- 🟡 **0c Harden** — ✅ admin per-user accounts + TOTP 2FA + master passphrase · ✅ security headers · ✅ scheduled D1 backup export · ✅ privacy policy page · ⬜ Cloudflare WAF + rate limiting (needs dashboard action, §6).

**Phase 1 — Foundations**
F1 Customer accounts (+2FA, addresses, order history, wishlist) · F2 event +
automation backbone · F3 integration layer v1 (scoped API keys + outbound webhooks).

**Phase 2 — Engagement on the foundations**
- ✅ **2a Real catalogue** — image upload, multi-size products with per-store opening
  stock, draft/live toggle, and a **Go live** page to clear the seeded demo records.
  **Loaded**: the demo catalogue is gone and Majestic's own 188 products are live.
- ⬜ **2b** Unified CRM view · Reviews with moderation · Email connector live (Resend
  key) · WhatsApp connector · GIG shipping.

**Phase 3 — Growth & loyalty**
Loyalty + referral · birthday/repeat campaigns · gift cards · live-chat upgrade.

**Phase 4 — Fragrance discovery**
Finder quiz · comparison · layering · personalized recs · gift finder · discovery
sets · consultation booking.

**Phase 5 — Platform expansion**
MCP server + POS / accounting / WMS connectors · mobile-app API.

---

## 4. Open decisions (needed before the phases they gate)

| # | Decision | Resolution | Gates |
|---|---|---|---|
| D1 | Email marketing provider | **✅ Resend** (for now) | Phase 0/2 |
| D2 | WhatsApp Business API route | **✅ Direction: real 2-way API later; stay heavy on click-to-chat now** | Phase 2 |
| D3 | International payments | **✅ Integrate Paystack and/or Stripe** | Phase 1 |
| D4 | Currency model | Display-only (keep) · real multi-currency settlement | Phase 1 |
| D5 | Live chat | Build real-time · adopt Crisp/Intercom/Tawk | Phase 3 |
| D6 | Loyalty engine | Build in-house · third-party | Phase 3 |
| D7 | Customer auth method | **✅ Progressive & optional** — full guest commerce with no account; accounts encouraged with perks, never required | Phase 1 |
| D8 | FX rate source | Manual · live API (openexchangerates etc.) | Phase 1 |

Design principle from D7: **guest-first everywhere.** Every account touchpoint is a
suggestive upsell ("save this / track faster / earn points"), never a gate.

---

## 6. Action needed from you — Cloudflare WAF (dashboard-only)

The API token can't toggle zone security, so these are quick clicks in the Cloudflare dashboard (Workers project → the site's zone/route). Once the site is on a real domain:
1. **Security → WAF → Managed rules** → deploy the *Cloudflare Managed Ruleset* (and OWASP core if on Pro+).
2. **Security → WAF → Rate limiting rules** → add a rule: path contains `/api/admin/login`, > 10 requests / 1 min per IP → Block for 10 min (throttles passphrase guessing).
3. Optionally a broader `/api/*` rate limit (e.g. 100/min/IP).
4. `workers.dev` subdomains get Cloudflare's baseline DDoS/edge protection automatically; full WAF applies once a custom domain/zone is attached.

---

## 7. Deployment pipelines — important

There are (or were) **two** CI systems pointed at this repo, both firing on every push:

| Pipeline | What it does | Status |
|---|---|---|
| **GitHub Actions** (`.github/workflows/deploy.yml`) | lint → test → build → **render check against a local Worker** → apply D1 migrations → deploy → sync secrets → smoke tests → live render check | ✅ the source of truth |
| **Cloudflare Workers Builds** (dashboard-connected) | `npm clean-install` → `npx wrangler deploy` — **no build step** | ❌ was failing |

Workers Builds failed with `The directory specified by the "assets.directory" field
does not exist: /opt/buildhome/repo/dist` because `dist/` is a gitignored build
artifact and that pipeline never ran `npm run build`.

### The failure this caused, and the fix (v12)

The deploy of the variations-as-products work went red on its last step:

```
✗ /product/dewivy-bodymist — root children: 0;
  errors: Cannot read properties of undefined (reading 'filter')
```

The Worker deployed fine and the database was correct. What broke was that the
**new asset bundle was being served against a `/api/store` payload that did not
yet carry the `images` field** the new product page reads — the two halves of one
deploy are two uploads, and a second pipeline pushing the same commit makes that
window wider. Reproduced exactly by serving the previous payload shape to the
built storefront; the page white-screens on the same line with the same message.

Three changes close it:

1. **The storefront reads the catalogue defensively.** `pr.images`, empty variant
   lists and missing stock maps all degrade instead of throwing, so a payload
   from an older Worker version can never blank the page.
2. **The render check runs before the deploy**, against `wrangler dev --local` on
   a freshly migrated database. It used to run last, against production — so a
   broken build was already serving customers by the time the job went red. It
   was a report; now it is a gate.
3. **The live smoke test waits for the new version to actually serve** before it
   judges anything, so a half-rolled-out deploy can't fail a good commit.

**Recommendation: disable Workers Builds and keep GitHub Actions.** Two pipelines on
one push means double deploys and a race — and Workers Builds skips database
migrations, linting and the render check, so it can ship code ahead of its schema.
Disable it in the dashboard: **Workers & Pages → majestic → Settings → Builds
→ disconnect the repository** (or toggle off automatic builds).

**If you'd rather keep Workers Builds instead**, set one of these in that same
Builds panel (Workers Builds deliberately ignores the `build` block in
`wrangler.jsonc`, so it must be configured there):
- **Build command:** `npm run build`, or
- **Deploy command:** `npm run deploy` (the script already does `npm run build && wrangler deploy`)

…and then disable the GitHub Actions workflow so only one pipeline deploys — but note
you'd lose the migration/lint/render-check gates unless you re-add them there.

Note: `wrangler.jsonc` now carries a `build.command`, which makes a **manual/local**
`wrangler deploy` build first (that path used to hit the same error). It does not
affect Workers Builds.

---

## 5. Change log
- _v16_ — **Sprint 2: the storefront the house asked for.** Seven things, and one idea underneath them: the shelves a fragrance shopper expects are *readings* of data we already hold, not lists someone has to keep. So `worker/merch.js` computes them — **New arrivals** from listing age, **Best sellers** from paid, uncancelled orders over a configurable window, **Gift sets** from the categories grouped as gift, **Deals** from a deal's date window plus any product priced below its own compare-at — and each has its own URL (`/new-arrivals`, `/best-sellers`, `/gift-sets`, `/deals`), so the header's tabs are linkable, indexable pages rather than client-side state. A shelf that would come back nearly empty is topped up in the house's own catalogue order, because an empty tab reads as a broken shop; the two shelves where emptiness is *true* (no sets, nothing marked down) are left empty rather than padded with full-price staples. A **deal** is the one genuinely new object here: a title, a badge, its products and a window it runs inside, so it leaves the storefront by itself the day after it ends with nothing to switch off — the same rule promo codes got in v15, applied to the thing shoppers see rather than the thing they type. **Categories stopped being seed data**: they were fixed at migration 0008 and nobody could add, rename, describe, reorder or retire one, so Admin → Categories now owns them, each carrying the sub-shelves it offers (which appear as chips on that category and under it in the header's mega-menu), and a category with products in it is refused deletion with the count rather than cascading. Every admin screen reads that live list now; the hardcoded `CAT_LABELS` survives only as the label of last resort. The **wishlist** existed server-side but demanded an account at the exact moment someone wanted to save something — it is guest-first now, kept in the browser and handed over on the next sign-in, with a counted heart in the header and its own page. The **blog** is new end to end: an admin with drafts and publishing, plain-text authoring (paragraphs, `## `, `> `, a bare image URL) so nothing written by a person is ever passed to `dangerouslySetInnerHTML`, `/blog/<slug>` with `BlogPosting` markup, and every published post in the sitemap. **Reviews & testimonials** are the customer's own posts: the admin pastes whatever link they copied — Instagram post or reel, TikTok, YouTube, a direct video file — and the server reduces it to the post's id, so tracking parameters don't matter and the kind never has to be chosen from a menu. Each renders through that platform's own `/embed` URL in an iframe, so **no third-party script runs on the store**; CSP gained exactly those four frame origins and nothing else, and a link we don't recognise degrades to a written quote card rather than a broken frame. **Live purchase notes** ("Dorothy from Abuja purchased Osk 30ml") are built from real orders under two rules that make them safe to publish on a public endpoint: only ever a first name and a city, and only orders actually paid for — an abandoned card attempt is not a purchase. Finally, **Locations** joined Brands in the header: every store with hours, phone, ETA and a map link, and a button to shop that city's shelf. 30 new assertions cover the shelf arithmetic, the deal boundary, embed parsing per platform, the first-name rule and every new URL round-tripping through the router; verified in a real browser against a local Worker on a fresh database, including that a guest's saved piece survives registration and that an Instagram frame loads without a CSP violation.
- _v15_ — **Sprint 1: hardening.** The five items the audit put first, plus one that became possible mid-sprint. **(1) Login throttling** — there was none anywhere, at any layer, so `/api/admin/login` would take passphrase guesses forever. There is no KV binding on this Worker, so the counter is D1: one row per failure, counted in a 15-minute sliding window, across two buckets per attempt — 8 per identity and 30 per IP, because a narrow limit alone never sees someone spraying one guess each across a hundred usernames. A success clears the slate, a wrong 2FA code counts as a failure while a *missing* one does not, and the master passphrase is bucketed under its own namespace so the break-glass credential isn't the least-protected thing on the box. **(2) Promo dates bind now.** `starts`/`ends` were free display text — "Aug 1", "Until ended" — that nothing read, so an expired code kept discounting until someone noticed. Real ISO columns, backfilled from whatever old text parsed and left unbounded where it didn't, compared against **today in West Africa Time** so a sale ending the 20th runs all day on the 20th in Lagos instead of lapsing at 1am UTC. End date inclusive, either bound optional, so no existing promo changed behaviour. The admin gained date pickers, a server-computed Active/Scheduled/Expired badge, and a flag on legacy rows whose dates still can't be enforced. Checkout now says *why* a code was refused. **(3) The announcement bar got an ✕**, keyed on the message so dismissing one promotion doesn't hide the next. **(4) Password reset**, which simply did not exist: a single-use token stored only as its hash, an hour to live, a request endpoint that answers identically whether or not the address is known so it can't be used to test who shops here, and a new link killing any outstanding one. It sends through Resend the moment that key lands and, until then, records the link in the admin so the house can help a locked-out customer today rather than after a connector arrives. **(5) Images left the database.** R2 was enabled on the account mid-sprint, so what was designed as an R2-ready fallback became a real migration: `worker/media.js` reads either backend per row, the bucket takes new uploads, and a batched, re-runnable admin action moves the stragglers — throughout which every stored `/images/<id>` URL kept working untouched. The admin's own browser now builds 200/400/800/1600px WebP copies at upload (Workers have no canvas, and Cloudflare's resizing is a paid zone feature this account doesn't have, but the machine doing the uploading already holds the decoded image), and `?w=` serves the narrowest copy that covers the request, rounding up to stay sharp and falling back to the original for anything uploaded before this existed. Measured in a real browser: a 390px phone pulls 1.4KB where it used to pull 11.2KB. **(6) A Content-Security-Policy**, written against the pixel domains actually in use plus fonts, Paystack and the app's own bundles, and verified violation-free across the storefront, shop, account and admin — the check distinguishing a CSP block from this sandbox's own network, which is the failure mode that would otherwise have shipped a policy that silently kills the brand's typefaces. 33 new assertions gate the deploy. New: [`PROJECT-TRACKER.md`](./PROJECT-TRACKER.md), the running list of what shipped and what is left, seeded from the audit.
- _v14_ — **Audited the whole platform against the client's requirements list**; see [`REQUIREMENTS-AUDIT.md`](./REQUIREMENTS-AUDIT.md) for the full findings, the recommended third-party stack with licence costs, and the prioritised remainder. Every row was re-checked against the code rather than against this document, which had drifted in four places, now corrected here: **back-in-stock is live** (was recorded as not started — the waitlist, the per-variation "Notify me" and the restock fan-out all exist and only the email dispatcher is pending), **discount codes are partial** (`starts`/`ends` are display text and are never enforced, so an expired code keeps discounting until a human ends it), **customer accounts are partial** (there is no password-reset route at all, so a forgotten password is a permanent lockout), and **rate limiting** gained a row of its own because the WAF row implied protection the application layer does not have — there is no throttle anywhere in `worker/`, and `/api/admin/login` will accept unlimited passphrase guesses. Two further findings worth carrying forward: product images live in D1 as BLOBs, which inflates the database, the nightly export and any restore, and wants moving to R2 or Cloudflare Images before the photo library lands; and the storefront renders client-side only, which Google tolerates but Bing and every social/WhatsApp link preview do not, making SSR or pre-rendering the largest remaining SEO item. The audit's headline: the Nigerian business is well served today, the international half of the brief is not (no second gateway, display-only currency, no gift cards), the integration plane is finished but nothing is plugged into it, and all six marketing tags are coded and inert until their IDs are pasted into Admin → Settings.
- _v1_ — Initial systems map and phase plan.
- _v2_ — Locked decisions D1 (Resend), D2 (click-to-chat now), D3 (Paystack + Stripe), D7 (progressive/optional accounts). Started **Phase 0**.
- _v3_ — Shipped **Phase 0a (instrument)** + **0b (discover)**: consent-gated analytics/pixels with admin-managed IDs, ecommerce event tracking, path-based routing, per-page SEO + JSON-LD, sitemap & robots. Remaining: **0c (harden)**.
- _v4_ — Shipped most of **0c (harden)**: per-user admin accounts with issued passphrases + forced change, TOTP 2FA, master passphrase break-glass, manager store-scoping; security headers; daily D1 backup export; privacy page; non-blocking consent banner that invites shopping. WAF left as a dashboard action (§6).
- _v5_ — Shipped **Phase 1 F1 — customer accounts** (guest-first, optional): register/login, guest-record claiming, order history (auto-linked by email), saved addresses, wishlists, checkout prefill, confirmation-page account nudge, and a header **profile menu** that is sign-in when logged-out, shows the name when logged-in, and gateways the staff portal. Tokens namespaced (customer vs admin). Also broadened admin control: **edit/reprice/delete existing products** and admin-controlled homepage layout / popup / default city. Deploy pipeline now applies D1 migrations to production (`wrangler d1 migrations apply --remote`). **Next: F2 event/automation backbone, F3 integration layer; then Phase 2 (CRM, reviews, first automations, Resend email, GIG).**
- _v6_ — Shipped **Phase 1 F2 + F3**. F2: event log, 6 automations (abandoned-cart, post-purchase, back-in-stock, order-status, welcome, birthday), outbox + 15-min cron drain, back-in-stock waitlist ("Notify me"). F3: signed outbound webhooks, scoped API keys, `/api/v1` partner API, and an `/api/mcp` MCP endpoint (tools). Admin **Integrations & automations** page manages it all. Cron trigger added to the Worker. All three foundations (F1/F2/F3) are now live — **the platform can automate lifecycle messaging and be integrated by external systems and AI agents.** Next: Phase 2 (Resend to activate email sends, GIG, CRM view, reviews).
- _v7_ — Shipped **Phase 2a — the real catalogue**, so the store can stop running on demo data. Admin can now **upload product photos** (stored in D1, served from an immutable-cached `/images/<id>`; R2 is not enabled on the account, and this URL shape means media can move to R2 later without touching product records), create a product with **several sizes, a price per size and opening stock per store**, save it as a **draft or push it live** immediately, and edit/reprice/add/remove sizes afterwards. Catalogue list gained photo thumbnails, a "No photo" warning, and search. New super-admin **Go live** page clears the seeded demo records in seven selective scopes behind a typed `DELETE` confirmation. Verified end to end: upload → create → live on the storefront with the real photo, drafts stay hidden. Two bugs found and fixed by that test — D1 returns a BLOB as a number array (`Response()` was stringifying it, so images served corrupt), and an unknown category hit a foreign-key 500 instead of a readable message. The post-deploy render check now also asserts a product photo actually **decodes** in the browser, since a mangled blob still returns 200.
- _v8_ — **Admin runs on live data only.** Audited every admin page: all eleven were already reading from `/api/admin/*` with no mock data in the frontend — the figures on the dashboard were real reads of the *seeded* rows, so the fix belonged in the data, not the code. Migration 0007 **tags the rows migration 0002 seeded**, and "clear the demo data" now deletes only tagged rows, so it can never remove a product, order or promo code the shop created itself. The Go-live page is split into two groups: **the sample data** (safe, shows "17 samples to remove · 1 of yours stays") and **real records** (`customers`, `leads`, `activity` — never seeded, so anything there is genuine, and clearing them is a real deletion). Caught this because production already held a real product, *Queen Of Seduction*, that the old blunt "Products" purge would have destroyed. Also added empty states across the admin — dashboard orders/checkouts/top-products/revenue chart, inventory, promos, campaigns, webhooks, API keys — since a freshly-cleared store previously showed bare table headers. Verified every admin page and the storefront render clean against a completely empty database. The render check now picks a product page from whatever is actually live instead of a hardcoded demo slug, which would have started testing a 404 the moment the samples were cleared.
- _v9_ — **The store now runs on Majestic's own catalogue.** Migration 0008 clears every demo record tagged by 0007 and loads the client's product list from `MajesticRoobee_Product_Catalog.xlsx`: **188 products across 13 real categories with 198 sizes** — 198 sheet rows folded into products, so a name that appears twice (Bad Character 30ml/50ml, Terri 3 10ml/100ml, the diffusers) becomes one product with two sizes rather than two listings. Categories were rebuilt around what the house actually sells (extraits, designer oils, custom oils, body mists, home fragrance, deodorants, feminine care, massage oils, health drinks, and four kinds of set); `sensual` and `package` had no equivalent, so any product the shop added under them is moved to the closest real shelf before those two are retired — the storefront/worker promo scopes and the admin category labels moved with them. Client decisions, applied: photos left empty for the client to upload, everything live, an identical opening stock at all three stores (real counts go in Admin → Inventory), no invented copy for the 90 products the source had none for, and **scent family removed from the storefront and admin entirely** (the column stays, unused) while *worn by* stays and is now editable on existing products, not just at creation. Two demo leftovers the catalogue swap would have exposed: the announcement bar advertised `QUEEN10`, which this migration deletes (rewritten, and only while it still carries the demo line), and `FIRSTTRAIL` — printed on screen by the lead popup and handed out by `/api/leads` — is re-created as a real promo so the code still works at checkout. The homepage's three hero picks were hardcoded demo slugs; they now come from whatever is live. Verified against a local D1: migration applies clean and is idempotent, an existing real product with a clashing slug keeps its photo, copy, draft flag and real stock counts, storefront + admin + a product page render in a browser, and a two-item order with the promo prices, routes and reserves stock correctly.
- _v10_ — **Deploy smoke test no longer depends on the sample data.** The catalogue swap deployed cleanly (migrations applied, Worker live, 188 products serving) but the pipeline went red on its last gate: the smoke test tracked order `MR-10234`, a *seeded* order migration 0008 deletes, so it 404'd and the JSON parse blew up. Same shape of bug as the render check's hardcoded product slug in v7. Tracking is now asserted through its **rejection path** — an unknown order number must return HTTP 404 with a readable `error` in the body — which still exercises the route, the database read and the JSON contract the storefront depends on, without needing a row only the demo data ever had. The product-count assertion dropped from `≥ 17` (the demo catalogue's size) to `≥ 1`.
- _v11_ — **Fulfilment gets real, and the house stops being three fixed stores.** Five things shipped together. **(1) Routing** is now a planner (`worker/fulfilment.js`) with one rule in three steps: one parcel from the buyer's own store; failing that, one parcel from whichever single store holds the whole order; failing that, **several parcels, priced and confirmed by the buyer before the order exists** — a `POST /api/fulfilment/quote` shows each parcel's contents, ETA and fee, and `POST /api/orders` answers **409** to an unconfirmed split rather than silently charging for two deliveries. The split packs for *fewest parcels*, not nearest store, because each parcel is another delivery fee: scarce pieces choose the stores, flexible pieces ride along. Orders carry `order_shipments` (one row per parcel) and `order_items.location_id`, so stock is reserved at the store that actually ships each line, and the dashboard, tracking page and confirmation all name the parcels. `orders.fulfilled_from` stays as the primary parcel's store, so store-scoped managers and existing orders are unaffected. **(2) The shop is location-aware**: it lists what is on the shelf in your city, with an "Every store" toggle and a line telling you how many more pieces ship from elsewhere — and **a search always reaches every store**, because someone hunting a specific scent wants to know it exists in Lagos. **(3) Stores are data**: add, edit, close or remove them in Settings. A new store gets a stock row for every existing size; a store that has shipped anything (whole order or one parcel) is *closed* rather than deleted so its history survives; the last open store can't be closed at all. Every hardcoded `abuja/lagos/ibadan` is gone from the worker and both SPAs — inventory columns, the scope picker, opening-stock fields, the city gate and promo scopes all follow the table. **(4) The inbox archives** — reversible, master-account only, with live/archived counts on the toggle. **(5) Collections/sets**: an admin page builds curated groupings that render above the catalogue on the shop page, with their own URL (`/shop?collection=…`); a product can be in several and its category never changes. Buyers can also now **take a promo code back off** with an ✕. Verified locally end to end: 12 planner cases (`npm test`, now gating deploys), a split order placed through the browser with the confirmation gate, stock decremented at the right stores, collect blocked when the home store is short, permission checks proving a store manager cannot archive or touch stores, and the whole admin + storefront rendering clean with a fourth store added mid-session.
- _v12_ — **The deploy gate moved in front of the deploy, and checkout grew a real payment system.** Three things shipped. **(1) The failing deploy**: the product page white-screened in production on `Cannot read properties of undefined (reading 'filter')` — the new bundle read `pr.images` while the live `/api/store` was still answering with the previous payload shape. Reproduced exactly by serving the old shape to the built storefront, then fixed at three levels: the storefront now reads the catalogue defensively (missing `images`, empty variant lists and absent stock maps all degrade rather than throw), the headless render check runs **before** the deploy against `wrangler dev --local` on a freshly migrated database instead of after it against production, and the live smoke test waits for the new version to actually serve before judging it. The check used to be a report on a build that was already live; it is now a gate. **(2) Payments became a first-class part of an order** (`worker/payments.js`, migration 0011). An order is paid only when the gateway confirms a successful charge **for the exact amount and currency the server initialized**, checked on both the redirect leg and the webhook — a correctly signed `charge.success` for ₦1 no longer settles a ₦42,500 order. Settlement is idempotent through a conditional UPDATE, so the redirect and the webhook racing can't fire the post-purchase automation twice. Webhook signatures are compared in constant time. Every exchange with Paystack — including refused ones — lands in a `payments` audit table. Unpaid card orders now **hold stock for 45 minutes and then give it back** on the cron sweep, which verifies with the gateway first so an order paid in the last second is rescued rather than cancelled; a payment that lands after the lapse re-takes its stock and flags the discrepancy on the timeline. A failed hand-off to Paystack stands the order down and returns its stock instead of leaving a dead order holding inventory, and `POST /api/orders/:no/pay` lets a shopper finish an order they abandoned, offered from the tracking page. Card orders now require a valid email, because that is what a Paystack transaction is keyed to. 32 settlement assertions gate the deploy. **(3) Checkout was rebuilt around what the shopper is actually deciding** — where it goes, who they are, how they're paying, what it costs — and everything explaining the shop's own machinery was deleted: which branch packs the order, why it was routed there, that payment is verified server-side, that no account is needed. The multi-parcel flow reads "Arrives in 2 deliveries" with the dates and the fee rather than a paragraph and a consent checkbox; the order timeline says what happened to the order, not how the system decided it; store and city names no longer leave the server in the fulfilment quote at all. Mobile gets a collapsible summary carrying the total and the arrival date. Bank details for transfer orders became an admin setting instead of a hardcoded placeholder account number.
- _v13_ — **Paystack made ready to switch on, and a deploy gate that actually gates.** The previous run's live smoke test had asserted against the *previous* Worker and passed — it printed the old order-tracking copy three seconds after deploy, because the thing it waited on (`images` in the payload) was already served by the build being replaced. The propagation window is real; the check simply wasn't measuring it. The Worker now names the build answering at `/api/health`, fed by `wrangler deploy --var BUILD_SHA:$GITHUB_SHA`, and CI polls until it sees the commit it just pushed before asserting anything — confirmed on the next run, which read back the *new* copy. The pre-deploy step also stopped leaving `workerd` orphaned (killing the recorded pid left the child holding the port). On payments: `/api/store` now reports which methods the server will actually accept and checkout offers only those, so with no key the card option is hidden entirely rather than failing at the last step, and a selection that stops being available moves itself. **Admin → Integrations opens with a Payments panel** — key present or not, `sk_test_` versus `sk_live_` (otherwise invisible from inside the app, and the difference is play money versus somebody's salary), the webhook URL to copy into the Paystack dashboard, a log of every exchange including charges refused for the wrong amount, and a button to run the lapsed-hold sweep now instead of waiting on the cron. Super admins can settle a transfer or WhatsApp order by hand; card orders deliberately cannot be, since those are the gateway's to settle and a human marking one paid would be inventing a payment. `scripts/paystack-stub.mjs` stands in for the gateway locally — it speaks initialize and verify, serves a Pay/Abandon page at the authorization_url and fires a correctly signed webhook — and the whole redirect round trip was walked in a browser against it: a purchase settles exactly once (the webhook won the race, the redirect leg found it already paid, one `order_paid` event), an abandoned payment lands on "Payment not confirmed yet" with a working **Pay now**, the sweep expires a genuinely unpaid order and returns its stock, and the sweep *rescues* an order the gateway confirms was paid rather than cancelling something already charged for. README gained a Paystack section: where the key goes per environment, the webhook URL, the test cards, and what the server guarantees about settlement.
- _v14_ — **The store speaks the client's words.** The client supplied a website copy sheet (*MAJESTIC ROOBEE — Website Copy & SEO Brief*) and one instruction: drop the flowery house voice — the flyout that answered a tap on **Perfumes** with "IN PERFUMES", the "pieces", the "shelves", the "trails" and the "house" — and say plainly what each thing is. Three parts. **(1) Categories** now match the copy sheet: migration `0016` makes **Perfumes** the category itself rather than a parent over "Extrait Perfumes", lifts **Perfume Oils** into a category of its own over the designer and custom oils, brings **Feminine Care** up to the top level and retires the "Bodycare" parent it hung under, and adds **Wellness Products** over the health drinks and massage oils — leaving Perfumes · Perfume Oils · Body Mists · Feminine Care · Home Fragrance · Wellness Products · Deodorants · Gift Sets, in that order. Every product keeps a home (the extraits move onto `perfumes`), and `/shop?category=extrait` and `?category=bodycare` — links already shared — alias to the category that now holds their products rather than landing on an empty grid. **(2) The copy** is the client's, throughout: the hero, the scrolling announcement, the category grid ("Find Your Fragrance"), the feminine-care and home-fragrance bands, best sellers, the fragrance-personality block, the founder's story (its opening on the home page, in full on About), the rewards steps, the newsletter block, the Instagram block, the About page, the shop page, the contact page and a new **/faq** page carrying her nine questions and answers. The footer was rebuilt to the copy sheet's four columns and now lists the live category tree rather than a second hand-kept list, with TikTok and Facebook links alongside Instagram once they are set. **(3) SEO** is the brief's: every title and meta description on the home, shop, about and category pages is the one the client wrote, with per-category heads for the six she named and a generated one for anything added later; category pages joined the sitemap. Two sort options came with the shop-page filter list she asked for — **Best sellers** and **Newest** — reusing the rankings the server already computes. Verified against a local D1 and a real browser: migrations apply clean, the tree comes out as the copy sheet lists it, and the home, shop, category, about, FAQ, contact, best-sellers, stores and blog pages all render with the right titles.
- _v15_ — **Rewards, as coupon codes rather than a points ledger.** The homepage already advertised "the more you shop, the more you earn" with nothing behind it. What shipped is the thing a shop can actually run: **one code, one person, one use.** A promo is a public sale; a reward is personal, single-use, and lives in its own table with its own engine (`reward_codes`, `worker/rewards.js`, migration 0017) rather than being bolted onto `promos` — where "redemptions" would have meant two different things and a storewide sale code would have been one typo away from being single-use. **What a reward can be**: a percentage, an amount, free delivery, or — the one a promo cannot do — **a product free**. That last is not a zero-priced order line: the shopper puts the product in their cart and the reward takes its unit price off as a discount, so stock, packing and the total all behave like an ordinary order. It either names a size (and is refused *by name* when that size isn't in the cart — "Add Dewivy bodymist 100ml to your cart") or names none, taking the cheapest thing its scope covers. **How one comes to exist**: earned when an order is *paid for* — `markPaid()` is the single door a card settlement and a manager-confirmed transfer both come through, so both earn the same thing, and issuing is idempotent on the order number because that function is deliberately racy. Or minted from **Admin → Rewards**, one at a time or up to 200, owned or bearer, named or generated. The earning rule is settings (`rewardsOn`, kind, value, qualifying spend, scope, expiry days, prefix), so the shop can change what a purchase is worth, or stop giving rewards, without a deploy. **The three rules and what enforces them**: *one code* — minted from an alphabet with no O/0, I/1 or S/5, checked against the promos table too so nothing minted is unreachable; *one person* — `owner_key` is the normalised contact, checked softly at validate time (the email box may still be empty) and for real when the order is placed; *one use* — claimed with a conditional UPDATE **before** the order is written, so two checkouts racing on one code are settled by the database rather than by whichever commits last, and released, scoped to that order number, if the write then fails. Shoppers meet one code box: the server reads promos first, rewards second. Their codes appear on their account page (matched on contact, so a code earned as a guest is there the moment they register) and the code a purchase earned appears on order tracking — which is where a bank-transfer customer finds it, the confirmation screen having come and gone before the money landed. 46 assertions in `scripts/rewards.test.mjs`, gating the deploy with the other four suites, and a full end-to-end pass against a local Worker: validate, refuse (wrong owner, expired, under the minimum, product not in the cart), spend, refuse the second spend, settle, earn, settle again without earning twice, mint, void, restore. That run earned its keep — it caught a foreign key on `redeemed_order_no` that made the claim-before-write impossible, which no unit test would have seen.
