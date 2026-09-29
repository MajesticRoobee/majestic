// Storefront pages — ported from "Majestic Roobee Storefront.dc.html".
import React, { useEffect, useState } from "react";
import { Eyebrow, GildedRule, Badge, Button, Input, Textarea, ImageSlot, DealCard } from "../ds/components.jsx";
import { ProductCard } from "./product-card.jsx";
import { routeToPath } from "./router.js";
import { EmbedCard, TestimonialCarousel, PostBody, PostCard } from "./pages-content.jsx";
import { DailyDealCard } from "./daily-deal.jsx";
import { countIn } from "../lib/categories.js";
import { aboutContent } from "../lib/about.js";
import { variantGallery } from "../lib/gallery.js";
import { fill, cardsFor, shelfCards, blockNav, blockCategories, HERO_PANEL, HERO_TEXT_SHADOW } from "./blocks.js";
import { useShopList, SHOP_TITLE, PRICE_BANDS } from "./shop-list.js";

export { ProductCard };
export { WishlistPage, LocationsPage, ReviewsPage, BlogPage, BlogPostPage, PostBody, FaqPage, ConsultationPage } from "./pages-content.jsx";
export { EmbedCard, TestimonialCarousel };

const PAD = "clamp(16px, 4vw, 40px)";

// The wash over a promo tile. The tiles themselves are rows now
// (Admin → Home page), so this is the one thing left here: the house of
// purples they are drawn in, applied in order however many there are.
const TILE_VEILS = [
  "linear-gradient(0deg, rgba(37,20,50,0.9), rgba(37,20,50,0.12))",
  "linear-gradient(0deg, rgba(61,35,80,0.9), rgba(61,35,80,0.12))",
  "linear-gradient(0deg, rgba(90,45,110,0.9), rgba(90,45,110,0.12))",
];



// One section heading: the small line above, the heading, the line under it,
// and — on a row of products — the link to the rest.
function SectionHead({ eyebrow, title, sub, centred = false, action = null, subStrong = false }) {
  const head = (
    <div style={{ maxWidth: "62ch", ...(centred ? { margin: "0 auto" } : null) }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 3vw, 36px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: eyebrow ? "10px 0 0" : 0 }}>{title}</h2>
      {sub && (subStrong
        // A running deal's own line, under its name on the home page. It is
        // the sales message, so it is set to be read, not to recede.
        ? <p style={{ display: "inline-block", fontSize: 16, fontWeight: 700, color: "var(--mr-cream)", background: "var(--mr-purple-900)", borderLeft: "4px solid var(--accent-gold)", borderRadius: "var(--radius-sm)", lineHeight: 1.5, margin: "12px 0 0", padding: "8px 14px" }}>{sub}</p>
        : <p style={{ fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.7, margin: "8px 0 0" }}>{sub}</p>)}
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22, textAlign: centred ? "center" : "left" }}>
      {head}
      {action}
    </div>
  );
}

// A heading, a line or two, and one button — the shape every "go and look at
// this part of the shop" block on the homepage takes.
function CtaBand({ title, lines, cta, onClick, dark = false }) {
  return (
    <section style={{ maxWidth: 1280, margin: "clamp(40px, 7vw, 72px) auto 0", padding: `0 ${PAD}` }}>
      <div style={{ background: dark ? "var(--royal-wash)" : "var(--surface-card)", border: dark ? "none" : "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "clamp(26px, 4vw, 44px)", display: "flex", flexWrap: "wrap", gap: 22, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ maxWidth: "54ch" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.6vw, 30px)", color: dark ? "var(--mr-cream)" : "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: 0 }}>{title}</h2>
          {lines.map((l) => (
            <p key={l} style={{ fontSize: 14.5, lineHeight: 1.7, color: dark ? "var(--text-on-dark-muted)" : "var(--text-muted)", margin: "10px 0 0" }}>{l}</p>
          ))}
        </div>
        <Button variant={dark ? "gold" : "primary"} size="lg" onClick={onClick}>{cta}</Button>
      </div>
    </section>
  );
}

// How the rewards work, in the four steps the client wrote.
export const REWARD_STEPS = [
  { step: "Shop", copy: "Purchase your favourite Majestic Roobee products." },
  { step: "Earn", copy: "Collect points with every qualifying purchase." },
  { step: "Redeem", copy: "Turn your points into rewards." },
  { step: "Enjoy", copy: "Come back for more of the scents you love." },
];

// The newsletter block. It feeds the same list as the first-order pop-up, so
// an address left here reaches the store the same way.
function NewsletterSignup({ ctx, title, sub }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const join = () => { if (ctx.joinList(email, "newsletter")) setDone(true); };
  return (
    <section style={{ maxWidth: 1280, margin: "clamp(40px, 7vw, 72px) auto 0", padding: `0 ${PAD}` }}>
      <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-lg)", padding: "clamp(28px, 4vw, 48px)", textAlign: "center" }}>
        {title && <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.6vw, 30px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: 0 }}>{title}</h2>}
        {/* With no heading the copy leads, set large enough to read as one. */}
        {sub && <p style={title
          ? { fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.7, margin: "10px auto 20px", maxWidth: "54ch" }
          : { fontFamily: "var(--font-serif)", fontSize: "clamp(18px, 2vw, 22px)", color: "var(--text-strong)", lineHeight: 1.5, margin: "0 auto 22px", maxWidth: "46ch" }}>{sub}</p>}
        {done ? (
          <p style={{ fontSize: 14, color: "var(--mr-purple-900)", fontWeight: 500, margin: 0 }}>You&apos;re on the list.</p>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 460, margin: "0 auto" }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join()}
              type="email" autoComplete="email" aria-label="Your email address" placeholder="Enter your email address"
              style={{ flex: "1 1 220px", minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 14, padding: "12px 14px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", color: "var(--text-strong)", background: "var(--surface-card)" }} />
            <Button variant="primary" onClick={join}>Join the list</Button>
          </div>
        )}
      </div>
    </section>
  );
}

