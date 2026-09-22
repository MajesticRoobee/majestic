# Sprint 3 — Smart shopping, insights, and the ERP link

The client's next round, read against what the platform already is. Companion to
[`BUILD-MAP.md`](./BUILD-MAP.md) (the architectural map) and
[`PROJECT-TRACKER.md`](./PROJECT-TRACKER.md) (the running list). When a line here
ships, move it into the tracker with its date.

**Status** `✅ Done` · `🔄 In progress` · `⬜ To do` · `🔑 Blocked — needs an account, key or decision`

---

## 0. What was asked, and what it actually is

Seven asks came in. Underneath them sit **three** pieces of work and a pile of
settings:

| # | The ask | What it really is |
|---|---------|-------------------|
| 1 | Smart shopping & insights — abandoned cart, "clicked but never added", "other features that convert" | **A new foundation.** The store has no record of a *visit*. It records orders, and it records an abandoned cart only once someone has typed their name and contact into checkout. Everything asked for here needs a behavioural stream that does not exist yet. |
| 5 | Curate "Best sellers" and "Ready at your store" | **One feature with #6.** Both are homepage shelves that compute themselves. What is missing is a *source* switch — automatic, curated, or automatic-with-pins. |
| 6 | Home Fragrance band should look like the Feminine Care band; banner images editable; ability to create and replace banners | Same feature. `ProductBand` (Feminine care) and `CtaBand` (Home fragrance) are two components with hardcoded copy. The real ask is that **the home page becomes data**. |
| 3 | ERP link — update inventory from their ERP | **Half-built already.** `POST /api/v1/catalog/sync` accepts an ERP feed today, upserts idempotently on the ERP's own ids, and sets stock absolutely. What is missing is the *pull* direction, an adapter that reads the ERP's own shapes, the warehouse↔store map, and the write-back. |
| 2 | Customisable low-stock level | **Two lines of UI and a real alert.** `lowStockThreshold` already exists in `settings` and is already on the PUT allow-list in `worker/admin.js:933`. Nothing renders it. And "low stock" is only a *number on the dashboard* — nobody is notified. |
| 4 | Replace About Us with the blog | Navigation + a decision about the founder's story (below). |
| — | Privacy policy and other admin-side details | **The legal pages are hardcoded JSX** (`PrivacyPage`, `pages.jsx:1478`). They need to be content, like the blog already is. |

So the sprint is: **one foundation (F4), one merchandising system, one connector,
and a settings sweep.**

---

## 1. Foundation F4 — the behavioural stream

### Why this is the load-bearing piece

The build map's F1–F3 (identity, events, integrations) are live. F2's event log
records **what the business did** — an order was placed, a status changed, a cart
with a name on it went cold. What nobody records is **what a visitor did**.

That is why the client's first ask cannot be answered today:

- *"Abandoned cart"* — `abandoned_checkouts` is keyed on `contact_key`
  (`0001_schema.sql:148`) and the heartbeat in `App.jsx:632` only fires once a
  shopper has typed a name **and** a phone or email on the checkout page. A
  shopper who fills a cart and closes the tab is invisible.
- *"Clicked but didn't add anything to cart"* — nothing anywhere records a click,
  a product view, or a session. The pixels (GA4, Meta, TikTok) see some of it,
  but that data lives in someone else's dashboard, dies behind the cookie
  banner, is blocked for a large share of real traffic, and can never be joined
  to a customer record or acted on by the store.

Everything else in §4 rides this. Build it once.

### The shape

Three tables and one endpoint. First-party, on the store's own domain, in the
store's own D1 — so it is not blocked, not sampled, and is joinable to
`customers` and `orders`.

```
sessions           id, visitor_id, customer_id, started_at, last_seen,
                   entry_path, referrer, utm_source/medium/campaign,
                   device, country, city_pref, is_bot, orders, revenue

session_events     id, session_id, type, product_id, variant_id,
                   value_ngn, meta (JSON), at

insight_daily      day, metric, dim, value      -- the rollup the admin reads
```

`visitor_id` is a random first-party id in `localStorage`, created on first
visit. It is not a marketing cookie and not shared with anyone — see §1.4.

**Event types**: `page_view`, `view_item`, `view_category`, `search`,
`search_no_results`, `add_to_cart`, `remove_from_cart`, `begin_checkout`,
`checkout_step`, `purchase`, `wishlist_add`, `waitlist_join`, `nudge_shown`,
`nudge_clicked`.

### 1.1 Collection

