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
| Product catalogue & variants | ✅ | **The real catalogue is loaded** — 188 products in 13 categories, 198 sizes (migration 0008). Admin fully edits existing products (name, category, worn-by, notes, description, per-size price) and can delete; storefront look (homepage layout, first-order popup, default city) is admin-controlled | Product photos (client uploads), copy for the 90 products the source catalogue had none for, per-store stock counts, media on R2 |
| Multi-location inventory | ✅ | Per-store stock, order routing, manual restock | Reservations, stock transfers, purchase orders, audit log |
| Cart & checkout | ✅ | Guest checkout, server-side pricing | Account-linked checkout (rides F1) |
| Payments — Paystack | ✅ | Init + verify + signed webhook | — (add live key) |
| Payments — transfer / WhatsApp | ✅ | Manual-confirm + click-to-chat handoff | — |
| International gateway | 🔑⬜ | — | Stripe/PayPal for true USD settlement (decision) |
| Multi-currency | 🟡 | NGN/USD **display** toggle, static rate 1550 | Live FX source; optional multi-currency settlement |
| Click & collect | ✅ | Per-store pickup at checkout | — |
| Discount codes | ✅ | Scoped %/₦/free-ship, redemptions | Usage limits, per-customer caps, auto-apply |
| Gift cards | ⬜ | — | Issue, redeem, balance ledger |
| Order tracking | ✅ | Guest by order# + contact, timeline | Account order history (rides F1) |
| Shipping rates | 🟡 | Flat per-store + cross-city fee | Carrier-calculated rates → **GIG** (F3) |

### B. Customer Identity — **Foundation F1**
| Capability | Status | Notes |
|---|---|---|
| Customer accounts | ✅ | **Live** — password register/login (guest-first & optional), a guest record is *claimed* into an account, profile edit, marketing opt-in. Profile menu in the header doubles as sign-in and the staff-portal gateway. Email verification deferred to Resend (Phase 2). |
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
| Live chat | 🟡 | Concierge widget stores to DB, admin replies (not real-time) | Real-time presence, agent routing, or 3rd-party (decision) |

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
| Performance | 🟡 | Edge + code-split SPAs, small bundles | Image pipeline (R2 + resizing), Lighthouse pass, font strategy |

### E. Fragrance Discovery & Merchandising — *conversion features; several ride F1/F2*
| Capability | Status | Notes |
|---|---|---|
| Fragrance finder / quiz | ⬜ | Guided quiz → recommended scents |
| Product comparison | ⬜ | Side-by-side notes/family/price |
| Layering suggestions | ⬜ | "Pairs well with" from scent-family graph |
| Personalized recommendations | ⬜ | Rides F1 identity + F2 events |
| Gift finder | ⬜ | Filter by recipient/occasion/budget |
| Discovery / sample sets | ⬜ | Partly a catalogue product-type + partly UX |
| Consultation booking | ⬜ | Slot booking → calendar; ties to CRM |
| Back-in-stock notifications | ⬜ | We already flag low/out stock; needs identity + email + stock event (F1/F2) |

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
| Backups | ✅ | D1 Time Travel (30-day PITR) **plus** a daily GitHub Action `wrangler d1 export` artifact | — |
| Security headers | ✅ | `_headers`: nosniff, HSTS, frame-options, referrer-policy, permissions-policy; `/admin` noindex | Tuned CSP (later, once pixel domains settle) |
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
| **GitHub Actions** (`.github/workflows/deploy.yml`) | lint → build → **apply D1 migrations** → deploy → sync secrets → smoke tests → **headless render check** | ✅ the source of truth |
| **Cloudflare Workers Builds** (dashboard-connected) | `npm clean-install` → `npx wrangler deploy` — **no build step** | ❌ was failing |

Workers Builds failed with `The directory specified by the "assets.directory" field
does not exist: /opt/buildhome/repo/dist` because `dist/` is a gitignored build
artifact and that pipeline never ran `npm run build`.

**Recommendation: disable Workers Builds and keep GitHub Actions.** Two pipelines on
one push means double deploys and a race — and Workers Builds skips database
migrations, linting and the render check, so it can ship code ahead of its schema.
Disable it in the dashboard: **Workers & Pages → majestic-roobee → Settings → Builds
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