// A category sold by showing it: the copy on one side, real products from that
// category on the other, each a link straight to the thing itself.
//
// Which products is the server's answer now (worker/home.js) — hand-picked
// where the house has picked them, and the category's own otherwise. This
// component only draws what it is handed, so the same shape serves feminine
// care, home fragrance and any band the house adds later.
function ProductBand({ eyebrow, title, lines, cta, picks, onOpen }) {
  return (
    <section style={{ maxWidth: 1280, margin: "clamp(40px, 7vw, 72px) auto 0", padding: `0 ${PAD}` }}>
      <div style={{ background: "var(--royal-wash)", borderRadius: "var(--radius-lg)", overflow: "hidden", display: "grid", gridTemplateColumns: picks.length ? "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" : "1fr", gap: "clamp(20px, 3vw, 40px)", alignItems: "center", padding: "clamp(26px, 4vw, 44px)" }}>
        <div style={{ maxWidth: "44ch" }}>
          {eyebrow && <Eyebrow tone="light">{eyebrow}</Eyebrow>}
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 3vw, 34px)", color: "var(--mr-cream)", letterSpacing: "var(--ls-heading)", margin: eyebrow ? "12px 0 0" : 0 }}>{title}</h2>
          {lines.map((l) => (
            <p key={l} style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--text-on-dark-muted)", margin: "10px 0 0" }}>{l}</p>
          ))}
          {cta && (
            <div style={{ marginTop: 22 }}>
              <Button variant="gold" size="lg" onClick={onOpen}>{cta}</Button>
            </div>
          )}
        </div>
        {picks.length > 0 && (
          // One product is a spotlight: a single card at a card's width, not a
          // bottle blown up to fill half the band.
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(picks.length, 3)}, minmax(0, 1fr))`, gap: "clamp(10px, 1.4vw, 16px)", ...(picks.length === 1 ? { width: "100%", maxWidth: 230, justifySelf: "center" } : null) }}>
            {picks.map((p) => (
              <a key={p.key} href={p.href} onClick={(e) => { e.preventDefault(); p.open(); }} className="mr-lift"
                style={{ background: "var(--surface-card)", borderRadius: "var(--radius-md)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-sm)" }}>
                <ImageSlot src={p.imageUrl} name={p.name} sizes="(max-width: 860px) 30vw, 200px" style={{ width: "100%", aspectRatio: "4 / 5" }} />
                <span style={{ padding: "10px 12px 12px", display: "block" }}>
                  <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 14.5, color: "var(--text-strong)", lineHeight: 1.25 }}>{p.name}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{p.priceLabel}</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---- The home page ---------------------------------------------------------
//
// Every band, shelf, heading and tile below is a row in `home_blocks`, arranged
// in Admin → Home page. The server resolves each block to the products it shows
// (worker/home.js) and sends them in order; this file only knows how to *draw*
// a block of each kind. Which means reordering the page, rewriting a heading,
// swapping a photograph, curating a shelf by hand or adding a new band is a
// save rather than a deploy.
//
// Nothing here reads a block that isn't live: the server has already dropped
// those.

function BlockLink({ ctx, block }) {
  const go = blockNav(ctx, block.ctaTarget);
  if (!block.ctaLabel || !go) return null;
  return <a href={block.ctaTarget} onClick={go} style={{ fontSize: 13.5, fontWeight: 500 }}>{block.ctaLabel}</a>;
}

export function HomePage({ ctx }) {
  const { settings, products, categories, cityName, testimonials, latestPosts, homeBlocks } = ctx;
  const dir = settings.heroDirection || "storefront grid";
  const sellable = products.filter((p) => p.variants && p.variants.length);
  // Three picks from whatever is live, city stock first — never named ids, which
  // would break the moment the catalogue changes.
  const heroPicks = sellable
    .slice().sort((a, b) => (ctx.availInfo(b).inCity ? 1 : 0) - (ctx.availInfo(a).inCity ? 1 : 0))
    .slice(0, 3).map(ctx.card).filter(Boolean);
  const tiles = homeBlocks.filter((b) => b.kind === "tile");
  const flow = homeBlocks.filter((b) => b.kind !== "tile");
  const vars = { city: cityName };
  const runningDeal = ctx.deals.length === 1 ? ctx.deals[0] : null;
  // The right-hand column is the daily deal's. With no deal running the banner
  // takes the width rather than leaving a blank column beside it.
  const dealOn = !!(ctx.dailyDeal && ctx.dailyDeal.endsAtMs > Date.now());

  const perk = (icon, title, sub) => (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "18px 20px", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)" }}>
      {icon}
      <div>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-strong)" }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{sub}</div>
      </div>
    </div>
  );
  const iconStyle = { flexShrink: 0, marginTop: 2 };

  return (
    <main>
      {dir === "storefront grid" && (
        <>
          {/* Three columns, and the first is deliberately empty: it is the
              width of the header's category rail, which stands open over it on
              this page. The banner takes the middle, the daily deal the right.
              A phone gets one column and the deal card below the tiles. */}
          <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(18px, 2.6vw, 30px) ${PAD} 0`, display: "grid", gridTemplateColumns: ctx.isMobile ? "minmax(0, 1fr)" : dealOn ? "250px minmax(0, 1fr) 300px" : "250px minmax(0, 1fr)", gap: "clamp(16px, 1.8vw, 24px)", alignItems: "start" }}>
            {!ctx.isMobile && <div />}
            <div style={{ minWidth: 0 }}>
              <div style={{ position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                {/* The photograph shows whole. The words sit on a see-through
                    panel — tinted enough to read cleanly over any photograph,
                    never blurred, and never washing the whole picture out.
                    Until a photograph is set the banner is the royal wash. */}
                {settings.heroImage
                  ? <ImageSlot src={settings.heroImage} eager name="Majestic Roobee" sizes="(max-width: 860px) 92vw, 720px"
                    style={{ width: "100%", height: "clamp(320px, 34vw, 420px)" }} />
                  : <div style={{ width: "100%", height: "clamp(320px, 34vw, 420px)", background: "var(--royal-wash)" }} />}
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: "clamp(20px, 3vw, 36px)", pointerEvents: "none" }}>
                  <div style={{ maxWidth: 500, display: "flex", flexDirection: "column", gap: 16, padding: settings.heroImage ? "clamp(22px, 2.6vw, 32px)" : "clamp(4px, 1.2vw, 12px)", borderRadius: "var(--radius-lg)", ...(settings.heroImage ? HERO_PANEL : null) }}>
                    {settings.heroEyebrow && <span style={{ fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold)" }}>{settings.heroEyebrow}</span>}
                    <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 3.4vw, 46px)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)", color: "var(--mr-cream)", margin: 0, maxWidth: "20ch", whiteSpace: "pre-line", textShadow: HERO_TEXT_SHADOW }}>{settings.heroHeadline}</h1>
                    {settings.heroSub && <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(16px, 1.5vw, 19px)", lineHeight: 1.5, color: "var(--mr-cream)", maxWidth: "36ch", margin: 0, textShadow: HERO_TEXT_SHADOW }}>{settings.heroSub}</p>}
                    <div style={{ display: "flex", pointerEvents: "auto", marginTop: 4 }}>
                      <Button variant="gold" size="lg" onClick={() => ctx.nav("shop")}>Shop fragrances</Button>
                    </div>
                  </div>
                </div>
              </div>
              {/* The tiles under the hero. Three of them were written into this
                  file with one settings key each for the photograph; they are
                  rows now, so the house can rename one, reorder them, point one
                  somewhere else, switch one off or add a fourth. */}
              {tiles.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "clamp(12px, 1.4vw, 18px)", marginTop: "clamp(12px, 1.4vw, 18px)" }}>
                  {tiles.map((t, i) => (
                    <a key={t.id} href={t.ctaTarget || "/shop"} onClick={blockNav(ctx, t.ctaTarget || "/shop")}
                      style={{ position: "relative", display: "block", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                      <ImageSlot src={t.imageUrl} name={t.title} sizes="(max-width: 860px) 92vw, 240px" style={{ width: "100%", height: 150 }} />
                      <span style={{ position: "absolute", inset: 0, background: TILE_VEILS[i % TILE_VEILS.length], display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 4, padding: 16 }}>
                        {t.eyebrow && <span style={{ fontFamily: "var(--font-condensed)", fontSize: 10, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold)" }}>{fill(t.eyebrow, vars)}</span>}
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--mr-cream)", lineHeight: 1.15 }}>{fill(t.title, vars)}</span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
              {/* On a phone the deal follows the tiles at full width rather
                  than disappearing — most of this shop is read on a phone. */}
              {ctx.isMobile && <DailyDealCard ctx={ctx} style={{ marginTop: "clamp(12px, 1.4vw, 18px)" }} />}
            </div>
            {!ctx.isMobile && <DailyDealCard ctx={ctx} />}
          </section>
        </>
      )}
      {dir === "editorial split" && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 88px) ${PAD}`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", gap: "clamp(28px, 5vw, 64px)", alignItems: "center" }}>
          <div>
            {settings.heroEyebrow && <Eyebrow>{settings.heroEyebrow}</Eyebrow>}
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(38px, 5.4vw, 64px)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)", color: "var(--text-strong)", margin: "18px 0 0", whiteSpace: "pre-line" }}>{settings.heroHeadline}</h1>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(19px, 2vw, 23px)", lineHeight: 1.5, color: "var(--text-body)", maxWidth: "46ch", margin: "22px 0 30px" }}>{settings.heroSub}</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="primary" size="lg" onClick={() => ctx.nav("shop")}>Shop fragrances</Button>
            </div>
          </div>
          <div style={{ position: "relative", minHeight: 380 }}>
            <div style={{ position: "absolute", inset: "24px -8px -8px 24px", border: "1px solid var(--mr-gold-400)", borderRadius: "var(--radius-lg)", pointerEvents: "none" }} />
            <ImageSlot src={settings.heroImage} eager shape="rounded" radius={16} name="Majestic Roobee" sizes="(max-width: 860px) 92vw, 600px"
              label="Warm editorial hero — bottle on silk" style={{ width: "100%", height: 460 }} />
          </div>
        </section>
      )}
      {dir === "royal statement" && (
        <section style={{ background: settings.heroImage ? `linear-gradient(rgba(36,20,48,0.72), rgba(36,20,48,0.72)), url("${settings.heroImage}") center/cover` : "var(--royal-wash)", textAlign: "center", padding: `clamp(64px, 10vw, 130px) ${PAD}` }}>
          <Eyebrow tone="light">Majestic Roobee</Eyebrow>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px, 6.4vw, 84px)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)", color: "var(--mr-cream)", margin: "22px auto 0", maxWidth: "18ch", whiteSpace: "pre-line" }}>{settings.heroHeadline}</h1>
          <GildedRule width="220px" style={{ margin: "18px auto" }} />
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(18px, 2vw, 22px)", color: "var(--text-on-dark-muted)", maxWidth: "52ch", margin: "0 auto 34px" }}>{settings.heroSub}</p>
          <Button variant="gold" size="lg" onClick={() => ctx.nav("shop")}>Shop fragrances</Button>
        </section>
      )}
      {dir === "product-led" && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 6vw, 72px) ${PAD}` }}>
          <div style={{ maxWidth: 640 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px, 4.6vw, 56px)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)", color: "var(--text-strong)", margin: "0 0 30px" }}>Featured</h1>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(250px, 100%), 1fr))", gap: 20 }}>
            {heroPicks.map((hp) => (
              <div key={hp.key} onClick={hp.open} style={{ cursor: "pointer", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                <ImageSlot src={hp.imageUrl} name={hp.name} eager sizes="(max-width: 640px) 92vw, 300px" style={{ width: "100%", height: 240 }} />
                <div style={{ padding: "16px 18px 20px" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text-strong)" }}>{hp.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>{hp.priceLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Whatever this shopper was last looking at, before the page's own
          merchandising — the strongest thing the shop can put in front of
          somebody is the thing they had already chosen to look at. */}
      <RecentlyViewed ctx={ctx} />

      {flow.map((b) => (
        <HomeBlock key={b.id} block={b} ctx={ctx} vars={vars} runningDeal={runningDeal}
          perk={perk} iconStyle={iconStyle} categories={categories} products={products}
          testimonials={testimonials} latestPosts={latestPosts} settings={settings} />
      ))}
    </main>
  );
}

// One block, drawn according to its kind. A kind this file does not know how to
// draw renders nothing rather than throwing — a half-deployed admin must never
// be able to white-screen the shop.
function HomeBlock({ block, ctx, vars, runningDeal, perk, iconStyle, categories, products, testimonials, latestPosts, settings }) {
  const eyebrow = fill(block.eyebrow, vars);
  const title = fill(block.title, vars);
  const sub = fill(block.sub, vars);

  switch (block.kind) {
    case "perks":
      return (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `12px ${PAD} 8px` }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(230px, 100%), 1fr))", gap: 14 }}>
            {perk(
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>,
              "Fast delivery", "From your nearest store"
            )}
            {perk(
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
              "Secure payment", "Card or bank transfer"
            )}
            {perk(
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>,
              "Worldwide delivery", "Pay in ₦ or $"
            )}
          </div>
        </section>
      );

    // The tiles are the live category tree, so this can never disagree with the
    // menu in the header.
    case "categories":
      return (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0` }}>
          <SectionHead centred eyebrow={eyebrow} title={title} sub={sub} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 14 }}>
            {blockCategories(block, categories).map((c) => {
              const n = countIn(categories, products, c.id);
              return (
                <button key={c.id} className="mr-lift" onClick={() => ctx.nav("shop", { fCat: c.id, fSeg: null, fBrand: "", fCol: null })} style={{ cursor: "pointer", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "22px 14px", textAlign: "center", fontFamily: "var(--font-sans)" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--mr-purple-900)" }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5 }}>{n} {n === 1 ? "product" : "products"}</div>
                </button>
              );
            })}
          </div>
        </section>
      );

    case "band": {
      const picks = cardsFor(block, ctx);
      const go = blockNav(ctx, block.ctaTarget);
      // A band with no products left in it — the category sold out, or was
      // emptied — falls back to the plain call-to-action rather than rendering
      // a lopsided box with a hole where the bottles should be.
      if (block.layout === "cta-band" || !picks.length) {
        return (
          <CtaBand title={title} lines={block.lines} cta={block.ctaLabel} onClick={go || (() => ctx.nav("shop"))} dark={block.dark} />
        );
      }
      return <ProductBand ctx={ctx} eyebrow={eyebrow} title={title} lines={block.lines} cta={block.ctaLabel} picks={picks} onOpen={go || (() => ctx.nav("shop"))} />;
    }

    case "shelf": {
      const picks = shelfCards(block, ctx);
      if (!picks.length) return null;
      // When exactly one deal is running it names the shelf itself, which is
      // what lets a sale say what it is instead of always reading "Hot deals".
      const isDeals = block.source === "segment" && block.refId === "deals";
      const named = isDeals && runningDeal;
      return (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(36px, 6vw, 64px) ${PAD} 0` }}>
          <SectionHead
            eyebrow={eyebrow}
            title={named ? runningDeal.title : (title || (isDeals ? "Deals" : ""))}
            sub={named && runningDeal.desc ? runningDeal.desc : sub}
            subStrong={!!(named && runningDeal.desc)}
            action={<BlockLink ctx={ctx} block={block} />}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
            {picks.map((p) => <ProductCard key={p.key} p={p} />)}
          </div>
        </section>
      );
    }

    // The founder's story — the same words the About page runs, read from the
    // same settings, so the two never disagree.
    case "story":
      return <StoryBlock ctx={ctx} block={block} eyebrow={eyebrow} title={title} settings={settings} />;

    // Rewards. A qualifying purchase earns a single-use code, issued the moment
    // the order is paid for — see `worker/rewards.js`.
    case "rewards":
      return (
        <section id="rewards" style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0`, scrollMarginTop: 110 }}>
          <SectionHead centred eyebrow={eyebrow} title={title} sub={sub} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 14 }}>
            {REWARD_STEPS.map((r, i) => (
              <div key={r.step} style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "22px 22px 24px" }}>
                <div style={{ fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)" }}>Step {i + 1}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-strong)", margin: "8px 0 6px" }}>{r.step}</div>
                <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65 }}>{r.copy}</div>
              </div>
            ))}
          </div>
          {block.ctaLabel && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
              <Button variant="primary" size="lg" onClick={blockNav(ctx, block.ctaTarget) || (() => ctx.nav("shop"))}>{block.ctaLabel}</Button>
            </div>
          )}
        </section>
      );

    // Reviews & testimonials — the customers' own posts, on a rail that moves
    // on its own. They are added and removed under Reviews in the admin;
    // nothing in this section is written into the page.
    case "reviews":
      if (!testimonials.length) return null;
      return (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0` }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
            <div>
              {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 3vw, 36px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: eyebrow ? "10px 0 0" : 0 }}>
                {title || settings.reviewsHeadline || "Don't just take our word for it"}
              </h2>
            </div>
            <BlockLink ctx={ctx} block={block} />
          </div>
          {/* The rail has its own gutter, so it pulls back level with the grids
              above and below it. */}
          <div style={{ margin: "0 -10px" }}>
            <TestimonialCarousel items={testimonials.slice(0, 9)} />
          </div>
        </section>
      );

    case "blog":
      if (!latestPosts.length) return null;
      return (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0` }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
            <div>
              {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 3vw, 36px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: eyebrow ? "10px 0 0" : 0 }}>
                {title || settings.blogHeadline || "Blog"}
              </h2>
            </div>
            <BlockLink ctx={ctx} block={block} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 20 }}>
            {/* The same card as the blog itself, so a story looks like the
                same story wherever it is met. */}
            {latestPosts.slice(0, block.count || 3).map((p) => (
              <PostCard key={p.slug} p={p} compact onOpen={() => ctx.nav("post", { postSlug: p.slug })} />
            ))}
          </div>
        </section>
      );

    case "newsletter":
      return <NewsletterSignup ctx={ctx} title={title} sub={sub} />;

    case "instagram":
      if (!settings.igUrl) return null;
      return (
        <section style={{ maxWidth: 1280, margin: "clamp(40px, 7vw, 72px) auto 0", padding: `0 ${PAD}` }}>
          <div style={{ textAlign: "center" }}>
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.6vw, 30px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: eyebrow ? "10px 0 0" : 0 }}>{title}</h2>
            <p style={{ fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.7, margin: "10px auto 6px", maxWidth: "54ch" }}>{sub}</p>
            <div style={{ fontFamily: "var(--font-condensed)", fontSize: 12, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)", marginBottom: 18 }}>
              {settings.igHandle || "@majesticroobee"}
            </div>
            <a href={settings.igUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, color: "var(--mr-purple-900)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "12px 24px" }}>
              {block.ctaLabel || "Follow us on Instagram"}
            </a>
          </div>
        </section>
      );

    default:
      return null;
  }
}

// The founder's story on the home page: her portrait, the heading and the
// opening paragraph, with the rest of the story a tap away rather than two
// thousand words standing between the shopper and the reviews.
function StoryBlock({ ctx, block, eyebrow, title, settings }) {
  const [open, setOpen] = useState(false);
  const about = aboutContent(settings);
  const shown = open ? about.story : about.story.slice(0, 1);
  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0` }}>
      <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", display: "grid", gridTemplateColumns: ctx.isMobile ? "minmax(0, 1fr)" : "minmax(0, 320px) minmax(0, 1fr)", gap: "clamp(22px, 3vw, 44px)", alignItems: "start", padding: "clamp(26px, 4vw, 44px)" }}>
        <div style={{ position: "relative", ...(ctx.isMobile ? null : { position: "sticky", top: 120 }) }}>
          {/* A gold frame offset behind the photograph, the same gesture the
              editorial hero uses, so the two read as one house style. */}
          <div style={{ position: "absolute", inset: "18px -10px -10px 18px", border: "1px solid var(--mr-gold-400)", borderRadius: "var(--radius-lg)", pointerEvents: "none" }} />
          <ImageSlot src={about.founderPhoto} shape="rounded" radius={14} name={about.founderName}
            sizes="(max-width: 860px) 92vw, 420px" label={`${about.founderName} — ${about.founderRole}`}
            style={{ width: "100%", aspectRatio: "3 / 4", position: "relative" }} />
        </div>
        <div>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 3vw, 34px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: eyebrow ? "10px 0 16px" : "0 0 16px", maxWidth: "22ch" }}>{title || about.storyTitle}</h2>
          {shown.map((par, i) => (
            <p key={i} style={{ fontFamily: "var(--font-editorial)", fontSize: 16, lineHeight: "var(--lh-relaxed)", color: "var(--text-body)", margin: "0 0 14px", maxWidth: "68ch" }}>{par}</p>
          ))}
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "4px 0 20px" }}>
            <strong style={{ color: "var(--mr-purple-800)", fontWeight: 600 }}>{about.founderName}</strong> — {about.founderRole}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {about.story.length > 1 && (
              <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Show less" : block.ctaLabel || "Read the full story"}</Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// What this shopper was looking at last time, or five minutes ago.
//
// Read from their own browser rather than fetched back from the server: it is
// theirs, it is instant, and — the point — it works for the anonymous visitor
// who is most of the traffic. Nothing here needs an account.
export function RecentlyViewed({ ctx, exclude = null, title = "Recently viewed" }) {
  const ids = (ctx.recentIds || []).filter((id) => id !== exclude);
  const picks = ids
    .map((id) => ctx.listings.find((e) => e.product.id === id))
    .filter(Boolean)
    .map(ctx.card)
    .filter(Boolean)
    .slice(0, 4);
  if (ctx.settings.recentlyViewedOn === false || picks.length < 2) return null;
  return (
    <section style={{ maxWidth: 1280, margin: "clamp(36px, 6vw, 64px) auto 0", padding: `0 ${PAD}` }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.6vw, 30px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: 0 }}>{title}</h2>
        <button onClick={ctx.clearRecent} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--text-muted)" }}>Clear</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
        {picks.map((p) => <ProductCard key={p.key} p={p} />)}
      </div>
    </section>
  );
}