| Piece | Detail |
|---|---|
| `POST /api/track` | Batched. The client buffers events and flushes on a 5s timer and on `pagehide` via `navigator.sendBeacon`. One request carries many events, so a busy session costs a handful of writes, not a hundred. |
| Payload discipline | No PII on the wire, ever — ids, types, paths and amounts only. A name or an email in a payload is dropped server-side, not stored and filtered later. |
| Bot filtering | Cloudflare's own signals plus a UA check, flagged as `is_bot` at write time rather than filtered at read time, so the rollups are clean and the raw log is still honest. |
| Rate limiting | Rides `worker/ratelimit.js`, already D1-backed. Per visitor and per IP, with a hard cap on batch size and events per session. |
| Stitching | When a visitor signs in, registers, or places an order, the session's `customer_id` is filled in — and so is every earlier session carrying the same `visitor_id`. That is what turns "someone looked at this four times" into "*this customer* looked at this four times". |

### 1.2 Rollups and retention

D1 is SQLite. A dashboard that scans raw events will be fine at a thousand
sessions and unusable at a million, and by then the fix is a rewrite. So:

- The existing `*/15` cron rolls the previous window into `insight_daily`.
- The admin reads rollups for anything historical, raw events only for "right
  now" and for a single-session drill-down.
- Raw events are pruned on a configurable window (default 90 days), rollups are
  kept forever. The window is a setting, because retention is a legal question
  the house may want to answer differently later.
- A guard on the prune: never delete a session that carries an order.

### 1.3 Segments

The segments are the product. Each one is a saved query over the stream, each
carries a count and a list in the admin, and each has an action attached.

| Segment | Definition | The action it unlocks |
|---|---|---|
| **Cart abandoned — identified** | items in cart, no order, contact known | ✅ exists; extend to fire on the *cart*, not just the checkout form |
| **Cart abandoned — anonymous** | items in cart, no order, no contact | On-site nudge on this or the next visit; cart-recovery link if they ever identify |
| **Browsed, never added** | ≥2 `view_item`, 0 `add_to_cart`, session ended | The client's exact ask. Exit-intent offer, and a "pick up where you left off" rail next visit |
| **Bounced on a shelf** | entered, viewed one category, left | Tells merchandising *which shelf* is failing, not just that traffic is |
| **Checkout drop-off** | `begin_checkout`, no `purchase`, bucketed by last step reached | The funnel, by stage — delivery details vs payment vs the ways-to-pay screen |
| **Repeat visitor, never bought** | ≥3 sessions, 0 orders | Target the first-order pop-up at *these people* instead of everyone |
| **High intent** | same product viewed ≥3× across sessions, or wishlisted, no purchase | Price-drop / back-in-stock / a reward code, aimed at someone already decided |
| **Sold-out demand** | `view_item` on an out-of-stock variation, plus waitlist joins | A restock priority list ranked by money left on the floor — see §2 |
| **Searched and found nothing** | `search_no_results` | What customers want that the house does not sell, or does sell under another name |
| **Deal-only** | views and buys only ever on marked-down pieces | Who a deal is actually for |
| **Lapsed** | bought, nothing in N days | Win-back, riding the automation engine that already exists |

Every segment is a row in a `segments` definition table so the house can rename
one, retune a threshold, or switch it off without a deploy.

### 1.4 Privacy — non-negotiable, and it ships *with* this

This is first-party analytics of the store's own shop, stored on the store's own
infrastructure, shared with nobody. That is a defensible position, and it is only
defensible if it is stated plainly and honoured:

- The privacy page says exactly what is collected and why — and it becomes
  editable in the same sprint (§5), so the house owns that sentence.
- A visible **"don't measure my visit"** control that actually stops collection,
  alongside the existing cookie banner.
- Respect `Do Not Track` / `Sec-GPC`.
- No PII in the stream. The `visitor_id` is meaningless outside this store.
- Configurable retention, and a delete-my-data path that reaches sessions too,
  not just `customers`.

---

## 2. Smart shopping — what we build on the stream

Ordered by *conversion lift per day of work*. The first four need no email
provider, no external account, and no client decision — they work on the
storefront the moment the stream is live.

