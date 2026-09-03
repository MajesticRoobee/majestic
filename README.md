# Majestic Roobee — Perfume Ecommerce Platform

Full-stack ecommerce platform for Majestic Roobee (extrait perfumes, body mists & feminine care — Abuja · Lagos · Ibadan), built from the Claude Design handoff bundles:

- **Storefront** (`/`) — home (a banner hero, the shelf tiles and a **daily deal** counting down beside them), shop with filters/search, the merchandising shelves (new arrivals, deals, best sellers, gift sets), categories with sub-shelves, brands, stores, a wishlist, the journal (blog), reviews & testimonials, product detail with per-store availability, cart, guest checkout (Paystack / bank transfer / WhatsApp), order confirmation, guest order tracking, about, contact + live-chat concierge, lead-capture popup, live purchase notes, NGN/USD currency toggle, city-based store routing.
- **Admin** (`/admin/`) — passphrase login, dashboard (revenue KPIs, 14-day chart, revenue by location, top products, recent orders with status updates, completed vs abandoned checkouts), inventory per store with steppers & restock, product catalogue with draft/live toggle and "add product", collections, categories & sub-shelves, deals, **daily deals** (a scheduled countdown offer whose price is the price charged), the blog, reviews & testimonials, sales & promo codes, notifications/campaign composer with live previews (popup, banner, email, push), customer-service inbox with threads & canned replies, and store/content settings that drive the storefront.

## Stack