export function ShopPage({ ctx }) {
  const {
    listings, collections, cityName, searching, collection, seg, segCopy, brand, brandName, activeCat, trail, runningDeals, subLine, scopedOut, list, filtersDirty,
  } = useShopList(ctx);
  const selStyle = { fontFamily: "var(--font-sans)", fontSize: 13, padding: "9px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", background: "var(--surface-card)", color: "var(--text-strong)", outline: "none", cursor: "pointer" };
  const chip = (on, onClick, label, key) => (
    <button key={key} onClick={onClick} style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "8px 16px", borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : "var(--mr-purple-800)", transition: "all var(--dur-fast) var(--ease-standard)" }}>
      {label}
    </button>
  );
  // The filter row: the top of the category the shopper is in, the fragrance
  // families the catalogue actually uses, and the shared price bands.
  const mf = ctx.mf || {};
  const setMf = (patch) => ctx.setMf((m) => ({ ...m, ...patch }));
  const topCat = trail.length ? trail[0] : null;
  const families = [...new Set(listings.map((e) => e.product.family).filter(Boolean))].sort();
  // Curated sets lead the page — but only when the shopper is browsing, not
  // when they have already narrowed to a category, a set or a search.
  const showStrips = !searching && !collection && !seg && !brand && ctx.fCat === "all" && collections.length > 0;
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(28px, 4vw, 48px) ${PAD}` }}>
      {showStrips && collections.map((col) => {
        // A collection names products; the strip shows the same cards the grid
        // would, so a split-listed product contributes one card per variation
        // here too rather than reading differently in two places.
        const picks = col.productIds.flatMap((id) => listings.filter((e) => e.product.id === id));
        if (!picks.length) return null;
        return (
          <section key={col.id} style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 2.6vw, 32px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "0 0 4px" }}>{col.title}</h2>
                {col.desc && <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0, maxWidth: "60ch" }}>{col.desc}</p>}
              </div>
              {picks.length > 4 && (
                <button onClick={() => ctx.nav("shop", { fCol: col.id })} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, color: "var(--mr-orchid-600)" }}>
                  See all {picks.length}
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
              {picks.slice(0, 4).map((e) => <ProductCard key={e.key} p={ctx.card(e)} />)}
            </div>
          </section>
        );
      })}

      {/* Where the shopper is, and the way back up. Categories are picked in
          exactly one place — the header's menu — so this is a breadcrumb, not a
          second copy of the menu. */}
      {trail.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          <a href="/" onClick={(e) => { e.preventDefault(); ctx.nav("home"); }} style={{ color: "var(--text-muted)" }}>Home</a>
          {trail.map((c, i) => (
            <React.Fragment key={c.id}>
              <span>&#8250;</span>
              {i === trail.length - 1
                ? <span style={{ color: "var(--mr-purple-800)" }}>{c.label}</span>
                : <a href={routeToPath("shop", { fCat: c.id })} onClick={(e) => { e.preventDefault(); ctx.nav("shop", { fCat: c.id }); }} style={{ color: "var(--text-muted)" }}>{c.label}</a>}
            </React.Fragment>
          ))}
        </div>
      )}
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: `0 0 ${subLine ? 6 : 24}px` }}>
        {segCopy
          ? (activeCat ? `${segCopy.title} — ${activeCat.label}` : segCopy.title)
          : brand ? brandName
            : collection ? collection.title
              : activeCat ? activeCat.label : SHOP_TITLE}
      </h1>
      {subLine && (
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px", maxWidth: "62ch", lineHeight: 1.7 }}>{subLine}</p>
      )}

      {runningDeals.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 14, marginBottom: 26 }}>
          {runningDeals.map((d) => (
            <DealCard key={d.id} deal={d}
              meta={`${d.productIds.length} ${d.productIds.length === 1 ? "product" : "products"}${d.endsAt ? ` · ends ${d.endsAt}` : ""}`} />
          ))}
        </div>
      )}

      {(collection || brand) && (
        <button onClick={() => ctx.nav("shop", { fCat: "all" })} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-orchid-600)", fontWeight: 500, padding: 0, marginBottom: 18 }}>← All products</button>
      )}
      {/* This store, or every store. Hidden mid-search, which always reaches
          every store. */}
      {!searching && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          {chip(ctx.fScope === "city", () => ctx.setFScope("city"), `In stock in ${cityName}`, "sc-city")}
          {chip(ctx.fScope === "all", () => ctx.setFScope("all"), scopedOut > 0 ? `All stores (+${scopedOut})` : "All stores", "sc-all")}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 28 }}>
        {!collection && !brand && (
          <select aria-label="Category" value={topCat ? topCat.id : "all"} onChange={(e) => ctx.nav("shop", { fCat: e.target.value, fCol: null, fSeg: seg, fBrand: "" }, { replace: true })} style={selStyle}>
            <option value="all">Category: All</option>
            {ctx.categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        )}
        {families.length > 1 && (
          <select aria-label="Fragrance family" value={mf.fam || "all"} onChange={(e) => setMf({ fam: e.target.value })} style={selStyle}>
            <option value="all">Fragrance family: All</option>
            {families.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        <select aria-label="Price" value={mf.price || "all"} onChange={(e) => setMf({ price: e.target.value })} style={selStyle}>
          <option value="all">Price: Any</option>
          <option value="under">Under {ctx.fmt(PRICE_BANDS[0])}</option>
          <option value="mid">{ctx.fmt(PRICE_BANDS[0])}–{ctx.fmt(PRICE_BANDS[1])}</option>
          <option value="over">Over {ctx.fmt(PRICE_BANDS[1])}</option>
        </select>
        <select aria-label="Sort" value={ctx.fSort} onChange={(e) => ctx.setFSort(e.target.value)} style={selStyle}>
          <option value="featured">Featured</option>
          <option value="best">Best sellers</option>
          <option value="new">Newest</option>
          <option value="low">Price · low to high</option>
          <option value="high">Price · high to low</option>
          <option value="name">Name A–Z</option>
        </select>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{list.length} {list.length === 1 ? "product" : "products"}</span>
        {filtersDirty && (
          <button onClick={() => { ctx.setFScope("city"); ctx.setSearch(""); setMf({ price: "all", fam: "all", gender: "all" }); ctx.nav("shop", { fCat: "all" }); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-orchid-600)", fontWeight: 500 }}>Clear filters</button>
        )}
      </div>
      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 20px", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)" }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 19, color: "var(--text-body)", margin: "0 0 14px" }}>
            {searching
              ? `No results for "${ctx.search}".`
              : `Nothing in stock in ${cityName}.`}
          </p>
          {!searching && ctx.fScope === "city" && scopedOut > 0 && (
            <Button variant="secondary" onClick={() => ctx.setFScope("all")}>Show all stores</Button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
          {list.map((e) => <ProductCard key={e.key} p={ctx.card(e)} />)}
        </div>
      )}
    </main>
  );
}

export function ProductPage({ ctx }) {
  const pr = ctx.products.find((p) => p.id === ctx.productId);
  const [shot, setShot] = useState(0);
  // A product with nothing to sell has no page worth showing. Reading the
  // catalogue defensively matters here: this page is the one that renders a
  // *variation*, so a payload written by an older Worker (mid-deploy, or a
  // stale edge) must degrade to the shop rather than white-screen the SPA.
  const variants = (pr && pr.variants) || [];

  // The selected variation: whatever the shopper picked, else the SKU the URL
  // asked for, else the first one in stock in their city. Resolved *before* the
  // bail-out below so the thumbnail reset beneath it is an unconditional hook.
  const prV = variants.find((v) => v.id === ctx.prVariantId)
    || (ctx.prSku && variants.find((v) => v.sku === ctx.prSku))
    || ctx.defaultVariant(variants);
  const prVId = prV ? prV.id : null;
  // Changing size changes the gallery, so the thumbnail that was open goes back
  // to the first. `selectVariant` does this for a click; this catches the ways
  // the variation changes without one — the back button, a shared ?variant=
  // link, or a card that opened this page on a different size.
  useEffect(() => { setShot(0); }, [prVId]);

  if (!pr || !variants.length) return <ShopPage ctx={ctx} />;

  const prA = ctx.variantAvail(prV);
  const { cityName, L } = ctx;
  const soldOut = prA.soldOut;
  // How many are left here, when that number is small enough to be worth
  // saying. Null the rest of the time — a shop that cries "only 9 left" on
  // every page is a shop nobody believes on the one that matters.
  const scarce = ctx.scarcity(prV);
  const optionName = (pr.optionNames && pr.optionNames[0]) || "Size";
  // The brand grid keys on a slug of the name, so the link from here has to
  // slug it the same way the server does.
  const brandSlug = (pr.brand || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // The gallery for this variation — see `src/lib/gallery.js` for why the
  // listing photo has to lead it.
  const gallery = variantGallery(pr, prV);
  const hero = gallery[Math.min(shot, Math.max(0, gallery.length - 1))];

  const selectVariant = (v) => {
    setShot(0);
    ctx.setPrVariantId(v.id);
    ctx.setPrSku(v.sku);
    // Keep the URL on the chosen variation so it can be shared and indexed.
    window.history.replaceState(window.history.state, "", `/product/${encodeURIComponent(pr.id)}${v.sku ? `?variant=${encodeURIComponent(v.sku)}` : ""}`);
  };

  // "You may also like" was filed by category: it recommended whatever happened
  // to sit near this piece on a shelf. The shop's own shoppers answer it better
  // — what did people open in the same visit as this — so that comes first, and
  // the category is what fills in while the graph is still thin.
  //
  // Only products that still have something to sell — `card` reads the default
  // variation's price and photo, so an empty one has nothing to render.
  const sellableNow = (p) => p && p.id !== pr.id && p.variants && p.variants.length;
  const alsoIds = (ctx.alsoViewed[pr.id] || []).slice(0, 6);
  const seenIds = new Set();
  const related = alsoIds
    .map((id) => ctx.products.find((p) => p.id === id))
    .concat(ctx.products.filter((p) => p.cat === pr.cat))
    .filter((p) => sellableNow(p) && !seenIds.has(p.id) && seenIds.add(p.id))
    .slice(0, 3)
    .map(ctx.card)
    .filter(Boolean);
  const relatedFromShoppers = alsoIds.length > 0;
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: `clamp(24px, 4vw, 44px) ${PAD}` }}>
      <button onClick={() => ctx.nav("shop")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-purple-700)", padding: 0, marginBottom: 22 }}>← Back to shop</button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(400px, 100%), 1fr))", gap: "clamp(28px, 5vw, 56px)", alignItems: "start" }}>
        <div style={{ position: "relative" }}>
          <ImageSlot src={hero && hero.url} shape="rounded" radius={16} name={pr.name} eager
            sizes="(max-width: 820px) 96vw, 560px"
            label={`${pr.name} ${prV.size} — product photo`} style={{ width: "100%", height: 520 }} />
          {gallery.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {gallery.map((im, i) => (
                <button key={im.url + i} onClick={() => setShot(i)} aria-label={`View photo ${i + 1}`}
                  style={{ padding: 0, width: 64, height: 64, borderRadius: "var(--radius-md)", overflow: "hidden", cursor: "pointer", background: "none", border: `1px solid ${i === shot ? "var(--mr-purple-900)" : "var(--border-hairline)"}` }}>
                  <ImageSlot src={im.url} name={im.alt || ""} sizes="64px" style={{ width: "100%", height: "100%" }} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Eyebrow>{ctx.catLabel(pr.cat)}</Eyebrow>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 42px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "12px 0 6px" }}>{pr.name}</h1>
          {/* The label on the bottle, and the way to everything else under it. */}
          {pr.brand && (
            <a href={routeToPath("shop", { fBrand: brandSlug })} onClick={(e) => { e.preventDefault(); ctx.nav("shop", { fBrand: brandSlug }); }}
              style={{ display: "inline-block", fontSize: 13, fontWeight: 500, color: "var(--mr-orchid-600)", marginBottom: 10 }}>
              {pr.brand} —
            </a>
          )}
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontStyle: "italic", color: "var(--text-muted)", marginBottom: 14 }}>{pr.notes}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 600, color: "var(--mr-purple-900)" }}>{ctx.fmt(prV.ngn)}</span>
            {prV.compareAtNgn > prV.ngn && (
              <span style={{ fontSize: 15, color: "var(--text-muted)", textDecoration: "line-through" }}>{ctx.fmt(prV.compareAtNgn)}</span>
            )}
          </div>
          {prV.sku && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 16, fontFamily: "var(--font-condensed)", letterSpacing: "0.08em" }}>SKU {prV.sku}</div>}
          <p style={{ fontFamily: "var(--font-editorial)", fontSize: 15.5, lineHeight: "var(--lh-relaxed)", margin: "0 0 22px", maxWidth: "54ch" }}>{pr.desc}</p>
          <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-strong)", marginBottom: 8, textTransform: "uppercase" }}>{optionName}</div>
          <div role="group" aria-label={optionName} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {variants.map((v) => {
              const on = v.id === prV.id;
              const vOut = ctx.variantAvail(v).soldOut;
              return (
                <button key={v.id} onClick={() => selectVariant(v)} aria-pressed={on}
                  style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, padding: "10px 18px", borderRadius: "var(--radius-md)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : vOut ? "var(--text-muted)" : "var(--mr-purple-800)" }}>
                  <span style={{ textDecoration: vOut ? "line-through" : "none" }}>{v.size}</span> — {ctx.fmt(v.ngn)}
                </button>
              );
            })}
          </div>
          {scarce !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13.5, fontWeight: 500, color: "var(--accent-gold-ink)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
              Only {scarce} left in {cityName}
            </div>
          )}
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", background: "var(--surface-card)" }}>
              <button onClick={() => ctx.setPrQty(Math.max(1, ctx.prQty - 1))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "9px 15px", color: "var(--mr-purple-800)" }}>−</button>
              <span style={{ fontSize: 14, fontWeight: 600, minWidth: 22, textAlign: "center", color: "var(--text-strong)" }}>{ctx.prQty}</span>
              <button onClick={() => ctx.setPrQty(ctx.prQty + 1)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "9px 15px", color: "var(--mr-purple-800)" }}>+</button>
            </div>
            <Button variant="primary" size="lg" onClick={() => (soldOut ? ctx.joinWaitlist(pr.id, prV) : ctx.addToCart(pr.id, prV, ctx.prQty))}>
              {soldOut ? "Notify me when back" : "Add to cart — " + ctx.fmt(prV.ngn * ctx.prQty)}
            </Button>
            <button onClick={() => ctx.toggleWishlist(pr.id)} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "12px 18px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--mr-purple-800)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={ctx.wishlist.includes(pr.id) ? "var(--mr-orchid-500)" : "none"} stroke={ctx.wishlist.includes(pr.id) ? "var(--mr-orchid-500)" : "var(--mr-purple-800)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
              {ctx.wishlist.includes(pr.id) ? "Saved" : "Save"}
            </button>
          </div>
          <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "18px 20px", marginBottom: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-strong)", marginBottom: 10 }}>AVAILABILITY BY STORE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ctx.locations.map((l) => {
                const n = prV.stock[l.id] || 0;
                // "Only two left" is the house's own low-stock line, drawn in
                // Settings → Inventory and sent down per store — not a five
                // written into this file that would drift from it.
                const line = ctx.lowLine(prV, l.id);
                const thin = line !== null && n > 0 && n <= line;
                return (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                    <span style={{ color: "var(--text-body)" }}>{l.store}, {l.city}</span>
                    <span style={{ fontWeight: 500, color: n <= 0 ? "var(--text-muted)" : thin ? "var(--accent-gold-ink)" : "#3f6b45" }}>
                      {n <= 0 ? "Out of stock" : thin ? "Only " + n + " left" : "In stock"}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: "1px solid var(--border-hairline)", marginTop: 12, paddingTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
              {prA.inCity
                ? `Delivery in ${cityName}: ${L ? L.eta : ""} · Click & collect today at ${L ? L.store : ""}`
                : prA.soldOut
                ? "Join the waitlist and we'll email you as soon as it's back."
                : `Delivery to ${cityName}: 3–5 days (${prA.note})`}
            </div>
          </div>
        </div>
      </div>
      <RecentlyViewed ctx={ctx} exclude={pr.id} />
      <section style={{ marginTop: "clamp(40px, 6vw, 64px)" }}>
        <Eyebrow>{relatedFromShoppers ? "Often opened together" : "You may also like"}</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20, marginTop: 18 }}>
          {related.map((p) => (
            <div key={p.key} style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <div onClick={p.open} style={{ cursor: "pointer" }}>
                <ImageSlot src={p.imageUrl} name={p.name} sizes="(max-width: 640px) 92vw, 260px" style={{ width: "100%", height: 200 }} />
              </div>
              <div style={{ padding: "14px 16px 16px" }}>
                <a href={p.href} onClick={(e) => { e.preventDefault(); p.open(); }} style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)" }}>{p.name}</a>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{p.priceLabel}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

// Every word on this page is the client's, and none of it is code: the heading,
// the four lines that say what the house is, the founder's story, the band at
// the foot. They live in settings (Admin → Settings → About page) and fall back
// to the copy the store shipped with — see `src/lib/about.js`.
export function AboutPage({ ctx }) {
  const about = aboutContent(ctx.settings);
  const para = { fontFamily: "var(--font-editorial)", fontSize: 16.5, lineHeight: "var(--lh-relaxed)", color: "var(--text-body)", margin: "0 0 18px" };
  return (
    <main>
      <section style={{ background: "var(--royal-wash)", textAlign: "center", padding: `clamp(52px, 8vw, 96px) ${PAD}` }}>
        <Eyebrow tone="light">{about.eyebrow}</Eyebrow>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 5vw, 60px)", color: "var(--mr-cream)", letterSpacing: "var(--ls-display)", margin: "18px auto 0", maxWidth: "20ch" }}>{about.headline}</h1>
      </section>

      <section style={{ maxWidth: 860, margin: "0 auto", padding: `clamp(40px, 6vw, 64px) ${PAD} 0` }}>
        <Prose blocks={about.intro} para={para} />
      </section>

      {/* The founder's story, in full and in her own words — with her
          photograph at the head of it, so it reads as one woman's account
          rather than a page of copy. */}
      <section style={{ maxWidth: 980, margin: "0 auto", padding: `clamp(32px, 5vw, 48px) ${PAD} 0` }}>
        <GildedRule style={{ margin: "0 0 34px" }} />
        <div style={{ display: "grid", gridTemplateColumns: ctx.isMobile ? "minmax(0, 1fr)" : "minmax(0, 340px) minmax(0, 1fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "center", marginBottom: "clamp(28px, 4vw, 40px)" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: "18px -10px -10px 18px", border: "1px solid var(--mr-gold-400)", borderRadius: "var(--radius-lg)", pointerEvents: "none" }} />
            <ImageSlot src={about.founderPhoto} shape="rounded" radius={14} name={about.founderName} eager
              sizes="(max-width: 860px) 92vw, 440px" label={`${about.founderName} — ${about.founderRole}`}
              style={{ width: "100%", aspectRatio: "2 / 3", position: "relative" }} />
          </div>
          <div>
            <Eyebrow>Our story</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 3.4vw, 38px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "12px 0 14px" }}>{about.storyTitle}</h2>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--mr-purple-800)", fontWeight: 600 }}>{about.founderName}</strong>
              <br />{about.founderRole}
            </div>
          </div>
        </div>
        <div style={{ maxWidth: "72ch" }}>
          <Prose blocks={about.story} para={para} />
        </div>
      </section>

      {/* A house trading online only has no addresses to show, so the grid is
          switchable — and it stays out of the way when there is nothing in it
          rather than printing a heading over an empty row. */}
      {about.storesOn && ctx.locations.length > 0 && (
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: `clamp(40px, 6vw, 64px) ${PAD} 0` }}>
          <SectionHead centred eyebrow="Visit us" title="Our stores" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 16 }}>
            {ctx.locations.map((b) => (
              <div key={b.id} style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: 22 }}>
                <div style={{ fontFamily: "var(--font-condensed)", fontSize: 12, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)" }}>{b.city}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-strong)", margin: "8px 0 6px" }}>{b.store}</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)" }}>{b.address}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-body)", marginTop: 10 }}>Delivery {b.eta} in {b.city}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <CtaBand
        title={about.cta.title}
        lines={[about.cta.sub]}
        cta={about.cta.label}
        onClick={() => ctx.nav("shop")}
      />
      <div style={{ height: "clamp(32px, 5vw, 48px)" }} />
    </main>
  );
}

// The story reads as a letter, not as a blog post, so it keeps the editorial
// face and the wider leading it was set in rather than going through PostBody.
// What it does borrow is the house's one writing convention: a blank line
// between paragraphs, and `## ` at the head of a line for a heading — the same
// thing the blog and the information pages are written with.
function Prose({ blocks, para }) {
  return blocks.map((b, i) => (
    b.startsWith("## ")
      ? <h2 key={i} style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.6vw, 30px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: i ? "30px 0 14px" : "0 0 14px" }}>{b.slice(3).trim()}</h2>
      : <p key={i} style={{ ...para, whiteSpace: "pre-line" }}>{b}</p>
  ));
}