| # | Feature | What it does | Rides |
|---|---|---|---|
| 1 | **Cart recovery links** | A signed URL that restores the exact cart in one tap. Makes the abandoned-cart automation that already exists actually convert instead of dropping someone on the home page | F4 + existing outbox |
| 2 | **On-site abandonment nudge** | Exit-intent (desktop) / scroll-and-idle (phone) for the two abandon segments. Configurable copy, offer and frequency cap; off by default until the house writes the copy | F4 |
| 3 | **"Pick up where you left off"** | A rail of recently-viewed and left-in-cart pieces, on the home page and in the header drawer. Works for anonymous visitors — most of the traffic | F4 |
| 4 | **Low-stock urgency** | "Only 3 left in Abuja" on the product page, driven by the *same* threshold as the admin alert (§3) so the shop and the back office never disagree | §3 |
| 5 | **Free-delivery progress** | "₦3,400 more for free delivery" in the cart. `freeShipAbujaOver` already exists and is already enforced; it is simply never shown to the person it would move | — |
| 6 | **Also viewed / also bought** | A co-view graph computed on cron from the stream. Real personalisation from the house's own data, on the product page and after add-to-cart | F4 |
| 7 | **Back-in-stock demand board** | Sold-out variations ranked by views + waitlist size, with the money left on the floor named. Turns lost demand into a purchase order | F4 + §3 |
| 8 | **Targeted first-order pop-up** | The pop-up exists and shows to everyone. Show it to the repeat-visitor-never-bought segment instead, and leave first-time browsers alone | F4 |
| 9 | **Zero-result search → action** | Every term that found nothing, with "create this product" / "point it at this one" beside it. Also an SEO brief written by customers | F4 |
| 10 | **Post-add cross-sell** | One suggestion in the cart drawer, from the co-view graph, or from scent family where the graph is still thin | 6 |

Deliberately *not* in this sprint, and worth naming so it is a decision rather
than an omission: the fragrance-finder quiz, gift finder, and product comparison
(all on the build map, all discovery rather than conversion) — and loyalty
points, which wants its own ledger and its own sprint.

### 2.1 The Insights screen — Admin → Insights

One screen, a date range at the top, and everything reads rollups:

- **The funnel** — visitors → product views → carts → checkouts → paid, with the
  drop-off named at each step and last period beside it.
- **Conversion rate, revenue per visitor, AOV**, each against the previous period.
- **Segments**, as counts. Click one, get the list, act on it.
- **Product intelligence** — by views, and by **view-to-cart rate**. A product
  with many looks and no carts is a price, a photograph or a description
  problem, and today nothing in the admin can tell the house which products
  those are.
- **Where people come from** — referrer and UTM, first-party, so it still works
  for the visitors whose pixels never load.
- **Searched and found nothing**.
- **Sold-out demand**.
- **Abandoned carts**, extended to the anonymous ones, with the recovery link.

---

## 3. Low stock, properly ⬜

The setting exists (`lowStockThreshold`, default 5, `0002_seed.sql:189`), the
worker reads it (`worker/admin.js:201`), the admin reads it
(`src/admin/App.jsx:261`) — and no screen lets anyone change it.

| Piece | Detail |
|---|---|
| **The control** | Settings → Inventory. The global default, in the panel with its own save, like every other section |
| **Per-variation override** | `ALTER TABLE variants ADD COLUMN low_stock_at INTEGER` — `NULL` means "use the global". A 3ml sample and a ₦180,000 extrait do not run low at the same number |
| **Days-of-cover mode** | Optional: instead of a flat count, alert when stock falls below N days of recent velocity. The sales data is already there; this is the version that is actually right for a store selling 20 of one thing and one of another |
| **Per-store** | The threshold applies per store, because the stock does. A store that turns 10 a day needs a different line than one that turns one a week |
| **A real alert** | Today `lowCount` is a number on a dashboard nobody is watching at 6pm. Emit `inventory_low` and `inventory_out` into the event log, seed two automations against them, and badge it in the admin nav. It then rides the same outbox as everything else and starts emailing the moment Resend is connected |
| **On the storefront** | The same threshold drives "Only N left" (§2.4) |

---

## 4. The home page becomes data ⬜

This answers asks **5** and **6** together, and the review note.

### 4.1 What is hardcoded today

- `PROMO_TILES` (`pages.jsx:19`) — three fixed shelves. Only the *photograph*
  is editable, via three fixed settings keys. The comment says so outright.
- The Feminine care band is a `ProductBand` with its copy written into the JSX
  (`pages.jsx:327`). The Home fragrance band is a `CtaBand` (`pages.jsx:394`) —
  no picture, no products. **That is the difference the review is pointing at.**
- "Best sellers" and "Ready at your store today" are computed and cannot be
  curated — `computeSegments` in `worker/merch.js`, with a `pinBest` flag on the
  product as the only lever.

