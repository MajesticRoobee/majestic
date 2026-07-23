# Majestic Roobee — Perfume Ecommerce Platform

Full-stack ecommerce platform for Majestic Roobee (extrait perfumes, body mists & feminine care — Abuja · Lagos · Ibadan), built from the Claude Design handoff bundles:

- **Storefront** (`/`) — home, shop with filters/search, product detail with per-store availability, cart, guest checkout (Paystack / bank transfer / WhatsApp), order confirmation, guest order tracking, about, contact + live-chat concierge, lead-capture popup, NGN/USD currency toggle, city-based store routing.
- **Admin** (`/admin/`) — passphrase login, dashboard (revenue KPIs, 14-day chart, revenue by location, top products, recent orders with status updates, completed vs abandoned checkouts), inventory per store with steppers & restock, product catalogue with draft/live toggle and "add product", sales & promo codes, notifications/campaign composer with live previews (popup, banner, email, push), customer-service inbox with threads & canned replies, and store/content settings that drive the storefront.

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
| `PAYSTACK_SECRET_KEY` | Optional — enables live Paystack checkout |

To deploy from a machine instead: `wrangler login`, then `npm run deploy` and `wrangler secret put` for the secrets above. After enabling Paystack, point its webhook to `https://<your-domain>/api/paystack/webhook`.

Without `PAYSTACK_SECRET_KEY`, card orders are still recorded (as awaiting payment) so nothing breaks in development.

## How the ecommerce logic works

- **Store routing** — an order is fulfilled from the shopper's city store when it holds every item; otherwise it routes to the nearest store holding the full order (cross-city ETA/fee applies). Stock is reserved (decremented) at the fulfilling store when the order is placed.
- **Pricing** — totals are always recomputed server-side: subtotal, promo discount (scoped: storewide / fragrances / gift packages / feminine care; % off, ₦ off, or free delivery), delivery fee by store (free Abuja delivery above the configured threshold), click-&-collect is free.
- **Payment states** — orders are created `pending` and only marked `paid` after server-side Paystack verification (redirect verify + signed webhook) or manual confirmation.
- **Tracking** — guests track with order number + the phone/email used at checkout; timelines update as the admin moves order status.
- **Admin ↔ storefront sync** — settings, store details, promos, stock, drafts, and banner campaigns all live in D1, so admin edits are immediately visible to shoppers.

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