// A shopper at checkout is answering four questions: where is it going, who
// are you, how are you paying, and what does it come to. Everything on this
// page serves one of those. How the shop decides which branch packs the order,
// what the server does with the payment — none of that is the shopper's
// business, and none of it appears here.

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "22px 24px" };
const cardTitle = { fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 };
const money = { fontVariantNumeric: "tabular-nums" };

// A pair of tabs, not two radio cards with a paragraph each.
function Segmented({ options, value, onChange }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 6, padding: 4, background: "var(--surface-sunken)", borderRadius: "var(--radius-pill)" }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} role="tab" aria-selected={on} onClick={() => onChange(o.id)}
            style={{ flex: 1, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: on ? 600 : 500, padding: "10px 14px", borderRadius: "var(--radius-pill)", border: "none", background: on ? "var(--surface-card)" : "transparent", color: on ? "var(--mr-purple-900)" : "var(--text-muted)", boxShadow: on ? "var(--shadow-sm)" : "none", transition: "background var(--dur-fast) var(--ease-standard)" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function PayOption({ on, onClick, label, note, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={on}
      style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, textAlign: "left", fontFamily: "var(--font-sans)", display: "flex", gap: 12, alignItems: "center", padding: "13px 15px", borderRadius: "var(--radius-md)", border: `1px solid ${on ? "var(--mr-purple-700)" : "var(--border-hairline)"}`, background: on ? "var(--mr-lavender-200)" : "var(--surface-card)" }}>
      <span style={{ width: 15, height: 15, borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${on ? "var(--mr-purple-800)" : "var(--border-strong)"}`, background: on ? "var(--mr-purple-800)" : "transparent", boxShadow: on ? "inset 0 0 0 3px var(--surface-card)" : "none" }} />
      <span style={{ flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-strong)" }}>{label}</span>
        {note && <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{note}</span>}
      </span>
    </button>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// The one line the shopper actually wants from all of the routing machinery:
// when it turns up, and in how many parcels.
export function arrivalLine(ctx) {
  const { plan, co, cc } = ctx;
  if (co.fulfill === "collect") return "Ready to collect in about 3 hours";
  if (!plan || plan.mode === "unavailable") return cc.items.length ? "" : "";
  const etas = [...new Set(plan.deliveries.map((d) => d.eta).filter(Boolean))];
  if (plan.deliveries.length > 1) return `Arrives in ${plan.deliveries.length} deliveries · ${etas.join(" · ")}`;
  return etas.length ? `Arrives ${etas[0]}` : "";
}

function OrderSummary({ ctx, showPay }) {
  const { cc, co, setCo, plan } = ctx;
  const split = plan && plan.deliveries && plan.deliveries.length > 1;
  const arrival = arrivalLine(ctx);
  const blocked = plan && plan.mode === "unavailable";
  const row = (label, value, tone) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: tone || "inherit" }}>
      <span>{label}</span><span style={{ ...money, fontWeight: 500, color: tone || "var(--text-strong)" }}>{value}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cc.items.map((it) => (
          <div key={it.key} style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ position: "relative", flexShrink: 0 }}>
              <ImageSlot src={it.imageUrl} name={it.name} sizes="46px" shape="rounded" radius={8} style={{ width: 46, height: 46 }} />
              <span style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "var(--mr-purple-900)", color: "var(--mr-cream)", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{it.qty}</span>
            </span>
            <span style={{ flex: 1, fontSize: 13, color: "var(--text-strong)", lineHeight: 1.4 }}>
              {it.name}<span style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>{it.size}</span>
            </span>
            <span style={{ ...money, fontSize: 13, fontWeight: 600, color: "var(--mr-purple-900)" }}>{it.lineLabel}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input value={co.promo} onChange={(e) => setCo({ ...co, promo: e.target.value.toUpperCase() })}
          onKeyDown={(e) => e.key === "Enter" && ctx.applyPromo()} placeholder="Promo or reward code" aria-label="Promo or reward code"
          style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 13, padding: "10px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", textTransform: "uppercase", color: "var(--text-strong)", background: "var(--surface-card)" }} />
        <Button variant="secondary" size="sm" onClick={ctx.applyPromo}>Apply</Button>
      </div>
      {ctx.promoMsg && (
        <div style={{ fontSize: 12.5, marginTop: -8, display: "flex", gap: 8, color: ctx.promoInfo ? "var(--accent-gold-ink)" : "#c0587a" }}>
          <span style={{ flex: 1 }}>{ctx.promoMsg}</span>
          {ctx.promoInfo && <button onClick={ctx.clearPromo} aria-label="Remove this code" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 14, lineHeight: 1 }}>✕</button>}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13.5, borderTop: "1px solid var(--border-hairline)", paddingTop: 15 }}>
        {row("Subtotal", ctx.fmt(cc.sub))}
        {cc.discount > 0 && row(ctx.promoInfo ? ctx.promoInfo.code : "Discount", "−" + ctx.fmt(cc.discount), "var(--accent-gold-ink)")}
        {row(
          co.fulfill === "collect" ? "Collection" : split ? `Delivery (${plan.deliveries.length})` : "Delivery",
          ctx.planning && !plan ? "—" : cc.ship === 0 ? "Free" : ctx.fmt(cc.ship)
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 600, color: "var(--mr-purple-900)", borderTop: "1px solid var(--border-hairline)", paddingTop: 12, marginTop: 3 }}>
          <span>Total</span><span style={money}>{ctx.fmt(cc.total)}</span>
        </div>
      </div>

      {arrival && !blocked && (
        <div style={{ fontSize: 12.5, color: "var(--text-body)", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>{arrival}</div>
      )}
      {/* Several deliveries means several arrival dates. The shopper is told
          what turns up when — not which branch each one leaves from. */}
      {split && !blocked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
          {plan.deliveries.map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, alignItems: "flex-start" }}>
              <span style={{ width: 19, height: 19, borderRadius: "50%", background: "var(--mr-lavender-200)", color: "var(--mr-purple-800)", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ flex: 1, color: "var(--text-muted)" }}>
                <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>{d.eta}</span>
                <span style={{ display: "block" }}>{d.items.map((it) => `${it.name} ${it.size}${it.qty > 1 ? ` ×${it.qty}` : ""}`).join(", ")}</span>
              </span>
              <span style={{ ...money, fontWeight: 500, color: "var(--mr-purple-900)" }}>{d.ship === 0 ? "Free" : ctx.fmt(d.ship)}</span>
            </div>
          ))}
        </div>
      )}

      {showPay && <PayButton ctx={ctx} />}
    </div>
  );
}

function PayButton({ ctx }) {
  const { cc, co, plan } = ctx;
  const blocked = plan && plan.mode === "unavailable";
  const label = ctx.placing
    ? "Working…"
    : ctx.reconfirm
      ? "Confirm and pay " + ctx.fmt(cc.total)
      : co.pay === "whatsapp"
        ? "Continue on WhatsApp"
        : co.pay === "transfer"
          ? "Place order — " + ctx.fmt(cc.total)
          : "Pay " + ctx.fmt(cc.total);
  return (
    <div>
      <Button variant="gold" size="lg" block disabled={ctx.placing || blocked} onClick={ctx.placeOrder}>{label}</Button>
      {ctx.coErr && <div role="alert" style={{ fontSize: 12.5, color: "#c0587a", marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>{ctx.coErr}</div>}
      {co.pay === "paystack" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11.5, color: "var(--text-muted)", marginTop: 12 }}>
          <LockIcon />Secured by Paystack
        </div>
      )}
    </div>
  );
}

export function CheckoutPage({ ctx }) {
  const { cc, co, setCo, cityName, isMobile } = ctx;
  const [openSummary, setOpenSummary] = useState(false);

  if (!cc.items.length) {
    return (
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: `clamp(28px, 4vw, 48px) ${PAD}` }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 36px)", color: "var(--text-strong)", margin: "0 0 24px" }}>Checkout</h1>
        <div style={{ ...card, textAlign: "center", padding: "56px 20px" }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 19, color: "var(--text-body)", margin: "0 0 18px" }}>Your cart is empty.</p>
          <Button variant="primary" onClick={() => ctx.nav("shop")}>Browse the collection</Button>
        </div>
      </main>
    );
  }

  // Only methods the server will accept — a card option with no gateway behind
  // it is a dead end at the last step.
  const payDefs = [
    { id: "paystack", label: "Card, transfer or USSD", note: "Pay securely with Paystack" },
    { id: "transfer", label: "Bank transfer", note: "Held for 2 hours" },
    { id: "whatsapp", label: "WhatsApp", note: "Finish with us in chat" },
  ].filter((p) => ctx.payMethods[p.id]);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: `clamp(24px, 4vw, 44px) ${PAD}` }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 36px)", color: "var(--text-strong)", margin: "0 0 22px" }}>Checkout</h1>

      {/* On a phone the summary opens above the form, so the total is one tap
          away without pushing the first field below the fold. */}
      {isMobile && (
        <div style={{ ...card, padding: 0, marginBottom: 18, overflow: "hidden" }}>
          <button onClick={() => setOpenSummary((o) => !o)} aria-expanded={openSummary}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
            <span style={{ textAlign: "left" }}>
              <span style={{ fontSize: 13.5, color: "var(--mr-purple-800)" }}>
                Order summary <span style={{ color: "var(--text-muted)" }}>({cc.items.length})</span> {openSummary ? "▴" : "▾"}
              </span>
              {arrivalLine(ctx) && <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{arrivalLine(ctx)}</span>}
            </span>
            <span style={{ ...money, fontSize: 16, fontWeight: 600, color: "var(--mr-purple-900)" }}>{ctx.fmt(cc.total)}</span>
          </button>
          {openSummary && <div style={{ padding: "0 20px 20px" }}><OrderSummary ctx={ctx} /></div>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.35fr) minmax(320px, 1fr)", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section style={card}>
            <div style={cardTitle}>Delivery</div>
            <Segmented
              value={co.fulfill}
              onChange={(id) => setCo({ ...co, fulfill: id })}
              options={[{ id: "delivery", label: `Deliver to ${cityName}` }, { id: "collect", label: "Collect in store" }]}
            />
            {co.fulfill === "delivery" && (
              <div style={{ marginTop: 16 }}>
                <Input label="Address" value={co.address} onChange={(e) => setCo({ ...co, address: e.target.value })} placeholder="House, street, area" autoComplete="street-address" />
              </div>
            )}
            {co.fulfill === "collect" && ctx.L && (
              <div style={{ marginTop: 14, fontSize: 13, color: "var(--text-body)", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--text-strong)" }}>{ctx.L.store}</strong><br />{ctx.L.address}
              </div>
            )}
          </section>

          <section style={card}>
            <div style={cardTitle}>Your details</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 14 }}>
              <Input label="Full name" value={co.name} onChange={(e) => setCo({ ...co, name: e.target.value })} autoComplete="name" />
              <Input label="Phone" type="tel" value={co.phone} onChange={(e) => setCo({ ...co, phone: e.target.value })} autoComplete="tel" />
              <Input
                label={co.pay === "paystack" ? "Email" : "Email (optional)"}
                type="email" value={co.email} onChange={(e) => setCo({ ...co, email: e.target.value })}
                autoComplete="email" hint="Your receipt goes here"
              />
            </div>
          </section>

          <section style={card}>
            <div style={cardTitle}>Payment</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {payDefs.map((p) => (
                <PayOption key={p.id} on={co.pay === p.id} onClick={() => setCo({ ...co, pay: p.id })} label={p.label} note={p.note} />
              ))}
            </div>
          </section>

          {isMobile && <PayButton ctx={ctx} />}
        </div>

        {!isMobile && (
          <aside style={{ ...card, position: "sticky", top: 84 }}>
            <div style={cardTitle}>Order summary</div>
            <OrderSummary ctx={ctx} showPay />
          </aside>
        )}
      </div>
    </main>
  );
}

export function ConfirmPage({ ctx }) {
  const p = ctx.placed;
  if (!p) return <HomePage ctx={ctx} />;
  // A card order comes back from the gateway either settled or not. Anything
  // else was placed to be paid for by hand and is simply confirmed.
  const awaitingCard = p.payKey === "paystack" && p.paid === false;
  const line = { display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13.5, padding: "11px 0", borderTop: "1px solid var(--border-hairline)" };
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: `clamp(36px, 6vw, 64px) ${PAD}` }}>
      <div style={{ textAlign: "center" }}>
        <span style={{ width: 52, height: 52, borderRadius: "50%", background: awaitingCard ? "var(--mr-sand)" : "#e4efe4", color: awaitingCard ? "var(--accent-gold-ink)" : "#3f6b45", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
          {awaitingCard ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12 5 5L20 7" /></svg>
          )}
        </span>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 34px)", color: "var(--text-strong)", margin: "0 0 8px" }}>
          {awaitingCard ? "Payment not confirmed yet" : "Order confirmed"}
        </h1>
        <p style={{ fontSize: 14.5, color: "var(--text-muted)", margin: "0 0 26px" }}>
          Order <strong style={{ color: "var(--mr-purple-900)" }}>{p.no}</strong>
        </p>
      </div>

      <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "6px 22px 18px" }}>
        {p.totalLabel && <div style={line}><span style={{ color: "var(--text-muted)" }}>Total</span><span style={{ fontWeight: 600, color: "var(--mr-purple-900)" }}>{p.totalLabel}</span></div>}
        <div style={line}><span style={{ color: "var(--text-muted)" }}>Payment</span><span style={{ color: "var(--text-strong)" }}>{p.pay}</span></div>
        {p.deliverTo && (
          <div style={line}>
            <span style={{ color: "var(--text-muted)" }}>{p.method === "Click & collect" ? "Collect from" : "Deliver to"}</span>
            <span style={{ color: "var(--text-strong)", textAlign: "right", maxWidth: "62%" }}>{p.deliverTo}</span>
          </div>
        )}
        {p.eta && (
          <div style={line}>
            <span style={{ color: "var(--text-muted)" }}>{p.parcels > 1 ? `Arrives (${p.parcels} deliveries)` : "Arrives"}</span>
            <span style={{ color: "var(--text-strong)", textAlign: "right" }}>{p.eta}</span>
          </div>
        )}
      </div>

      {awaitingCard && (
        <div style={{ marginTop: 18 }}>
          <Button variant="gold" size="lg" block onClick={() => ctx.payNow(p.no, ctx.co.email || ctx.co.phone)}>Pay now</Button>
        </div>
      )}

      {p.payKey === "transfer" && (
        <div style={{ marginTop: 18, background: "var(--mr-gold-200)", borderRadius: "var(--radius-md)", padding: "14px 18px", fontSize: 13.5, lineHeight: 1.7, color: "var(--mr-gold-600)" }}>
          {ctx.settings.bankDetails
            ? <>Transfer <strong>{p.totalLabel}</strong> to <strong>{ctx.settings.bankDetails}</strong>, using <strong>{p.no}</strong> as the reference.</>
            : <>We'll send you the bank details shortly.</>}
        </div>
      )}

      {!ctx.cust && ctx.co.email && <AccountNudge ctx={ctx} />}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
        <Button variant="primary" onClick={() => { ctx.setTrack((t) => ({ ...t, no: p.no, contact: ctx.co.email || ctx.co.phone, err: "" })); ctx.nav("track"); }}>Track this order</Button>
        <Button variant="ghost" onClick={() => ctx.nav("shop")}>Keep browsing</Button>
      </div>
    </main>
  );
}

// Turns the order just placed into a saved account in one step — the email is
// already known, so all that's missing is a password.
function AccountNudge({ ctx }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const create = async () => {
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    setBusy(true); setErr("");
    try {
      await ctx.custRegister({ email: ctx.co.email, password: pw, name: ctx.co.name, phone: ctx.co.phone, city: ctx.city, marketingOptIn: true });
      setDone(true);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  if (done) return (
    <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-lg)", padding: "16px 20px", marginTop: 20, fontSize: 13.5, color: "var(--mr-purple-900)" }}>
      Saved to <strong>{ctx.co.email}</strong>.
    </div>
  );
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "18px 20px", marginTop: 20, textAlign: "left" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)", marginBottom: 14 }}>Create an account</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Input label="Choose a password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} style={{ flex: 1, minWidth: 200 }} />
        <Button variant="gold" disabled={busy} onClick={create}>{busy ? "Saving…" : "Create account"}</Button>
      </div>
      {err && <div style={{ fontSize: 12.5, color: "#c0587a", marginTop: 8 }}>{err}</div>}
    </div>
  );
}

export function TrackPage({ ctx }) {
  const { track, setTrack } = ctx;
  const o = track.order;
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: `clamp(32px, 5vw, 56px) ${PAD}` }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 38px)", color: "var(--text-strong)", margin: "0 0 20px" }}>Track your order</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 14, alignItems: "end", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: 22 }}>
        <Input label="Order number" value={track.no} onChange={(e) => setTrack((t) => ({ ...t, no: e.target.value }))} placeholder="MR-10234" />
        <Input label="Phone or email" value={track.contact} onChange={(e) => setTrack((t) => ({ ...t, contact: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && ctx.doTrack()} />
        <Button variant="primary" onClick={ctx.doTrack}>Find my order</Button>
      </div>
      {track.err && <div style={{ fontSize: 13, color: "#c0587a", marginTop: 14 }}>{track.err}</div>}
      {o && (
        <div style={{ marginTop: 28, background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: 26 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 4 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text-strong)" }}>{o.no}</div>
            <Badge tone="gold">{o.status}</Badge>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 22 }}>
            Placed {o.placed} · {ctx.fmt(o.total)}{o.eta ? ` · Arrives ${o.eta}` : ""}
          </div>
          {/* The reward this purchase earned. It appears here rather than on
              the confirmation screen because a reward exists only once the
              money has landed — which, for a transfer, is after the shopper
              has left the checkout. */}
          {o.reward && (
            <div style={{ background: "var(--mr-gold-200)", border: "1px solid var(--mr-gold-400)", borderRadius: "var(--radius-md)", padding: "16px 18px", marginBottom: 22 }}>
              <div style={{ fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)" }}>Your reward</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--mr-purple-900)", margin: "6px 0 4px", letterSpacing: "0.04em" }}>{o.reward.code}</div>
              <div style={{ fontSize: 13, color: "var(--mr-gold-600)" }}>
                {o.reward.desc} on your next order{o.reward.expiresAt ? ` — use it by ${o.reward.expiresAt}` : ""}.
              </div>
            </div>
          )}
          {/* An order that was never paid for is a sale still waiting to happen
              — offer the way to finish it rather than leaving it stranded. */}
          {o.payable && (
            <div style={{ marginBottom: 22 }}>
              <Button variant="gold" block onClick={() => ctx.payNow(o.no, track.contact)}>Pay {ctx.fmt(o.total)} now</Button>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {o.steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: s.done ? (s.current ? "var(--accent-gold)" : "var(--mr-purple-700)") : "var(--surface-card)", border: `2px solid ${s.done ? (s.current ? "var(--mr-gold-400)" : "var(--mr-purple-700)") : "var(--border-strong)"}`, flexShrink: 0, marginTop: 3 }} />
                  {i < o.steps.length - 1 && <span style={{ width: 1, flex: 1, background: "var(--border-hairline)", minHeight: 34 }} />}
                </div>
                <div style={{ paddingBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: s.done ? "var(--text-strong)" : "var(--text-muted)" }}>{s.step}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{s.detail}</div>
                  {s.time && <div style={{ fontSize: 11.5, color: "var(--mr-lavender-600)", marginTop: 2 }}>{s.time}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export function ContactPage({ ctx }) {
  const { cf, setCf, settings } = ctx;
  const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: 22 };
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: `clamp(32px, 5vw, 56px) ${PAD}` }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", color: "var(--text-strong)", margin: "0 0 6px", maxWidth: "24ch" }}>Have a question about an order, product or fragrance?</h1>
      <p style={{ fontSize: 15, color: "var(--text-muted)", margin: "0 0 28px" }}>We&apos;re happy to help.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 24, alignItems: "start" }}>
        <div style={{ ...card, padding: 26 }}>
          {ctx.contactSent ? (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--mr-purple-900)", marginBottom: 8 }}>Message received.</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>We&apos;ll reply soon.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Input label="Name" autoComplete="name" value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} />
              <Input label="Email" type="email" autoComplete="email" value={cf.email} onChange={(e) => setCf({ ...cf, email: e.target.value })} />
              <Textarea label="Message" value={cf.msg} onChange={(e) => setCf({ ...cf, msg: e.target.value })} rows={4} />
              <Button variant="primary" onClick={ctx.sendContact}>Send us a message</Button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-strong)" }}>Live chat</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 10px" }}>Open {settings.contactHours}. We usually reply within minutes.</div>
              <Button variant="secondary" size="sm" onClick={() => ctx.setChat((s) => ({ ...s, open: true }))}>Start a chat</Button>
            </div>
          </div>
          <div style={{ ...card, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-strong)" }}>Customer service</div>
              {settings.contactEmail && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Email: <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></div>}
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>WhatsApp: <a href={`https://wa.me/${String(settings.contactPhone || "").replace(/[^\d]/g, "").replace(/^0/, "234")}`} target="_blank" rel="noopener noreferrer">{settings.contactPhone}</a></div>
              {settings.igUrl && (
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                  Instagram: <a href={settings.igUrl} target="_blank" rel="noopener noreferrer">{settings.igHandle || "@majesticroobee"}</a>
                </div>
              )}
            </div>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-strong)", marginBottom: 12 }}>Stores</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ctx.locations.map((b) => (
                <div key={b.id} style={{ fontSize: 13, lineHeight: 1.55 }}>
                  <strong style={{ color: "var(--mr-purple-800)", fontWeight: 600 }}>{b.city}</strong> — <span style={{ color: "var(--text-muted)" }}>{b.address}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// An information page — privacy, terms, returns, delivery, or anything else the
// house writes. The body is the blog's own plain-text format rendered by the
// blog's own PostBody, so nothing written in the admin is ever handed to
// dangerouslySetInnerHTML, and there is one renderer to keep good rather than
// two that drift.
export function InfoPage({ ctx }) {
  const wrapper = ctx.infoPage;
  const slug = ctx.pageSlug;
  if (!wrapper || wrapper.slug !== slug) {
    return <main style={{ maxWidth: 760, margin: "0 auto", padding: `clamp(32px, 5vw, 56px) ${PAD}` }}>
      <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Opening the page…</p>
    </main>;
  }
  if (wrapper.error || !wrapper.page) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: `clamp(32px, 5vw, 56px) ${PAD}` }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 40px)", color: "var(--text-strong)", margin: "0 0 22px" }}>Page not found</h1>
        <Button variant="primary" onClick={() => ctx.nav("shop")}>Shop</Button>
      </main>
    );
  }
  const page = wrapper.page;
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: `clamp(32px, 5vw, 56px) ${PAD}` }}>
      {page.eyebrow && <Eyebrow>{page.eyebrow}</Eyebrow>}
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", color: "var(--text-strong)", margin: "12px 0 6px" }}>{page.title}</h1>
      {page.updatedAt && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 8px" }}>Last updated {updatedLabel(page.updatedAt)}</p>
      )}
      <GildedRule style={{ margin: "18px 0 26px" }} />
      <PostBody body={page.body} />
      {/* The privacy page is the one place a promise about measurement is worth
          making, so it is also the place the switch lives — a policy that says
          "you can ask us to stop" and gives you no way to is not a policy. */}
      {slug === "privacy" && <MeasureSwitch ctx={ctx} />}
    </main>
  );
}

function MeasureSwitch({ ctx }) {
  const on = ctx.measuring;
  return (
    <div style={{ marginTop: 32, background: "var(--surface-sunken)", borderRadius: "var(--radius-lg)", padding: "20px 22px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-strong)" }}>Visit analytics</div>
      <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--text-body)", margin: "8px 0 14px" }}>
        We count page views anonymously to improve the shop. Nothing is shared.
      </p>
      <button
        onClick={() => ctx.setMeasuring(!on)}
        style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, padding: "10px 18px", borderRadius: "var(--radius-pill)", border: "1px solid var(--border-strong)", background: on ? "var(--surface-card)" : "var(--mr-purple-900)", color: on ? "var(--mr-purple-800)" : "var(--mr-cream)" }}>
        {on ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}

// The date the house last saved the page — never a date written into the file,
// which is what the old privacy notice had and what made it quietly untrue.
function updatedLabel(sqlDate) {
  const d = new Date(String(sqlDate).replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return String(sqlDate);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Lagos" });
}