### 4.2 What replaces it

```
home_blocks          id, kind, sort, live, eyebrow, title, sub, lines,
                     cta_label, cta_target, image_url, source, ref_id, layout
home_block_products  block_id, product_id, sort
```

`kind` is one of `tiles` · `band` · `shelf` · `story` · `reviews` · `blog` ·
`newsletter`. `source` is `auto` · `manual` · `category` · `collection` ·
`segment`. `layout` picks the look — the picture-and-products band (Feminine
care), the plain call-to-action band, or the full-width tile.

That gives the house, from **Admin → Home page**:

- Reorder every block on the home page, or switch one off.
- Rewrite any heading, subheading or button label without a deploy.
- Set the photograph on any band or tile, through the `ImagePicker` that already
  uploads to R2 and builds the four responsive widths.
- **Create a new band or banner** — the client's ask — rather than choosing from
  three.
- **Curate Best sellers and Ready at your store**: pick products by hand, or
  leave it automatic, or automatic-with-pins.

### 4.3 One rule worth writing down

A curated shelf is still **filtered by what is actually buyable**. "Ready at your
store today" that names a piece the store does not have is worse than no shelf at
all. So a manual list is the *preferred order*, filtered by availability in the
shopper's city, topped up in catalogue order — exactly the `topUp` behaviour
`worker/merch.js` already uses for the computed shelves. Same rule, one system.

### 4.4 Home Fragrance, specifically

The immediate fix the review asked for: Home Fragrance becomes a picture band
with real products in it, like Feminine Care. Under §4.2 it is a `band` block
with `layout: product-band`, `source: category`, `ref_id: home` and an image —
which means the house can then do the same for Wellness, Massage Oils or
anything else, without another ticket.

Seeded so the home page on day one is exactly what it is today, then editable.
Nothing changes visually until someone changes it.

---

## 5. Settings & content sweep ⬜

### 5.1 Legal pages become content

`PrivacyPage` is hardcoded JSX, down to "Last updated July 2026". So is the FAQ.
The blog already solved this problem properly — plain text, `## ` for a heading,
`> ` for a quote, rendered by `PostBody`, never handed to
`dangerouslySetInnerHTML`. Reuse it exactly.

```
content_pages   slug, title, body, live, updated_at, seo_title, seo_desc
```

Seeded with the current privacy copy so nothing is lost, plus stubs for **Terms
& conditions**, **Returns & refunds**, **Shipping & delivery** and **Cookie
policy** — all four linked from the footer today or expected by shoppers, none
of which exist. Admin → Pages edits them. The footer reads the live list, and
they go into the sitemap.

### 5.2 Everything else still frozen in JSX

An audit pass, then one panel each in Settings:

| Frozen today | Where |
|---|---|
| The founder's story (six paragraphs) | `pages.jsx:34` |
| "The products your intimate area needs" and every band heading | §4 fixes these |
| "What's your fragrance personality?" and the CTA bands | §4 |
| The three perk cards under the hero | `pages.jsx:294` |
| The four reward steps | `pages.jsx:80` |
| FAQ questions and answers | `pages-content.jsx` |
| Privacy, and the legal pages that don't exist yet | §5.1 |

### 5.3 Low stock

§3 adds its own panel.

---

## 6. About Us → the blog ⬜

Mechanically small: `NAV_TABS` (`chrome.jsx:139`), `RAIL_FOOTER`
(`chrome.jsx:153`), the phone drawer (`chrome.jsx:486`).

**One decision, because it can destroy content.** The founder's story is six
paragraphs the client wrote, and it carries the brand. Three options:

| | What happens to `/about` |
|---|---|
| **A — chosen** | The header tab becomes **Blog**. `/about` stays live, linked from the footer as "Our story", from the menu, from the mobile drawer and from the story band on the home page. Nothing is lost; the blog gets the slot it was asked to get |
| B | The story moves into a pinned blog post and `/about` redirects to it. One fewer page, story preserved, old links land somewhere sensible |
| C | `/about` is deleted outright |

**A**, confirmed by the client on 13 Sep: don't delete About Us, just take it
off the header. Shipped.

While the blog holds a primary slot it should look like it deserves one: a
featured post at the top of `/blog`, pagination (it currently renders every post
on one page), and the tag chips it already has.

---

## 7. The ERP link — pull ✅, write-back 🔑

