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
| **F2** | **Event + automation backbone** — record "what happened", trigger actions | Every automated workflow is the same engine: *event → rule → action*. Pixels and analytics also tap this stream | Abandoned-cart recovery, post-purchase follow-ups, birthday/repeat campaigns, back-in-stock alerts, analytics events |
| **F3** | **Integration layer (incl. the MCP)** — one normalized way to push/pull with the outside world | Shipping, email, WhatsApp, POS, accounting, WMS, and AI agents are all "external systems we exchange data with." Build the plane once | GIG shipping, email marketing, WhatsApp Business, POS/accounting/WMS connectors, mobile app API, MCP server |

Everything else is a **feature that plugs into F1–F3**. So the sequencing rule is:
_foundations → features that ride them → polish._

---

## 2. Capability map (by pillar)

### A. Commerce Core — *mostly done; deepen where noted*
| Capability | Status | Current capacity | Gap to close |
|---|---|---|---|
| Product catalogue & variants | ✅ | Products, sizes, notes, draft/live | Product *types* (sets/samples), media gallery, richer attributes |
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
| Customer accounts | ⬜ | Email/OTP or password + social; the keystone for pillar C/D/E |
| Saved addresses & order history | ⬜ | Rides accounts |
| Wishlists | ⬜ | Device-local first, then account-synced |
| Customer 2FA | ⬜ | TOTP/email once accounts exist |

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
| Abandoned-cart recovery | 🟡 | Capture ✅ (shown in admin) | The **automated recovery** itself (F2 → email/WhatsApp) |
| Lifecycle automations | ⬜ | — | Post-purchase, birthday, repeat, back-in-stock (F2) |
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
| Internal API surface | 🟡 | Clean Hono API exists; make it a documented, key-scoped **integration API** with outbound webhooks |
| Shipping / GIG connector | 🔑⬜ | Rates, label, tracking sync |
| Email marketing connector | 🔑⬜ | Contact sync + transactional/marketing sends |
| WhatsApp Business connector | 🔑⬜ | Templated + session messages |
| MCP server for the store | ⬜ | Exposes catalogue / orders / customers / inventory as **tools** to AI agents & external automation — this is the "MCP tool for connections" the client asked for |
| POS / accounting / WMS / mobile | ⬜ | Future connectors on the same API/MCP plane |

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
Unified CRM view · Reviews with moderation · first automations (abandoned-cart
recovery, post-purchase, back-in-stock) · Email + WhatsApp connectors · GIG shipping.

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

## 5. Change log
- _v1_ — Initial systems map and phase plan.
- _v2_ — Locked decisions D1 (Resend), D2 (click-to-chat now), D3 (Paystack + Stripe), D7 (progressive/optional accounts). Started **Phase 0**.
- _v3_ — Shipped **Phase 0a (instrument)** + **0b (discover)**: consent-gated analytics/pixels with admin-managed IDs, ecommerce event tracking, path-based routing, per-page SEO + JSON-LD, sitemap & robots. Remaining: **0c (harden)**.
- _v4_ — Shipped most of **0c (harden)**: per-user admin accounts with issued passphrases + forced change, TOTP 2FA, master passphrase break-glass, manager store-scoping; security headers; daily D1 backup export; privacy page; non-blocking consent banner that invites shopping. WAF left as a dashboard action (§6). **Next: Phase 1 — customer accounts (progressive/optional), event backbone, integration layer.**