| Layer | Tech |
| --- | --- |
| Hosting & API | **Cloudflare Workers** (one Worker: static assets + JSON API via [Hono](https://hono.dev)) |
| Database | **Cloudflare D1** (SQLite) — products, variants, per-store stock, orders + timelines, promos, campaigns, inquiries, leads, abandoned checkouts, settings |
| Frontend | React 18 + Vite (two SPA entries: storefront and admin) |
| Payments | Paystack (server-side init + verify + signed webhook), with bank-transfer and WhatsApp fallbacks |

## Local development

```bash
npm install
npx wrangler d1 migrations apply majestic-roobee --local   # create + seed local DB
npm run dev:worker                                          # build UI + run worker on :8787
```

Open http://127.0.0.1:8787 (storefront) and http://127.0.0.1:8787/admin/ (admin — dev passphrase `majestic-dev`).

For UI iteration with hot reload, run `npm run dev` (Vite on :5173, proxying `/api` to the worker) alongside `npx wrangler dev`.

## Deploying to Cloudflare

The production D1 database (`majestic-roobee`, id in `wrangler.jsonc`) is already provisioned and seeded. Deploys run through GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`, or manually via *Actions → Deploy to Cloudflare → Run workflow*.

Required repository secrets (*Settings → Secrets and variables → Actions*):

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token with the **Edit Cloudflare Workers** template |
| `ADMIN_PASSWORD` | Admin portal login passphrase |
| `ADMIN_TOKEN_SECRET` | Random string that signs admin session tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Only needed if the token can see multiple accounts |
| `PAYSTACK_SECRET_KEY` | Enables card payment — see below |

To deploy from a machine instead: `wrangler login`, then `npm run deploy` and `wrangler secret put` for the secrets above.

## Paystack

The integration uses Paystack's **redirect** flow, so there is only ever one
credential to hold: the **secret key**. No public key is needed, and none is
shipped to the browser.

### Where the key goes

| Environment | Where | How |
| --- | --- | --- |
| **Production** | GitHub → *Settings → Secrets and variables → Actions* | Add `PAYSTACK_SECRET_KEY`. The deploy workflow pushes it to the Worker on the next run. |
| **Production, without a deploy** | Cloudflare | `npx wrangler secret put PAYSTACK_SECRET_KEY` |
| **Local** | `.dev.vars` (gitignored) | `PAYSTACK_SECRET_KEY=sk_test_…` |

Use the **test** key (`sk_test_…`) from *Paystack Dashboard → Settings → API Keys
& Webhooks* until you have made a full test purchase. Swap in the live key
(`sk_live_…`) only when you want real cards charged.

### The webhook

Point Paystack at:

```
https://<your-domain>/api/paystack/webhook
```

Set it in the same dashboard panel as the keys. This is the leg that arrives
even when the shopper closes the tab on their bank's 3-D Secure page, so
payment still settles. It is signature-verified; unsigned requests are refused.

### Checking it worked

*Admin → Integrations* shows a **Payments** panel: whether a key is present,
whether it is a test or live key, the webhook URL to copy, and a log of every
exchange with Paystack — including charges that were **refused** for the wrong
amount. If the panel says "Not connected", the card option is hidden at
checkout entirely rather than failing at the last step.

### What the server guarantees

- An order is marked paid only when Paystack confirms a successful charge for
  the **exact amount and currency** this server initialized. A charge for a
  different amount is logged as a mismatch and settles nothing.
- The redirect leg and the webhook race by design; settlement is idempotent, so
  whichever arrives second changes nothing and does not re-send the
  post-purchase email.
- An unpaid card order holds its stock for 45 minutes, then the cron releases it
  — after re-checking with Paystack, so an order paid at the last second is
  rescued rather than cancelled.
- Card orders require a valid email address, because that is what a Paystack
  transaction is keyed to.

### Test cards

Paystack's test cards work with a `sk_test_` key — see
<https://paystack.com/docs/payments/test-payments/>. The standard success card
is `4084 0840 8408 4081`, any future expiry, any CVV, OTP `123456`.

## How the ecommerce logic works

- **Variable products** — a product is a parent; each variation (a size, a scent) is a SKU-level record with its own price, photo, per-store stock, sort order and active flag. The storefront shows one listing card with a picker on it — swatch chips, falling back to a dropdown past four options — and the price, availability badge, photo and add-to-cart button all follow the selection. A product can opt into `split_listing` to appear as one card *per* variation instead, for gift sets and distinct scents where a picker would hide the choice. Each variation has its own URL (`/product/<id>?variant=<sku>`), its own canonical tag and its own entry in the page's JSON-LD `AggregateOffer`, so a shared link resolves to the size the shopper was looking at.
- **Variation identity** — carts, order lines and waitlist entries address a variation by its id, not by its size text, so renaming a size never orphans a cart or breaks a back-in-stock alert. Carts saved by an older build (which keyed on size) still resolve through a fallback.
- **Store routing** — an order is fulfilled from the shopper's city store when it holds every item; otherwise it routes to the nearest store holding the full order (cross-city ETA/fee applies). Stock is reserved (decremented) at the fulfilling store when the order is placed.
- **Pricing** — totals are always recomputed server-side: subtotal, promo discount (scoped: storewide / fragrances / gift packages / feminine care; % off, ₦ off, or free delivery), delivery fee by store (free Abuja delivery above the configured threshold), click-&-collect is free.
- **Payment states** — orders are created `pending` and only marked `paid` after server-side Paystack verification (redirect verify + signed webhook) or manual confirmation.
- **Tracking** — guests track with order number + the phone/email used at checkout; timelines update as the admin moves order status.
- **Admin ↔ storefront sync** — settings, store details, promos, stock, drafts, and banner campaigns all live in D1, so admin edits are immediately visible to shoppers.

## The storefront's shelves

The header carries the shelves a fragrance shopper expects — **All categories**,
New arrivals, Deals, Best sellers, Brands, Locations, Journal, Reviews — and each
is a real, linkable, indexable URL rather than a filter the browser holds:
`/new-arrivals`, `/deals`, `/best-sellers`, `/gift-sets`, `/brand/<name>`,
`/shop?category=<id>`, and any of those combined (`/deals?category=mist`).

Three of the four shelves are **computed, not curated** (`worker/merch.js`), so
nobody has to keep a list up to date:

| Shelf | What it reads | Admin's hand on it |
| --- | --- | --- |
| New arrivals | Products listed inside the last *n* days (Settings, default 45), newest first | "Pin to New arrivals" on the product |
| Best sellers | Units sold on **paid, uncancelled** orders over the last *n* days (Settings, default 90) | "Pin to Best sellers" on the product |
| Gift sets | Every category grouped as **Gift & sets** in Admin → Categories | The grouping itself |
| Deals | A deal that is inside its window, plus anything priced below its own compare-at price | Admin → Deals |

A shelf that would otherwise come back nearly empty is topped up in the shop's
own catalogue order — an empty tab reads as a broken store. The two shelves
where emptiness is honest (no sets, nothing marked down) stay empty.

**Categories are content**, not seed data: Admin → Categories adds, renames,
describes, groups, reorders and hides them, and each one chooses which of the
three sub-shelves it offers shoppers. The header's mega-menu is built from that
table, so a new category appears in it without a deploy. A category with
products filed under it is refused deletion (with the count) rather than
cascading — move them, or hide it.

**Deals vs promo codes** — a promo code is something the shopper *types*; a deal
is something they *see*. A deal names its products, carries a badge and runs
between two dates, so it leaves the storefront by itself when the window closes.

## Wishlist, journal, reviews and purchase notes

- **Wishlist** — guest-first. Saving something never demands an account: the
  list lives in the shopper's browser and is handed to the server the moment
  they sign in or register (`POST /api/account/wishlist/merge`), so nothing is
  lost at the point of registration. Signed in, it is the same list everywhere.
- **The journal** (`/blog`) — written in Admin → Blog as plain text: a blank
  line between paragraphs, `## ` for a heading, `> ` for a pull quote, and a
  bare image URL on its own line for a picture. Drafts are invisible until
  published; the publish date is stamped once, so editing a live post doesn't
  reorder the journal. Posts carry `BlogPosting` markup and appear in the
  sitemap.
- **Reviews & testimonials** (`/reviews`) — the customer's own post. Paste an
  Instagram post or reel, a TikTok, a YouTube video or a direct video file and
  the server reduces it to the post's id, so a copied link with tracking on it
  still renders and the platform never has to be picked from a menu. Each is
  framed through that platform's **own** `/embed` URL: no third-party script
  runs on the store. A link we don't recognise becomes a written quote card
  rather than a broken frame. (`public/_headers` names exactly those four frame
  origins in the CSP.)
- **Live purchase notes** — "Dorothy from Abuja purchased Osk 30ml", from real
  orders. Two rules make that safe on a public endpoint: only ever a **first
  name** and a city, and only orders that were actually **paid for** — an
  abandoned card attempt is not a purchase. The window, the interval and the
  off-switch are in Settings; a shopper who dismisses it doesn't see it again
  that visit.

## Connecting the ERP

The ERP is the system of record for what exists and what it costs. It pushes a flat list of SKU rows to `POST /api/v1/catalog/sync`, authenticated with an API key issued in *Admin → Integrations* with the **write** scope. Each row carries the parent/style code that groups it with its siblings, which is what turns the feed into variable products here.

```bash
curl -X POST https://<your-domain>/api/v1/catalog/sync \
  -H "authorization: Bearer <write-scoped key>" \
  -H "content-type: application/json" \
  -d '{
    "source": "acme-erp",
    "dryRun": true,
    "items": [
      { "parentId": "STY-100", "parentName": "Velvet Reign", "category": "extrait",
        "externalId": "SKU-100-30", "sku": "VR-30", "size": "30ml", "priceNgn": 28000,
        "imageUrl": "https://…/vr-30.jpg", "stock": { "abuja": 12, "lagos": 3, "ibadan": 0 } },
      { "parentId": "STY-100", "externalId": "SKU-100-50", "sku": "VR-50",
        "size": "50ml", "priceNgn": 46000, "compareAtNgn": 52000 }
    ]
  }'
```

| Field | Meaning |
| --- | --- |
| `parentId` | **Required.** The ERP's parent/style code. Rows sharing one become variations of a single product. A row without it is skipped and reported. |
| `externalId` | **Required.** The ERP's own id for this SKU. Upserts key on it. |
| `size` / `option1`–`option3` | The variation's label. Multiple options join as "50ml / Gold". |
| `priceNgn`, `compareAtNgn` | Price and optional was-price, in naira. |
| `sku`, `imageUrl`, `sort`, `active` | The variation's own code, photo, position and on/off. |
| `stock` | `{ abuja, lagos, ibadan }`. Set absolutely, not as a delta. Omitted stores are left alone. |
| `parentName`, `category`, `gender`, `notes`, `description`, `optionNames` | Parent-level fields, read from the first row of each group. Absent fields never overwrite merchandising done in the admin. |

Behaviour worth knowing:

- **Idempotent.** Upserts key on `(source, parentId)` and `(source, externalId)`, so re-sending the same feed updates in place rather than duplicating. A failed sync can simply be retried.
- **Adopts, doesn't shadow.** A parent the ERP has never sent but whose slug already exists is attached to the product already in the catalogue, so the first sync lands on the live catalogue instead of shadowing it.
- **Drafts by default.** New products arrive hidden from the storefront unless the feed passes `"publish": true`, so a mis-mapped import can't dump straight onto the shop.
- **`dryRun`.** Returns the same counts and errors without writing anything — run it first when wiring up a new feed.
- **Audit.** Every run is recorded; read the last 20 at `GET /api/v1/catalog/syncs`.

## Repo layout

```
migrations/        D1 schema + seed
worker/            Hono API (shop.js public, admin.js authed, util.js helpers)
src/ds/            Design system (tokens + components ported from the handoff)
src/storefront/    Storefront SPA
src/admin/         Admin SPA
index.html         Storefront entry     admin/index.html   Admin entry
wrangler.jsonc     Worker + D1 + assets config
```