**The assumption that stood here was wrong, and the scar is worth leaving.**
This section used to open: *"'ERPrev' is **ERPNext** (the Frappe-framework
ERP). Everything below is written against its REST API."* It isn't. ERPrev is
**ERPRevolution** — a different product, from a different company, with a
different API. The client corrected it on 22 Sep, after a first version of the
connector had been built end to end against Frappe.

Two things went wrong and only one of them was the guess:

1. **Nobody asked.** An abbreviation was expanded by inference, and the
   inference was written down as a premise rather than as a question. It then
   sat in a planning document long enough to read as settled.
2. **The same paragraph promised the mitigation, and the build didn't deliver
   it** — "the adapter is built behind a generic interface, so if it turns out
   to be Odoo, Zoho or SAP Business One, the transport changes and the sync
   engine does not". There was no interface. Frappe's field names were spread
   through the engine, and correcting the vendor meant rewriting the module.

There is one now, and it is the real thing: `worker/erp-adapters.js` holds
everything vendor-shaped behind four neutral rows, `worker/erp.js` knows
nothing about any ERP, and the tests prove each half separately so the engine
cannot quietly re-acquire a vendor's schema. **Which ERP is a setting, not a
deploy.** The generic adapter is alias-driven and reads most SME REST APIs
without being told anything; where it guesses wrong, the admin's probe prints
the ERP's own keys, so the answer is read rather than guessed a second time.

Everything from §7.1 to §7.3 below describes the machinery in ERPNext's terms
because that is the vocabulary it was written in. The machinery is unchanged;
substitute ERPRev's names for Frappe's DocTypes and it still reads true.

### 7.1 What already exists

`POST /api/v1/catalog/sync` (`worker/integrations.js:80`) is a real ERP ingest
and it is better than it needs to be:

- Groups a flat SKU feed by the parent/style code into variable products —
  which is **exactly** ERPNext's `variant_of` / Item Variant shape.
- Upserts on the ERP's own identifiers, so re-sending a feed is idempotent and a
  failed sync can simply be retried.
- *Adopts* a product already in the catalogue rather than shadowing it, so the
  first sync attaches to the live catalogue.
- Leaves absent fields alone, so merchandising done in the admin survives a
  sparse ERP row.
- Sets stock **absolutely** per store, because the ERP is the system of record
  for counts.
- Dry-run mode, and a `catalog_syncs` audit table.

So this is not a build from nothing. It is an ERPNext-shaped adapter on top.

### 7.2 What to build

**Transport 1 — pull, on a schedule (the default).** The Worker calls ERPNext.
Auth is a header: `Authorization: token <api_key>:<api_secret>`.

| ERPNext | Reads | Becomes |
|---|---|---|
| `GET /api/resource/Item` | `item_code`, `item_name`, `variant_of`, `has_variants`, `item_group`, `description`, `image`, `disabled`, `modified` | Template Item → our product; variant Item → our variation. `variant_of` is the `parentId` the sync already wants |
| `GET /api/resource/Item Price` | `item_code`, `price_list_rate`, filtered on one chosen Price List | `price_ngn` |
| `GET /api/resource/Bin` | `item_code`, `warehouse`, `actual_qty`, `reserved_qty`, `projected_qty` | Per-store stock, through the warehouse map below |
| `GET /api/resource/Item Variant Attribute` | attribute / value | The option labels (Size, and up to two more) |

Incremental: filter on `modified > last_sync`, so the 15-minute run is cheap and
only the nightly reconcile is a full read.

**Transport 2 — push, for stock in near-real-time.** ERPNext ships a **Webhook**
DocType. Point it at `POST /api/v1/erp/webhook` on Item and Stock Ledger Entry
events, HMAC-verified against a shared secret. Webhooks drop; the scheduled pull
stays on as the reconciler. Belt and braces, and the belt is already there.

**Transport 3 — manual.** A "Sync now" button and a CSV import, for the day the
network is the problem.

**Write-back — the store to ERPNext.** This is what stops the two systems
drifting. On `order_paid`, create a **Sales Order** (or Sales Invoice + Delivery
Note, depending on their process) via `POST /api/resource/Sales Order`. It rides
a retrying outbox like every other outbound action here, so a network blip
doesn't silently lose a sale from the ledger.

### 7.3 The parts that actually decide whether this works

| Piece | Why |
|---|---|
| **Warehouse ↔ store map** | An admin-edited table. ERPNext's warehouse names will not be our store ids, and guessing is how stock lands in the wrong city |
| **Field ownership matrix** | Per field, who wins. Default: **ERP owns price and stock; the store owns name, description, photography, category and shelf order.** Otherwise the first sync flattens the merchandising |
| **The empty-feed guard** | Refuse any sync that would zero more than a configured share of the catalogue. An expired API key that returns `[]` must not empty the shop. This is the single most important line of code in the connector |
| **Dry run, with a diff** | Already supported. Surface it in the admin: show what *would* change before anything does |
| **Sync log** | `catalog_syncs` exists. Extend with direction, duration, and per-row errors readable by a human |
| **Credentials** | Worker secrets (`ERP_API_KEY`, `ERP_API_SECRET`), like `PAYSTACK_SECRET_KEY`. Base URL, price list, warehouse map and cadence in settings, so the house configures everything except the secret without a deploy |

### 7.4 The seven questions, answered ✅ (and the eighth, which nobody asked)

**0. Which ERP is it?** ERPRevolution (ERPrev), at erprev.com. Not ERPNext.
This question was never on the list, which is why it took a build to surface.
It is now a dropdown, so the cost of getting it wrong again is a click.

Seven things were needed before this could start. The connector shipped by
turning five of them into screens rather than emails — a question somebody has
to answer once is better asked by the software that needs the answer.

| | | Where it stands |
|---|---|---|
| 1 | Version and hosting | **Doesn't matter.** The reader takes a base URL and a set of endpoint paths; where the ERP is hosted and which release it is on change neither. |
| 2 | **Is it reachable from the internet?** | **Answered by a button.** Admin → Integrations → Inventory & catalogue link → *Test the connection* says yes or no in five seconds, and reports what each endpoint returned. If the answer is no, the push transport at `POST /api/v1/catalog/sync` is still there, and anything in ERPRev that can POST JSON on a schedule can drive it. |
| 3 | An API key and secret | **The client has them.** They go in as Worker secrets — `ERP_API_KEY`, `ERP_API_SECRET` — never the database. Read access to products, prices, stock, locations and categories is all the pull ever needs; it does not write. If ERPRev issues a single token rather than a pair, either box takes it. |
| 4 | Which price list is the web price | **A field**, and only relevant if ERPRev keeps more than one. Where the price rides the product row — the usual shape — the price endpoint is left empty and the reader takes it from there. |
| 5 | Which locations map to which shops | **A screen.** Locations are listed *from* the ERP — or collected from the names seen on stock rows, for an ERP with no location endpoint — and assigned to shops from a dropdown, because the name has to match character for character. An unmapped location is ignored rather than defaulted; that default is how one city's stock lands on another's shelf. |
| 6 | **Do orders go back?** As a Sales Order or a Sales Invoice? | **Still open, and the only thing still blocked.** It is a question about their accounting process, not about software. |
| 7 | Who owns product copy and photographs | **Decided, and enforced in code.** The website. The pull writes name, description, image and category only for an item the shop has never seen; after that it writes price and stock and nothing else. Otherwise the first sync flattens the merchandising and the second does it again an hour later. |

### 7.4b What ERPRev's API actually turned out to be

The client sent three printed reference pages on 22 Sep. They were images of
vector-outlined text — no extractable characters at all — so they were
rasterised and read. What they say, and how much of it nobody would have
guessed:

| | |
|---|---|
| Base | `https://<tenant>/api/v2` — multi-tenant on a subdomain |
| Auth | **Signed requests.** HMAC-SHA256 over method, path, timestamp, nonce and body. **The secret never travels.** `X-Api-Key` carries the key id |
| Clock | Signing timestamp within **±300s** of the server's, or `auth.clock_skew` |
| Paging | **Cursor**, not page numbers — `limit` (1–200, default 50) and `cursor` |
| Envelope | `{ "data": [...], "page": { limit, count, has_more, next_cursor } }` |
| Gates | A **scope** *and* the attached user's **module privilege**. Both, every time |
| Endpoints | `/products` · `/stocks` · `/warehouses` · `/product-categories` |
| Free | `/api/v2/ping` needs no key; the OpenAPI 3 document at `/api/v2/docs` is public |
| Products | Flat. No parent/variant concept: `name`, `price`, `cost_price`, `measure`, `category_name`, `barcode`, `reorder_level`, `thumb_image_url` |
| Stock | Its own resource, joining `product_id` to `warehouse_id` |

**Not one of the six authentication styles the connector had could do this.**
A signed API is a different thing from a keyed one, and the earlier guess —
`Authorization: <token>`, inferred from a search snippet — was wrong too.
Neither could the paging: cursor APIs have no page number, and asking one for
"page 3" returns page 1 three times.

Three things in that list would each have been a silent wrong answer rather
than an error:

1. **A stock row's `id` is the stock record's, not the product's.** Reading it
   as the product would have attached every quantity to the wrong product,
   with nothing anywhere reporting a problem.
2. **`/warehouses` gives `{id, name}` and stock rows carry `warehouse_id`.** A
   location map keyed on the readable name would have matched nothing, and
   every shop would have come back empty.
3. **ERPRev has no variants.** Three sizes of a fragrance are three products,
   so a perfume catalogue imports as three cards per scent unless something
   groups them.

### 7.5 What shipped

Two modules on top of the ingest that has existed since Sprint 2.

**`worker/erp-adapters.js` — everything vendor-shaped.** Six authentication
styles including **HMAC-SHA256 request signing** (the canonical string and the
four header names are editable fields, not constants — see §7.6), five paging
styles including **cursor**, envelope detection, and an alias-driven reader
that tries every common spelling of each field. Three adapters: **ERPrev** (the
default, set up from their reference), ERPNext, and a blank one.

**`worker/erp.js` — the engine, which knows about none of that.**

- Reads products, prices and stock, with prices and stock optional because
  plenty of ERPs carry both on the product row.
- Maps locations to shops, summing several into one, and counts on-hand less
  reserved — a bottle promised to an open order is not one we can sell.
- **The empty-feed guard**, measured against *what this connector manages*
  rather than the whole shop. That denominator is not a detail: with the whole
  shop as the divisor, an ERP managing 37 units beside a 5,600-unit catalogue
  zeroed every one of them and the guard called it a 1% change and let it
  through. Caught in a live run against a fake ERP, before it could ever
  happen for real.
- A **dry run** that does every read and every check and writes nothing, and a
  **probe** that prints the ERP's own keys next to what the reader matched —
  which is how a schema gets mapped without its documentation.
- An eight-step checklist in Admin → Integrations, in the order the steps have
  to happen, with the connection test, the probe and the sync log on it.
- 140 assertions in `scripts/erp.test.mjs`: the engine on neutral rows, each
  adapter on its own vendor's shapes, the signing (against an RFC 4231 HMAC
  vector), the joins that would fail silently, the grouping guards, and every
  branch of the stock guard.

### 7.6 The signature, settled by asking

ERPRev's *Signing requests* page was not among the pages sent, so the exact
bytes are undocumented here. Rather than wait for it, **the connector asks the
ERP**: `erpNegotiateSigning` signs one harmless read under each plausible
shape and keeps whichever one comes back 200.

What makes it cheap rather than brute force is that ERPRev distinguishes its
own failures. `auth.missing` means it never found the headers; anything else
means it found them and disliked the signature. So it is two phases — three
requests to name the header set, then shapes × path readings × formats under
that set alone — and it lands in under ten.

Three axes **crossed**, not a hand-written list of combinations. The first
version of this was a list, and it missed: it held X-ERPRev headers with a
full path, and X-ERPRev headers with a `t=,v1=` signature, and the answer in
testing was X-ERPRev with *both*. Crossing axes cannot miss a corner, and a
test asserts that the corner the list missed is now covered.

Caught while testing it: `pathMode` was part of the signing contract but was
applied by the *caller* rather than by the signer, so a config that set it and
a caller that ignored it were indistinguishable from a working setup until the
401. The signer takes the URL now and applies its own contract.

**Verified end to end** against a fake ERPRev built strictly from the vendor's
reference — signed requests with replay and clock-skew refusal, cursor
pagination, their envelope, their field names, their error codes. With nothing
configured but the base URL: the signature was accepted first time, the cursor
walked every page, `measure` became the size, `category_name` mapped, stock
joined `product_id`→`warehouse_id`→shop, reserved units were deducted, an
unmapped location's 999 units were not counted, an inactive product was left
out, new products landed as drafts, a re-run updated in place, and with
grouping on the three flat rows became two listings — one fragrance with two
sizes, and a candle.

**Also verified** against a purpose-built fake ERP whose schema the connector
had never been told — Bearer auth, a `{status,data:[…]}` envelope,
`?page=&per_page=` paging and field names like `product_code`, `variant_name`,
`selling_price: "₦35,000.00"`, `branch_name`, `available_qty`, `committed`,
`status: "Active"`. With nothing configured but the endpoint paths: prices
parsed out of formatted naira, a parent and two variations built into one
listing, a simple item made a one-size listing, an inactive item left out,
reserved units deducted, stock in an unmapped location not counted anywhere,
an unmapped category filed under the default *and reported*, new products
landed as drafts, a re-run updating in place rather than duplicating, and the
guard refusing a feed that claimed everything was gone.

---

## 8. Sequence

Two tracks. The ERP track is independent of everything else and can run in
parallel the moment §7.4 is answered — it touches `worker/integrations.js` and
nothing the other track touches.

### Track A — storefront & insights

| Stage | Contents | Why here |
|---|---|---|
| **3.1 — Quick wins** ✅ | Low-stock control, override and alerts (§3) · content pages + privacy editor (§5.1) · About→Blog (§6) · Home Fragrance band gains its picture and products (§4.4, as a direct fix) | Every one of these is small, visible, and unblocks the client's team from waiting on us for copy changes |
| **3.2 — The home page becomes data** ✅ | `home_blocks` + admin screen (§4) · curated Best sellers and Ready at your store (§4.2) · editable tiles and bands, seeded to today's exact layout | The merchandising ask, done once instead of six times. **Shipped** — and the padding rule earned its keep: a shelf that makes a claim about its products (deals, gift sets, ready-at-your-store) is never topped up |
| **3.3 — F4, the stream** ✅ | sessions, events, `/api/track`, stitching, bot filter, rollups, retention, the opt-out and the privacy copy that describes it (§1) | Nothing visible ships this stage. Everything after it depends on it |
| **3.4 — Insights** ✅ | Admin → Insights: funnel, conversion, segments, product intelligence, sources, zero-result searches, sold-out demand (§2.1) | The first stage where the client *sees* their data |
| **3.5 — Smart shopping** ✅ | Recovery links, abandonment nudge, pick-up-where-you-left-off, low-stock urgency, free-delivery bar, also-viewed, demand board, targeted pop-up, search actions, cross-sell (§2) | The conversion features, in lift order |

### Track B — ERPNext

| Stage | Contents |
|---|---|
| **3.6a** | Answers to §7.4 · connector settings, credentials, warehouse map, ownership matrix |
| **3.6b** | Pull sync: Items + Item Price + Bin → catalogue and stock, incremental, dry-run diff, empty-feed guard |
| **3.6c** | Webhook receiver for near-real-time stock; scheduled reconcile |
| **3.6d** | Order write-back with a retrying outbox |

### Tests

Each stage lands with a suite, gating the deploy alongside the five that already
run (`npm test`): `insights.test.mjs` (funnel and segment arithmetic, bot
filtering, rollup correctness, retention), `homeblocks.test.mjs` (block ordering,
manual-vs-auto sourcing, the availability filter on a curated shelf),
`erp.test.mjs` (ERPNext payload mapping, warehouse mapping, idempotency on
re-sync, and the empty-feed guard refusing to empty the shop).

---

## 8b. Track A — what shipped, and what did not

Everything in §8's Track A is done. Two items from §2's list of ten did not
land as their own feature, and are worth naming rather than leaving to be
discovered:

| Planned | What happened |
|---|---|
| §2.9 Zero-result search → action | The *list* shipped — every term a shopper searched for and found nothing, on the Insights screen, ranked. The one-click "create this product" / "point it at that one" beside each row did not. The list is what makes the decision; the shortcut is convenience, and it wants the redirect table it does not have yet |
| §2.10 Post-add cross-sell | The co-view graph it would read from is live and already drives "often opened together" on the product page. Putting a second suggestion inside the cart drawer at the moment of adding is a deliberate hold: the drawer is the one surface in the shop where an interruption costs a sale outright, and it is worth watching the product-page rail earn its place first |

Neither is blocked. Both are a small amount of work on foundations that now
exist, which is the point.

---

## 9. Decisions open

| # | Decision | Recommendation |
|---|---|---|
| 1 | ~~About Us — nav swap only, story→post, or delete (§6)~~ | **Settled 13 Sep: nav swap only.** Shipped |
| 2 | ERPNext reachability, credentials, warehouses, price list, write-back (§7.4) | Client is obtaining access. Track B starts when it lands; Track A proceeds meanwhile |
| 3 | Behavioural analytics retention window | 90 days raw, rollups kept. It is a setting, so this is only a default |
| 4 | The abandonment nudge's offer and copy | Ships switched off with no copy. The house writes it, then turns it on |
| 5 | Is "ERPrev" ERPNext? | Confirm before 3.6b. The adapter is generic, but the transport is written against one API |
