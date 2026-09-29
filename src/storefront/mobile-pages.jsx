// The storefront's pages on a phone, from "Majestic Roobee Mobile.dc.html".
//
// These draw the same data by the same rules as the desktop pages — the home
// page's blocks as the house arranged them (worker/home.js), the shop grid's
// filtering (shop-list.js), the cart and checkout arithmetic (App.jsx) — in a
// layout built for a thumb: rails that scroll sideways, two-column grids,
// filters in a sheet, and every page's one action pinned to the bottom.
//
// The category index and the cart are pages in their own right here, because a
// phone has no hover menu and no room for a drawer. Both work on a desktop too.
import React, { useEffect, useRef, useState } from "react";
import { ImageSlot, DealCard } from "../ds/components.jsx";
import { catTree, catFamily, countIn } from "../lib/categories.js";
import { aboutContent } from "../lib/about.js";
import { variantGallery } from "../lib/gallery.js";
import { fill, cardsFor, shelfCards, blockNav } from "./blocks.js";
import { useShopList, SHOP_TITLE, PRICE_BANDS } from "./shop-list.js";
import { useDealClock } from "./daily-deal.jsx";
import { EmbedCard, PostCard, FAQS } from "./pages-content.jsx";
import { arrivalLine } from "./pages.jsx";
import { goShop, SizeButton } from "./mobile-chrome.jsx";
import {
  I, BtnM, HeadM, Rail, RailEnd, CardGrid, MobileProductCard, Sheet, ActionBar, Radio, Stepper, FreeShipBar,
  chipTone, eyebrowM, h2M, linkBtn, fieldM,
} from "./mobile-ui.jsx";

const SHELF_PILLS = [
  { label: "New arrivals", fSeg: "new-arrivals" },
  { label: "Deals", fSeg: "deals", hot: true },
  { label: "Best sellers", fSeg: "best-sellers" },
  { label: "Gift sets", fSeg: "gift-sets" },
];
const card16 = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)" };
const sec = (top = 30) => ({ padding: `${top}px 16px 0` });
const hotTag = (style) => (
  <span style={{ position: "absolute", background: "var(--mr-orchid-600)", color: "#fff", fontFamily: "var(--font-sans)", fontSize: 8.5, fontWeight: 600, letterSpacing: "0.08em", padding: "2px 5px", borderRadius: "var(--radius-xs)", ...style }}>HOT</span>
);

// ---- Home -----------------------------------------------------------------

export function MobileHome({ ctx }) {
  const { settings, homeBlocks, cityName } = ctx;
  const vars = { city: cityName };
  const tiles = homeBlocks.filter((b) => b.kind === "tile");
  // The categories block is drawn as the circles at the top of the page — the
  // first thing a phone shows — so it isn't drawn a second time in the flow.
  const flow = homeBlocks.filter((b) => b.kind !== "tile" && b.kind !== "categories");
  const runningDeal = ctx.deals.length === 1 ? ctx.deals[0] : null;
  const cats = catTree(ctx.categories);
  return (
    <main style={{ paddingBottom: 8 }}>
      {cats.length > 0 && (
        <section style={{ padding: "18px 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 10px" }}>
            <span style={eyebrowM}>Categories</span>
            <button onClick={() => ctx.nav("categories")} style={{ ...linkBtn, padding: "6px 0" }}>See all</button>
          </div>
          <div className="mr-rail" style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 2px" }}>
            {cats.map((c) => (
              <button key={c.id} onClick={() => goShop(ctx, { fCat: c.id })} style={{ flex: "none", width: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                <span style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", display: "block", border: "1px solid var(--border-strong)", background: "var(--mr-lavender-200)" }}>
                  <ImageSlot src={c.imageUrl} name={c.label} sizes="64px" monoSize={18} style={{ width: "100%", height: "100%" }} />
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, lineHeight: 1.25, color: "var(--mr-purple-900)", textAlign: "center" }}>{c.label}</span>
              </button>
            ))}
            <RailEnd />
          </div>
        </section>
      )}

      <section style={sec(18)}>
        {/* Until the house sets a hero photograph the card is the royal wash
            alone — a placeholder monogram behind the headline reads as a fault. */}
        <div style={{ position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden", height: "clamp(330px, 88vw, 420px)", background: "var(--royal-wash)" }}>
          {settings.heroImage && <ImageSlot src={settings.heroImage} eager name="Majestic Roobee" sizes="100vw" style={{ width: "100%", height: "100%" }} />}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(0deg, rgba(36,20,48,0.94) 0%, rgba(36,20,48,0.62) 50%, rgba(36,20,48,0.08) 100%)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "22px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1.08, letterSpacing: "var(--ls-display)", color: "var(--mr-cream)", margin: 0, whiteSpace: "pre-line" }}>{settings.heroHeadline}</h1>
            {settings.heroSub && <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--mr-cream)", margin: 0, textWrap: "pretty" }}>{settings.heroSub}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 4 }}>
              <BtnM variant="gold" onClick={() => goShop(ctx)}>Shop now</BtnM>
              <button onClick={() => goShop(ctx, { fSeg: "new-arrivals" })} style={{ background: "none", border: "none", padding: "10px 0", color: "var(--mr-cream)", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 4 }}>New arrivals</button>
            </div>
          </div>
        </div>
      </section>

      {tiles.length > 0 && (
        <section style={{ padding: "12px 16px 0", display: "grid", gridTemplateColumns: `repeat(${Math.min(tiles.length, 3)}, minmax(0, 1fr))`, gap: 8 }}>
          {tiles.map((t) => (
            <a key={t.id} href={t.ctaTarget || "/shop"} onClick={blockNav(ctx, t.ctaTarget || "/shop")} style={{ position: "relative", height: 118, borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--mr-purple-800)", display: "block" }}>
              <ImageSlot src={t.imageUrl} name={t.title} sizes="33vw" style={{ width: "100%", height: "100%" }} />
              <span style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(36,20,48,0.92), rgba(36,20,48,0.1))", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2, padding: 10 }}>
                {t.eyebrow && <span style={{ fontFamily: "var(--font-condensed)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent-gold)" }}>{fill(t.eyebrow, vars)}</span>}
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.15, color: "var(--mr-cream)" }}>{fill(t.title, vars)}</span>
              </span>
            </a>
          ))}
        </section>
      )}

      <MobileDealCard ctx={ctx} />
      <RecentRail ctx={ctx} />

      {flow.map((b) => <MobileBlock key={b.id} block={b} ctx={ctx} vars={vars} runningDeal={runningDeal} />)}
    </main>
  );
}

// The daily deal as the design draws it on a phone: photo on the left, name,
// price and the button on the right, the clock in the heading.
function MobileDealCard({ ctx }) {
  const clock = useDealClock(ctx);
  if (!clock) return null;
  const { deal, units } = clock;
  const product = ctx.products.find((p) => p.id === deal.productId);
  const variant = product ? (product.variants || []).find((v) => v.id === deal.variantId) : null;
  const open = () => ctx.nav("product", { productId: deal.productId, prSku: deal.sku, prVariantId: deal.variantId });
  return (
    <section style={sec(22)}>
      <div style={{ ...card16, borderRadius: "var(--radius-lg)", padding: 14, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingBottom: 12 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-strong)" }}>{deal.headline}</span>
          <div style={{ display: "flex", gap: 4 }} aria-label="Time left">
            {units.map((u) => (
              <span key={u.label} style={{ minWidth: 36, background: "var(--mr-purple-900)", color: "var(--mr-cream)", borderRadius: "var(--radius-sm)", padding: "4px 0 3px", display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{u.n}</span>
                <span style={{ fontFamily: "var(--font-condensed)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-on-dark-muted)" }}>{u.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <button onClick={open} aria-label={deal.productName} style={{ position: "relative", width: 124, height: 124, flex: "none", borderRadius: "var(--radius-md)", overflow: "hidden", border: "none", padding: 0, cursor: "pointer", background: "var(--mr-lavender-200)" }}>
            <ImageSlot src={deal.imageUrl} name={deal.productName} sizes="124px" monoSize={32} style={{ width: "100%", height: "100%" }} />
            {deal.off > 0 && <span style={{ position: "absolute", top: 6, left: 6, background: "var(--mr-purple-900)", color: "var(--mr-cream)", fontSize: 10.5, fontWeight: 600, padding: "3px 7px", borderRadius: "var(--radius-xs)" }}>{deal.off}% OFF</span>}
          </button>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <a href={"/product/" + deal.productId} onClick={(e) => { e.preventDefault(); open(); }} style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, lineHeight: 1.4, color: "var(--text-strong)" }}>
              {deal.productName}{deal.size ? ` · ${deal.size}` : ""}
            </a>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: "var(--mr-purple-900)" }}>{ctx.fmt(deal.priceNgn)}</span>
              {deal.compareAtNgn && <span style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "line-through" }}>{ctx.fmt(deal.compareAtNgn)}</span>}
            </div>
            <div style={{ marginTop: "auto" }}>
              <BtnM block onClick={() => (variant ? ctx.addToCart(deal.productId, variant, 1) : open())}>{variant ? "Add to cart" : "View product"}</BtnM>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RecentRail({ ctx, exclude = null, title = "Recently viewed" }) {
  const picks = (ctx.recentIds || []).filter((id) => id !== exclude)
    .map((id) => ctx.listings.find((e) => e.product.id === id)).filter(Boolean)
    .map(ctx.card).filter(Boolean).slice(0, 8);
  if (ctx.settings.recentlyViewedOn === false || picks.length < 2) return null;
  return (
    <section style={{ paddingTop: 30 }}>
      <HeadM title={title} action="Clear" onAction={ctx.clearRecent} />
      <Rail>{picks.map((p) => <MobileProductCard key={p.key} p={p} />)}</Rail>
    </section>
  );
}

const PERK_ICON = { color: "var(--mr-purple-800)", display: "flex" };

// One home block, drawn for a phone. Kinds this file doesn't know render
// nothing, exactly as on a desktop — a half-deployed admin can't blank the shop.
function MobileBlock({ block, ctx, vars, runningDeal }) {
  const { settings } = ctx;
  const eyebrow = fill(block.eyebrow, vars);
  const title = fill(block.title, vars);
  const sub = fill(block.sub, vars);
  const go = blockNav(ctx, block.ctaTarget);

  switch (block.kind) {
    case "perks": {
      const reward = settings.rewardsOn;
      const perks = [
        { icon: I.truck(18), t: "Fast delivery", s: ctx.L && ctx.L.eta ? ctx.L.eta : "Nationwide" },
        { icon: I.lock(18), t: "Secure payment", s: "Card or transfer" },
        reward
          ? { icon: I.gift(18), t: "Rewards", s: "On every order" }
          : { icon: I.pin(18), t: "Worldwide", s: "Pay in ₦ or $" },
      ];
      return (
        <section style={{ padding: "16px 16px 0", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {perks.map((x) => (
            <div key={x.t} style={{ display: "flex", flexDirection: "column", gap: 4, padding: 10, borderRadius: "var(--radius-md)", background: "var(--mr-lavender-200)" }}>
              <span style={PERK_ICON}>{x.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--mr-purple-900)" }}>{x.t}</span>
              <span style={{ fontSize: 11, lineHeight: 1.4, color: "var(--text-body)" }}>{x.s}</span>
            </div>
          ))}
        </section>
      );
    }

    case "shelf": {
      const picks = shelfCards(block, ctx);
      if (!picks.length) return null;
      const isDeals = block.source === "segment" && block.refId === "deals";
      const named = isDeals && runningDeal;
      return (
        <section style={{ paddingTop: 30 }}>
          <HeadM eyebrow={eyebrow} title={named ? runningDeal.title : (title || (isDeals ? "Deals" : ""))} action={block.ctaLabel || (go ? "See all" : "")} onAction={go} />
          {named && runningDeal.desc && (
            <p style={{ margin: "-4px 16px 12px", fontSize: 13.5, fontWeight: 700, color: "var(--mr-cream)", background: "var(--mr-purple-900)", borderLeft: "4px solid var(--accent-gold)", borderRadius: "var(--radius-sm)", padding: "8px 12px", lineHeight: 1.45 }}>{runningDeal.desc}</p>
          )}
          <Rail>{picks.map((p) => <MobileProductCard key={p.key} p={p} />)}</Rail>
        </section>
      );
    }

    case "band": {
      const picks = cardsFor(block, ctx);
      const lines = block.lines || [];
      if (block.layout === "cta-band" || !picks.length) {
        return (
          <section style={sec()}>
            <div style={{ border: block.dark && block.layout !== "cta-band" ? "none" : "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", padding: "22px 18px", background: "var(--surface-card)", textAlign: "center" }}>
              <h2 style={{ ...h2M, fontSize: 22, margin: "0 0 8px" }}>{title}</h2>
              {lines.map((l) => <p key={l} style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 4px", color: "var(--text-body)" }}>{l}</p>)}
              {block.ctaLabel && <div style={{ paddingTop: 12 }}><BtnM block onClick={go || (() => goShop(ctx))}>{block.ctaLabel}</BtnM></div>}
            </div>
          </section>
        );
      }
      const dark = !!block.dark;
      return (
        <section style={sec()}>
          <div style={{ background: dark ? "var(--royal-wash)" : "var(--heather-wash)", borderRadius: "var(--radius-lg)", overflow: "hidden", color: dark ? "var(--mr-cream)" : "var(--text-strong)" }}>
            {block.imageUrl && <ImageSlot src={block.imageUrl} name={title} sizes="100vw" style={{ width: "100%", height: 170 }} />}
            <div style={{ padding: "22px 16px 16px" }}>
              {eyebrow && <div style={{ ...eyebrowM, color: dark ? "var(--accent-gold)" : "var(--accent-gold-ink)" }}>{eyebrow}</div>}
              <h2 style={{ ...h2M, fontSize: 22, margin: "6px 0 8px", color: dark ? "var(--mr-cream)" : "var(--text-strong)" }}>{title}</h2>
              {lines.map((l) => <p key={l} style={{ fontSize: 13, lineHeight: 1.55, margin: 0, color: dark ? "var(--mr-cream)" : "var(--text-body)" }}>{l}</p>)}
              <div style={{ height: 14 }} />
              <Rail width={150} gap={8} bleed>{picks.map((p) => <MobileProductCard key={p.key} p={p} />)}</Rail>
              {block.ctaLabel && <div style={{ paddingTop: 14 }}><BtnM variant={dark ? "gold" : "primary"} block onClick={go || (() => goShop(ctx))}>{block.ctaLabel}</BtnM></div>}
            </div>
          </div>
        </section>
      );
    }

    case "story": {
      const about = aboutContent(settings);
      return (
        <section style={sec()}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <ImageSlot src={about.founderPhoto} name={about.founderName} sizes="112px" monoSize={32} shape="rounded" radius={10} style={{ width: 112, height: 144, flex: "none" }} />
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {eyebrow && <div style={eyebrowM}>{eyebrow}</div>}
              <h2 style={{ ...h2M, fontSize: 18, lineHeight: 1.25 }}>{title || about.storyTitle}</h2>
              <p className="mr-clamp4" style={{ fontFamily: "var(--font-serif)", fontSize: 15.5, lineHeight: 1.45, margin: 0, color: "var(--text-body)" }}>{about.story[0]}</p>
              <button onClick={go || (() => ctx.nav("about"))} style={{ ...linkBtn, alignSelf: "flex-start", padding: "6px 0" }}>{block.ctaLabel || "Read our story"}</button>
            </div>
          </div>
        </section>
      );
    }

    case "rewards":
      return (
        <section style={sec()}>
          <div style={{ background: "var(--mr-purple-900)", borderRadius: "var(--radius-lg)", padding: "22px 18px", color: "var(--mr-cream)" }}>
            <div style={{ height: 1, background: "var(--gold-line)", marginBottom: 16 }} />
            {eyebrow && <div style={{ ...eyebrowM, color: "var(--accent-gold)" }}>{eyebrow}</div>}
            <h2 style={{ ...h2M, fontSize: 22, margin: "6px 0 8px", color: "var(--mr-cream)" }}>{title}</h2>
            {sub && <p style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 16px", color: "var(--mr-cream)" }}>{sub}</p>}
            <BtnM variant="gold" block onClick={go || (() => goShop(ctx))}>{block.ctaLabel || "Shop to earn your reward"}</BtnM>
          </div>
        </section>
      );

    case "reviews":
      if (!ctx.testimonials.length) return null;
      return (
        <section style={{ paddingTop: 30 }}>
          <HeadM eyebrow={eyebrow} title={title || settings.reviewsHeadline || "Reviews"} action={block.ctaLabel} onAction={go} />
          <Rail width={260}>{ctx.testimonials.slice(0, 9).map((t) => <EmbedCard key={t.id} t={t} />)}</Rail>
        </section>
      );

    case "blog":
      if (!ctx.latestPosts.length) return null;
      return (
        <section style={{ paddingTop: 30 }}>
          <HeadM eyebrow={eyebrow} title={title || settings.blogHeadline || "Blog"} action={block.ctaLabel} onAction={go} />
          <Rail width={260}>{ctx.latestPosts.slice(0, block.count || 3).map((p) => <PostCard key={p.slug} p={p} compact onOpen={() => ctx.nav("post", { postSlug: p.slug })} />)}</Rail>
        </section>
      );

    case "newsletter":
      return <MobileNewsletter ctx={ctx} title={title} sub={sub} />;

    case "instagram":
      if (!settings.igUrl) return null;
      return (
        <section style={{ padding: "30px 16px 8px" }}>
          {eyebrow && <div style={eyebrowM}>{eyebrow}</div>}
          <h2 style={{ ...h2M, margin: "4px 0 6px" }}>{title}</h2>
          {sub && <p style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 12px", color: "var(--text-body)" }}>{sub}</p>}
          <a href={settings.igUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 44, border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)", fontSize: 14, fontWeight: 500, color: "var(--mr-purple-800)" }}>
            {block.ctaLabel || "Follow us on Instagram"} · {settings.igHandle || "@majesticroobee"}
          </a>
        </section>
      );

    default:
      return null;
  }
}

function MobileNewsletter({ ctx, title, sub }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return (
    <section style={sec()}>
      <div style={{ background: "var(--mr-lavender-200)", borderRadius: "var(--radius-lg)", padding: "22px 18px" }}>
        <h2 style={{ ...h2M, fontSize: 22, margin: "0 0 8px" }}>{title || "Newsletter"}</h2>
        {sub && <p style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 14px", color: "var(--text-body)" }}>{sub}</p>}
        {done
          ? <div style={{ fontSize: 14, fontWeight: 500, color: "var(--mr-purple-900)" }}>You&apos;re subscribed.</div>
          : (
            <form onSubmit={(e) => { e.preventDefault(); if (ctx.joinList(email, "newsletter")) setDone(true); }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" aria-label="Your email address" style={fieldM} />
              <BtnM type="submit" block>Subscribe</BtnM>
            </form>
          )}
      </div>
    </section>
  );
}

// ---- Categories (the "Shop" tab) -------------------------------------------

export function CategoriesPage({ ctx }) {
  const [open, setOpen] = useState(null);
  const cats = catTree(ctx.categories);
  const byId = new Map(ctx.products.map((p) => [p.id, p]));
  const inCat = (id) => countIn(ctx.categories, ctx.products, id);
  // A shelf's products filed under one category — the same count the desktop
  // menu's flyout shows, so a row never leads to an empty grid.
  const shelfCount = (segment, catId) => {
    const fam = catFamily(ctx.categories, catId);
    return (ctx.segments[segment] || []).filter((id) => { const p = byId.get(id); return p && (!fam || fam.has(p.cat)); }).length;
  };
  const row = { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-sans)" };
  const subRow = { width: "100%", display: "flex", justifyContent: "space-between", padding: "12px 16px 12px 80px", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--mr-purple-800)" };
  const n = (x) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{x}</span>;
  return (
    <main style={{ padding: "20px 0 24px", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ padding: "0 16px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1.1, color: "var(--text-strong)", margin: "0 0 14px" }}>Shop</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {SHELF_PILLS.map((x) => (
            <button key={x.fSeg} onClick={() => goShop(ctx, { fSeg: x.fSeg })} style={{ position: "relative", height: 52, borderRadius: "var(--radius-md)", border: "1px solid var(--border-hairline)", background: "var(--surface-card)", fontFamily: "var(--font-condensed)", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mr-purple-900)", cursor: "pointer", boxShadow: "var(--shadow-xs)" }}>
              {x.label}
              {x.hot && hotTag({ top: 6, right: 8 })}
            </button>
          ))}
        </div>
      </div>
      <div style={{ ...eyebrowM, padding: "24px 16px 8px" }}>Categories</div>
      <div style={{ borderTop: "1px solid var(--border-hairline)" }}>
        {cats.map((c) => {
          const isOpen = open === c.id;
          const shelves = [["best-sellers", "Best sellers"], ["new-arrivals", "New arrivals"], ["deals", "Deals"]]
            .map(([seg, label]) => ({ seg, label, n: shelfCount(seg, c.id) })).filter((s) => s.n > 0);
          const expandable = c.children.length > 0 || shelves.length > 0;
          return (
            <div key={c.id} style={{ borderBottom: "1px solid var(--border-hairline)" }}>
              <button onClick={() => (expandable ? setOpen(isOpen ? null : c.id) : goShop(ctx, { fCat: c.id }))} aria-expanded={expandable ? isOpen : undefined} style={row}>
                <span style={{ width: 52, height: 52, borderRadius: "var(--radius-md)", overflow: "hidden", flex: "none", background: "var(--mr-lavender-200)" }}>
                  <ImageSlot src={c.imageUrl} name={c.label} sizes="52px" monoSize={18} style={{ width: "100%", height: "100%" }} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-strong)" }}>{c.label}</span>
                  {c.desc && <span style={{ fontSize: 12, lineHeight: 1.4, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.desc}</span>}
                </span>
                {n(inCat(c.id))}
                <span style={{ display: "flex", color: "var(--mr-purple-800)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 200ms" }}>{I.chevRight(16)}</span>
              </button>
              {isOpen && (
                <div style={{ background: "var(--surface-card)", padding: "4px 0 10px" }}>
                  <button onClick={() => goShop(ctx, { fCat: c.id })} style={{ ...subRow, fontWeight: 500, color: "var(--text-strong)" }}><span>Everything</span>{n(inCat(c.id))}</button>
                  {c.children.map((sc) => (
                    <button key={sc.id} onClick={() => goShop(ctx, { fCat: sc.id })} style={subRow}><span>{sc.label}</span>{n(inCat(sc.id))}</button>
                  ))}
                  {shelves.map((s) => (
                    <button key={s.seg} onClick={() => goShop(ctx, { fCat: c.id, fSeg: s.seg })} style={{ ...subRow, padding: "10px 16px 10px 80px", fontSize: 13, color: "var(--mr-orchid-600)" }}><span>{s.label}</span>{n(s.n)}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <button onClick={() => goShop(ctx)} style={{ ...row, justifyContent: "space-between", padding: "16px", fontSize: 15, fontWeight: 500, color: "var(--mr-purple-700)" }}>
          <span>All products</span>{n(ctx.products.length)}
        </button>
      </div>
    </main>
  );
}

// ---- The shop listing -----------------------------------------------------

const SEG_CHIPS = [[null, "All"], ["new-arrivals", "New arrivals"], ["deals", "Deals"], ["best-sellers", "Best sellers"], ["gift-sets", "Gift sets"]];
const GENDER_LABEL = { Female: "Women", Male: "Men", Unisex: "Unisex" };

export function MobileShop({ ctx }) {
  const L = useShopList(ctx, { mobile: true });
  const { list, seg, segCopy, activeCat, trail, collection, brand, brandName, searching, runningDeals, scopedOut, listings, collections } = L;
  const [sheet, setSheet] = useState(null);
  const mf = ctx.mf;
  const setMf = (patch) => ctx.setMf((m) => ({ ...m, ...patch }));
  // Refining the listing replaces the address rather than stacking history:
  // ten taps on filter chips shouldn't take ten presses of back to undo.
  const refine = (extra) => ctx.nav("shop", { fCat: ctx.fCat, fCol: ctx.fCol, fSeg: ctx.fSeg, fBrand: ctx.fBrand, ...extra }, { replace: true });

  const title = searching ? `Results for “${ctx.search}”`
    : segCopy ? (activeCat ? `${segCopy.title} · ${activeCat.label}` : segCopy.title)
      : brand ? brandName : collection ? collection.title : activeCat ? activeCat.label : SHOP_TITLE;
  // Under a sub-category the parent's name sits above the heading; otherwise
  // the heading stands alone.
  const eyebrow = trail.length > 1 ? trail[0].label : "";
  const desc = !searching && !segCopy && (collection ? collection.desc : activeCat ? activeCat.desc : "");

  // Sub-categories of wherever the shopper is, as a second row of chips.
  const parent = activeCat ? (activeCat.parentId ? ctx.categories.find((c) => c.id === activeCat.parentId) : activeCat) : null;
  const kids = parent ? ctx.categories.filter((c) => c.parentId === parent.id) : [];

  // "For" and scent family only when the catalogue has more than one of them —
  // a filter with one option is a filter that does nothing.
  const distinct = (key) => [...new Set(listings.map((e) => e.product[key]).filter(Boolean))].sort();
  const genders = distinct("gender");
  const families = distinct("family");

  const priceOpts = [["all", "Any price"], ["under", `Under ${ctx.fmt(PRICE_BANDS[0])}`], ["mid", `${ctx.fmt(PRICE_BANDS[0])}–${ctx.fmt(PRICE_BANDS[1])}`], ["over", `Over ${ctx.fmt(PRICE_BANDS[1])}`]];
  const active = [];
  if (searching) active.push({ label: `“${ctx.search}”`, clear: () => ctx.setSearch("") });
  if (collection) active.push({ label: collection.title, clear: () => refine({ fCol: null }) });
  if (brand || ctx.fBrand) active.push({ label: brandName, clear: () => refine({ fBrand: "" }) });
  if (mf.price !== "all") active.push({ label: priceOpts.find((x) => x[0] === mf.price)[1], clear: () => setMf({ price: "all" }) });
  if (mf.gender !== "all") active.push({ label: GENDER_LABEL[mf.gender] || mf.gender, clear: () => setMf({ gender: "all" }) });
  if (mf.fam !== "all") active.push({ label: mf.fam, clear: () => setMf({ fam: "all" }) });
  const filterCount = ["price", "gender", "fam"].filter((k) => mf[k] !== "all").length + (ctx.fScope === "all" ? 1 : 0);
  const sortOpts = [["featured", "Featured"], ["best", "Best sellers"], ["new", "Newest"], ["low", "Price: low to high"], ["high", "Price: high to low"], ["name", "Name A–Z"]];
  const resetAll = () => { ctx.setMf({ price: "all", gender: "all", fam: "all" }); ctx.setFScope("city"); ctx.setSearch(""); };

  const chipRow = (items, small) => (
    <div className="mr-rail" style={{ display: "flex", gap: small ? 6 : 8, overflowX: "auto", padding: "0 16px 10px" }}>
      {items.map((x) => (
        <button key={x.label} onClick={x.pick} aria-pressed={x.on}
          style={{ flex: "none", height: small ? 34 : 38, padding: `0 ${small ? 12 : 14}px`, borderRadius: small ? "var(--radius-sm)" : "var(--radius-pill)", fontFamily: "var(--font-sans)", fontSize: small ? 12.5 : 13, cursor: "pointer", whiteSpace: "nowrap", ...chipTone(x.on) }}>
          {x.label}
        </button>
      ))}
      <RailEnd />
    </div>
  );
  const barBtn = { flex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--mr-purple-900)", minWidth: 0 };
  const showStrips = !searching && !collection && !seg && !brand && ctx.fCat === "all" && collections.length > 0;

  return (
    <main style={{ paddingBottom: 24 }}>
      <div style={{ padding: "18px 16px 12px" }}>
        {eyebrow && <div style={eyebrowM}>{eyebrow}</div>}
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1.15, color: "var(--text-strong)", margin: eyebrow ? "4px 0 0" : 0, textWrap: "pretty" }}>{title}</h1>
        {desc && <p style={{ fontSize: 13, lineHeight: 1.5, margin: "6px 0 0", color: "var(--text-body)" }}>{desc}</p>}
      </div>
      {chipRow(SEG_CHIPS.map(([id, label]) => ({ label, on: (seg || null) === id, pick: () => refine({ fSeg: id }) })))}
      {kids.length > 0 && chipRow([
        { label: `All ${parent.label.toLowerCase()}`, on: ctx.fCat === parent.id, pick: () => refine({ fCat: parent.id }) },
        ...kids.map((k) => ({ label: k.label, on: ctx.fCat === k.id, pick: () => refine({ fCat: k.id }) })),
      ], true)}

      <div style={{ position: "sticky", top: 56, zIndex: 15, background: "rgba(250,246,241,0.96)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderTop: "1px solid var(--border-hairline)", borderBottom: "1px solid var(--border-hairline)", display: "flex", alignItems: "center", height: 48 }}>
        <button onClick={() => setSheet("filter")} style={{ ...barBtn, fontWeight: 500, borderRight: "1px solid var(--border-hairline)" }}>
          {I.filter(16)} Filter
          {filterCount > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "var(--accent-gold)", color: "var(--mr-purple-950)", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{filterCount}</span>}
        </button>
        <button onClick={() => setSheet("sort")} style={barBtn}>
          {I.sort(16)}<span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sortOpts.find((x) => x[0] === ctx.fSort)[1]}</span>
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "10px 16px 0" }}>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)", marginRight: 4 }}>{list.length} {list.length === 1 ? "product" : "products"}</span>
        {active.map((x) => (
          <button key={x.label} onClick={x.clear} aria-label={`Remove ${x.label}`} style={{ height: 30, display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderRadius: "var(--radius-pill)", border: "1px solid var(--border-strong)", background: "var(--mr-lavender-200)", fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--mr-purple-900)", cursor: "pointer" }}>
            {x.label}{I.close(11, 2.2)}
          </button>
        ))}
      </div>
      {!searching && ctx.fScope === "city" && scopedOut > 0 && list.length > 0 && (
        <div style={{ padding: "6px 16px 0", fontSize: 12, color: "var(--text-muted)" }}>
          In stock in {ctx.cityName} ·{" "}
          <button onClick={() => ctx.setFScope("all")} style={{ background: "none", border: "none", padding: 0, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, color: "var(--mr-purple-700)", textDecoration: "underline", cursor: "pointer" }}>Show all stores (+{scopedOut})</button>
        </div>
      )}

      {runningDeals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px 0" }}>
          {runningDeals.map((d) => <DealCard key={d.id} deal={d} meta={`${d.productIds.length} ${d.productIds.length === 1 ? "product" : "products"}${d.endsAt ? ` · ends ${d.endsAt}` : ""}`} />)}
        </div>
      )}

      {showStrips && collections.map((col) => {
        const picks = col.productIds.flatMap((id) => listings.filter((e) => e.product.id === id));
        if (!picks.length) return null;
        return (
          <section key={col.id} style={{ paddingTop: 22 }}>
            <HeadM title={col.title} action={picks.length > 2 ? "See all" : ""} onAction={() => ctx.nav("shop", { fCol: col.id })} />
            <Rail>{picks.slice(0, 8).map((e) => <MobileProductCard key={e.key} p={ctx.card(e)} />)}</Rail>
          </section>
        );
      })}

      {list.length > 0
        ? <CardGrid cards={list.map((e) => ctx.card(e))} />
        : (
          <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 21, color: "var(--text-strong)", margin: 0 }}>
              {searching ? `No results for “${ctx.search}”.` : `Nothing in stock in ${ctx.cityName}.`}
            </p>
            {!searching && ctx.fScope === "city" && scopedOut > 0 && <BtnM variant="secondary" onClick={() => ctx.setFScope("all")}>Show all stores</BtnM>}
            <BtnM onClick={resetAll}>Clear filters</BtnM>
          </div>
        )}

      {sheet === "filter" && (
        <Sheet title="Filter" onClose={() => setSheet(null)}
          footer={<>
            <BtnM variant="secondary" size="lg" onClick={resetAll}>Clear</BtnM>
            <BtnM size="lg" block style={{ flex: 1 }} onClick={() => setSheet(null)}>Show {list.length} {list.length === 1 ? "product" : "products"}</BtnM>
          </>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 4 }}>
            {!searching && (
              <button onClick={() => ctx.setFScope(ctx.fScope === "city" ? "all" : "city")} role="switch" aria-checked={ctx.fScope === "city"}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 56, padding: "0 14px", ...card16, cursor: "pointer", textAlign: "left", fontFamily: "var(--font-sans)" }}>
                <span>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--text-strong)" }}>In stock in {ctx.cityName}</span>
                </span>
                <span style={{ width: 44, height: 24, borderRadius: 12, background: ctx.fScope === "city" ? "var(--mr-purple-900)" : "var(--border-strong)", position: "relative", flex: "none", transition: "background 200ms" }}>
                  <span style={{ position: "absolute", top: 2, left: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "var(--shadow-sm)", transform: ctx.fScope === "city" ? "translateX(20px)" : "none", transition: "transform 200ms" }} />
                </span>
              </button>
            )}
            <FilterGroup title="Category" opts={[["all", "Everything"], ...catTree(ctx.categories).map((c) => [c.id, c.label])]} value={parent ? parent.id : "all"} onPick={(id) => refine({ fCat: id })} />
            <FilterGroup title="Price" opts={priceOpts} value={mf.price} onPick={(id) => setMf({ price: id })} />
            {genders.length > 1 && <FilterGroup title="For" opts={[["all", "Everyone"], ...genders.map((g) => [g, GENDER_LABEL[g] || g])]} value={mf.gender} onPick={(id) => setMf({ gender: id })} />}
            {families.length > 1 && <FilterGroup title="Scent family" opts={[["all", "All"], ...families.map((f) => [f, f])]} value={mf.fam} onPick={(id) => setMf({ fam: id })} />}
          </div>
        </Sheet>
      )}
      {sheet === "sort" && (
        <Sheet onClose={() => setSheet(null)} pad="0" label="Sort by">
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-strong)", padding: "14px 20px 6px" }}>Sort by</div>
          {sortOpts.map(([id, label]) => (
            <button key={id} onClick={() => { ctx.setFSort(id); setSheet(null); }} aria-pressed={ctx.fSort === id}
              style={{ width: "100%", height: 52, display: "flex", alignItems: "center", gap: 14, padding: "0 20px", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--text-strong)", textAlign: "left" }}>
              <Radio on={ctx.fSort === id} />{label}
            </button>
          ))}
        </Sheet>
      )}
    </main>
  );
}

function FilterGroup({ title, opts, value, onPick }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", paddingBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {opts.map(([id, label]) => (
          <button key={id} onClick={() => onPick(id)} aria-pressed={value === id}
            style={{ height: 38, padding: "0 14px", borderRadius: "var(--radius-pill)", fontFamily: "var(--font-sans)", fontSize: 13, cursor: "pointer", ...chipTone(value === id) }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Product --------------------------------------------------------------

// The line under the price, when the house is running rewards: what a
// qualifying order earns, in the terms Admin → Rewards set.
function rewardLine(ctx) {
  const s = ctx.settings;
  if (!s.rewardsOn) return "";
  const v = parseInt(s.rewardEarnValue, 10) || 0;
  const kind = s.rewardEarnKind || "pct";
  const what = kind === "amt" ? `a ${ctx.fmt(v)} reward code` : kind === "item" ? "a free-gift reward code" : `a ${v || 10}% reward code`;
  const min = parseInt(s.rewardEarnMinSpend, 10) || 0;
  return `Earn ${what} when you order${min ? ` over ${ctx.fmt(min)}` : ""}`;
}

export function MobileProduct({ ctx }) {
  const pr = ctx.products.find((p) => p.id === ctx.productId);
  const variants = (pr && pr.variants) || [];
  const prV = variants.find((v) => v.id === ctx.prVariantId) || (ctx.prSku && variants.find((v) => v.sku === ctx.prSku)) || ctx.defaultVariant(variants);
  const prVId = prV ? prV.id : null;
  const [shot, setShot] = useState(0);
  const [acc, setAcc] = useState("desc");
  const gal = useRef(null);
  // A new size is a new gallery: back to its first photo.
  useEffect(() => { setShot(0); if (gal.current) gal.current.scrollLeft = 0; }, [prVId]);

  if (!pr || !variants.length) return <MobileShop ctx={ctx} />;

  const c = ctx.card({ key: pr.id, product: pr, variants, split: false });
  const vc = c.variants.find((x) => x.id === prV.id) || c.variants[0];
  const a = ctx.variantAvail(prV);
  const alt = a.inCity || a.soldOut ? null : ctx.bestAlt(prV);
  const L = ctx.L;
  const gallery = variantGallery(pr, prV);
  const photos = gallery.length ? gallery : [{ url: null, alt: pr.name }];
  const off = prV.compareAtNgn > prV.ngn ? Math.round((1 - prV.ngn / prV.compareAtNgn) * 100) : 0;
  const wished = ctx.wishlist.includes(pr.id);
  const cartCount = ctx.cart.reduce((n, x) => n + x.qty, 0);
  const brandSlug = (pr.brand || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const reward = rewardLine(ctx);
  const freeOver = ctx.settings.freeShipAbujaOver ?? 100000;
  const freeHere = ctx.city === (ctx.settings.freeShipCity ?? "abuja") && freeOver > 0;

  const selectVariant = (v) => {
    ctx.setPrVariantId(v.id);
    ctx.setPrSku(v.sku);
    ctx.setPrQty(1);
    window.history.replaceState(window.history.state, "", `/product/${encodeURIComponent(pr.id)}${v.sku ? `?variant=${encodeURIComponent(v.sku)}` : ""}`);
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: pr.name, url }); return; }
      await navigator.clipboard.writeText(url);
      ctx.flash("Link copied");
    } catch { /* the shopper closed the share sheet */ }
  };
  const add = () => (a.soldOut ? ctx.joinWaitlist(pr.id, prV) : ctx.addToCart(pr.id, prV, ctx.prQty));

  const alsoIds = (ctx.alsoViewed[pr.id] || []).slice(0, 8);
  const seen = new Set();
  const related = alsoIds.map((id) => ctx.products.find((p) => p.id === id))
    .concat(ctx.products.filter((p) => p.cat === pr.cat))
    .filter((p) => p && p.id !== pr.id && p.variants && p.variants.length && !seen.has(p.id) && seen.add(p.id))
    .slice(0, 8).map(ctx.card).filter(Boolean);

  const faq = (id) => ((FAQS.find((f) => f.id === id) || {}).a || []);
  const accs = [
    { key: "desc", title: "Description", body: [pr.desc].filter(Boolean) },
    { key: "notes", title: "Scent notes", body: [pr.notes && `Notes: ${pr.notes}`, pr.family && `Family: ${pr.family}`, pr.brand && `By ${pr.brand}`].filter(Boolean) },
    {
      key: "stores", title: "Availability by store",
      body: ctx.locations.map((l) => {
        const n = (prV.stock && prV.stock[l.id]) || 0;
        const line = ctx.lowLine(prV, l.id);
        const thin = line !== null && n > 0 && n <= line;
        return `${l.store}, ${l.city} — ${n <= 0 ? "out of stock" : thin ? `only ${n} left` : "in stock"}`;
      }),
    },
    { key: "ship", title: "Delivery & returns", body: [...faq("shipping"), ...faq("returns")] },
  ].filter((x) => x.body.length);

  return (
    <main style={{ paddingBottom: 24 }}>
      <div style={{ position: "relative" }}>
        <div ref={gal} className="mr-rail" onScroll={(e) => { const i = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth); if (i !== shot) setShot(i); }}
          style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", background: "var(--mr-lavender-200)" }}>
          {photos.map((im, i) => (
            <div key={(im.url || "ph") + i} style={{ flex: "none", width: "100%", aspectRatio: "1 / 1", maxHeight: "70vh", scrollSnapAlign: "start" }}>
              <ImageSlot src={im.url} name={pr.name} eager={i === 0} sizes="100vw" label={im.url ? undefined : `${pr.name} ${prV.size}`} style={{ width: "100%", height: "100%" }} />
            </div>
          ))}
        </div>
        {off > 0 && <span style={{ position: "absolute", top: 12, left: 12, background: "var(--mr-purple-900)", color: "var(--mr-cream)", fontSize: 11.5, fontWeight: 600, padding: "4px 9px", borderRadius: "var(--radius-xs)" }}>−{off}%</span>}
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => ctx.toggleWishlist(pr.id)} aria-label={wished ? "Remove from wishlist" : "Save to wishlist"} aria-pressed={wished} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.94)", boxShadow: "var(--shadow-sm)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, color: wished ? "var(--mr-orchid-500)" : "var(--mr-purple-800)" }}>{I.heart(19, wished ? "var(--mr-orchid-500)" : "none")}</button>
          <button onClick={share} aria-label="Share" style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.94)", boxShadow: "var(--shadow-sm)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, color: "var(--mr-purple-800)" }}>{I.share(18)}</button>
        </div>
        {photos.length > 1 && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 12, display: "flex", justifyContent: "center", gap: 5, pointerEvents: "none" }}>
            {photos.map((_, i) => <span key={i} style={{ width: shot === i ? 18 : 6, height: 6, borderRadius: 3, background: shot === i ? "var(--mr-purple-900)" : "var(--border-strong)", transition: "width 200ms" }} />)}
          </div>
        )}
      </div>

      <div style={{ padding: "18px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={eyebrowM}>{ctx.catLabel(pr.cat)}</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 27, lineHeight: 1.15, letterSpacing: "var(--ls-heading)", color: "var(--text-strong)", margin: 0 }}>{pr.name}</h1>
        {pr.brand && (
          <a href={`/brand/${brandSlug}`} onClick={(e) => { e.preventDefault(); ctx.nav("shop", { fBrand: brandSlug }); }} style={{ fontSize: 13, fontWeight: 500, color: "var(--mr-orchid-600)", alignSelf: "flex-start" }}>{pr.brand}</a>
        )}
        {pr.notes && <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontStyle: "italic", color: "var(--text-muted)" }}>{pr.notes}</div>}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, paddingTop: 2 }}>
          <span style={{ fontSize: 23, fontWeight: 600, color: "var(--mr-purple-900)" }}>{ctx.fmt(prV.ngn)}</span>
          {off > 0 && <span style={{ fontSize: 14, color: "var(--text-muted)", textDecoration: "line-through" }}>{ctx.fmt(prV.compareAtNgn)}</span>}
        </div>
        {reward && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--mr-purple-800)", background: "var(--mr-gold-200)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
            {I.gift(15)}{reward}
          </div>
        )}
      </div>

      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", paddingBottom: 8 }}>{c.optionName}</div>
        <div role="group" aria-label={c.optionName} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {c.variants.map((x) => <SizeButton key={x.id} v={x} on={x.id === prV.id} onClick={() => selectVariant(variants.find((y) => y.id === x.id))} />)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, fontSize: 13, fontWeight: 500, color: vc.availColor }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.soldOut ? "var(--mr-mute)" : a.inCity ? vc.availColor : "var(--mr-gold-500)" }} />
          {vc.availLine}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>Quantity</span>
          <Stepper value={ctx.prQty} onDec={() => ctx.setPrQty(Math.max(1, ctx.prQty - 1))} onInc={() => ctx.setPrQty(ctx.prQty + 1)} />
        </div>
      </div>

      <div style={{ ...card16, margin: "20px 16px 0" }}>
        <div style={{ display: "flex", gap: 12, padding: 14, borderBottom: "1px solid var(--border-hairline)" }}>
          <span style={{ color: "var(--mr-purple-800)", display: "flex", flex: "none" }}>{I.truck(20)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>Delivery to {ctx.cityName}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-body)", paddingTop: 2 }}>
              {a.inCity ? `${L ? ctx.fmt(L.shipNGN) : ""}${L && L.eta ? ` · arrives in ${L.eta}` : ""}` : alt ? `Ships from ${alt.city} · 3–5 days` : "Out of stock in every store right now"}
            </div>
            {freeHere && <div style={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 2 }}>Free delivery on orders over {ctx.fmt(freeOver)}</div>}
          </div>
          <button onClick={() => ctx.setSheet({ kind: "city" })} style={{ ...linkBtn, alignSelf: "flex-start", padding: 0, fontSize: 12.5 }}>Change</button>
        </div>
        <div style={{ display: "flex", gap: 12, padding: 14 }}>
          <span style={{ color: "var(--mr-purple-800)", display: "flex", flex: "none" }}>{I.store(20)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>Click &amp; collect · Free</div>
            <div style={{ fontSize: 12.5, color: "var(--text-body)", paddingTop: 2 }}>{L ? (a.inCity ? `Collect at ${L.store}` : `Not at ${L.store} right now`) : ""}</div>
          </div>
        </div>
      </div>

      <div style={{ margin: "16px 16px 0", borderTop: "1px solid var(--border-hairline)" }}>
        {accs.map((x) => {
          const open = acc === x.key;
          return (
            <div key={x.key} style={{ borderBottom: "1px solid var(--border-hairline)" }}>
              <button onClick={() => setAcc(open ? null : x.key)} aria-expanded={open} style={{ width: "100%", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 500, color: "var(--text-strong)" }}>
                {x.title}
                <span style={{ display: "flex", color: "var(--mr-purple-800)", transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>{I.chevDown(16, 1.8)}</span>
              </button>
              {open && (
                <div style={{ padding: "0 0 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {x.body.map((line) => <p key={line} style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, color: "var(--text-body)" }}>{line}</p>)}
                </div>
              )}
            </div>
          );
        })}
        {prV.sku && <div style={{ fontSize: 11.5, color: "var(--text-muted)", paddingTop: 10, fontFamily: "var(--font-condensed)", letterSpacing: "0.08em" }}>SKU {prV.sku}</div>}
      </div>

      {related.length > 0 && (
        <section style={{ paddingTop: 28 }}>
          <HeadM title={alsoIds.length ? "Often opened together" : "You may also like"} />
          <Rail>{related.map((p) => <MobileProductCard key={p.key} p={p} />)}</Rail>
        </section>
      )}
      <RecentRail ctx={ctx} exclude={pr.id} />

      <ActionBar>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => ctx.toggleWishlist(pr.id)} aria-label={wished ? "Remove from wishlist" : "Save to wishlist"} aria-pressed={wished} style={{ width: 50, height: 50, flex: "none", borderRadius: "50%", border: "1px solid var(--border-strong)", background: "var(--surface-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, color: wished ? "var(--mr-orchid-500)" : "var(--mr-purple-800)" }}>{I.heart(20, wished ? "var(--mr-orchid-500)" : "none")}</button>
          <button onClick={() => ctx.nav("cart")} aria-label={`Cart, ${cartCount} items`} style={{ position: "relative", width: 50, height: 50, flex: "none", borderRadius: "50%", border: "1px solid var(--border-strong)", background: "var(--surface-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, color: "var(--mr-purple-900)" }}>
            {I.bag(20)}
            {cartCount > 0 && <span style={{ position: "absolute", top: 2, right: 0, background: "var(--accent-gold)", color: "var(--mr-purple-950)", fontSize: 10.5, fontWeight: 600, minWidth: 17, height: 17, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{cartCount}</span>}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <BtnM variant="gold" size="lg" block onClick={add}>{a.soldOut ? "Notify me when back" : `Add to cart · ${ctx.fmt(prV.ngn * ctx.prQty)}`}</BtnM>
          </div>
        </div>
      </ActionBar>
    </main>
  );
}

// ---- Cart -----------------------------------------------------------------

export function CartPage({ ctx }) {
  const { cc } = ctx;
  const n = ctx.cart.reduce((a, c) => a + c.qty, 0);
  const inCart = new Set(ctx.cart.map((c) => c.id));
  const suggest = (ctx.segments["best-sellers"] || []).filter((id) => !inCart.has(id))
    .map((id) => ctx.listings.find((e) => e.product.id === id)).filter(Boolean)
    .slice(0, 8).map(ctx.card).filter(Boolean);
  const row = (label, value, color) => (
    <div style={{ display: "flex", justifyContent: "space-between", color: color || "inherit" }}><span>{label}</span><span style={{ color: color || "var(--text-strong)" }}>{value}</span></div>
  );
  const checkoutBtn = <BtnM variant="gold" size="lg" block onClick={() => ctx.nav("checkout")}>Checkout</BtnM>;
  return (
    <main style={{ padding: "18px 0 24px", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text-strong)", margin: 0, padding: "0 16px 14px" }}>
        Your cart <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--text-muted)" }}>({n})</span>
      </h1>
      {cc.items.length > 0 ? (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {cc.freeShip && <div style={{ ...card16, padding: "12px 14px" }}><FreeShipBar ctx={ctx} /></div>}
          <div style={{ ...card16, display: "flex", flexDirection: "column" }}>
            {cc.items.map((it, i) => (
              <div key={it.key} style={{ display: "flex", gap: 12, padding: 14, borderTop: i ? "1px solid var(--border-hairline)" : "none" }}>
                <button onClick={() => ctx.nav("product", { productId: it.id, prVariantId: it.variantId })} aria-label={it.name} style={{ width: 76, height: 76, flex: "none", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "none", padding: 0, background: "var(--mr-lavender-200)", cursor: "pointer" }}>
                  <ImageSlot src={it.imageUrl} name={it.name} sizes="76px" monoSize={18} style={{ width: "100%", height: "100%" }} />
                </button>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.3 }}>{it.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--mr-purple-900)", whiteSpace: "nowrap" }}>{it.lineLabel}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{it.size} · {it.unitLabel} each</span>
                  <span style={{ fontSize: 11.5, color: it.inCity ? "#3f6b45" : "var(--text-muted)" }}>{it.availNote}</span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6 }}>
                    <Stepper value={it.qty} onDec={it.dec} onInc={it.inc} h={36} w={40} />
                    <button onClick={it.remove} style={{ background: "none", border: "none", padding: "8px 0", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--text-muted)", textDecoration: "underline", cursor: "pointer" }}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <PromoBox ctx={ctx} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 2px 0", fontSize: 14 }}>
            {row("Subtotal", ctx.fmt(cc.sub))}
            {cc.discount > 0 && row(ctx.promoInfo ? ctx.promoInfo.code : "Discount", "−" + ctx.fmt(cc.discount), "#3f6b45")}
            {row(`Delivery to ${ctx.cityName}`, ctx.co.fulfill === "collect" || cc.ship === 0 ? "Free" : ctx.fmt(cc.ship))}
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ctx.L && ctx.L.eta && cc.allInCity ? `Arrives ${ctx.L.eta} · ` : ""}pick Click &amp; collect at checkout for free pickup</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 600, color: "var(--text-strong)", borderTop: "1px solid var(--border-hairline)", paddingTop: 10 }}><span>Total</span><span>{ctx.fmt(cc.total)}</span></div>
            {rewardLine(ctx) && <div style={{ fontSize: 12.5, color: "var(--mr-purple-700)" }}>{rewardLine(ctx).replace("when you order", "with this order")}.</div>}
          </div>
          {!ctx.isMobile && checkoutBtn}
        </div>
      ) : (
        <div style={{ padding: "28px 24px 8px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--mr-lavender-500)" }}>
          {I.bag(44)}
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 21, color: "var(--text-strong)", margin: 0 }}>Your cart is empty.</p>
          <BtnM onClick={() => goShop(ctx)}>Start shopping</BtnM>
        </div>
      )}
      {suggest.length > 0 && (
        <section style={{ paddingTop: 28 }}>
          <HeadM title="Customers also love" />
          <Rail>{suggest.map((p) => <MobileProductCard key={p.key} p={p} />)}</Rail>
        </section>
      )}
      {ctx.isMobile && cc.items.length > 0 && (
        <ActionBar>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: "none" }}>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Total</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-strong)" }}>{ctx.fmt(cc.total)}</div>
            </div>
            <div style={{ flex: 1 }}>{checkoutBtn}</div>
          </div>
        </ActionBar>
      )}
    </main>
  );
}

// One box for both kinds of code — a sale code or a personal reward. The
// server decides which it is and says why when it refuses.
function PromoBox({ ctx }) {
  const { co, setCo } = ctx;
  return (
    <div style={{ ...card16, padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", paddingBottom: 8 }}>Promo or reward code</div>
      {ctx.promoInfo ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--mr-lavender-200)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
          <span style={{ fontSize: 13, color: "var(--mr-purple-900)" }}>{ctx.promoMsg || ctx.promoInfo.code}</span>
          <button onClick={ctx.clearPromo} style={{ background: "none", border: "none", padding: 4, fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", cursor: "pointer", textDecoration: "underline" }}>Remove</button>
        </div>
      ) : (
        <>
          {ctx.promoMsg && <div role="alert" style={{ fontSize: 12.5, color: "var(--mr-orchid-600)", paddingBottom: 8 }}>{ctx.promoMsg}</div>}
          <form onSubmit={(e) => { e.preventDefault(); ctx.applyPromo(); }} style={{ display: "flex", gap: 8 }}>
            <input value={co.promo} onChange={(e) => setCo({ ...co, promo: e.target.value.toUpperCase() })} placeholder="Enter a code" aria-label="Promo or reward code" autoCapitalize="characters"
              style={{ ...fieldM, flex: 1, minWidth: 0, height: 46, padding: "0 12px", background: "var(--mr-cream)", textTransform: "uppercase" }} />
            <BtnM type="submit" variant="secondary" style={{ height: 46 }}>Apply</BtnM>
          </form>
        </>
      )}
    </div>
  );
}

// ---- Checkout -------------------------------------------------------------

export function MobileCheckout({ ctx }) {
  const { cc, co, setCo, plan, L } = ctx;
  const [sumOpen, setSumOpen] = useState(false);
  if (!cc.items.length) {
    return (
      <main style={{ padding: "24px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text-strong)", margin: 0 }}>Checkout</h1>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text-strong)", margin: 0 }}>Your cart is empty.</p>
        <BtnM onClick={() => goShop(ctx)}>Start shopping</BtnM>
      </main>
    );
  }
  const n = ctx.cart.reduce((a, c) => a + c.qty, 0);
  const split = plan && plan.deliveries && plan.deliveries.length > 1;
  const blocked = plan && plan.mode === "unavailable";
  const arrival = arrivalLine(ctx);
  const payDefs = [
    { id: "paystack", label: "Card, transfer or USSD", note: "Pay securely with Paystack" },
    { id: "transfer", label: "Bank transfer", note: "Held for 2 hours" },
    { id: "whatsapp", label: "Order on WhatsApp", note: "Confirm your order with us in chat" },
  ].filter((p) => ctx.payMethods[p.id]);
  const shipEst = cc.freeShip && cc.freeShip.remaining === 0 ? "Free" : L ? ctx.fmt(L.shipNGN) : "";
  const fulfilOpts = [
    { id: "delivery", label: "Delivery", sub: [shipEst, L && L.eta].filter(Boolean).join(" · ") },
    { id: "collect", label: "Click & collect", sub: `Free${L ? ` · ${L.store}` : ""}` },
  ];
  const payLabel = ctx.placing ? "Working…"
    : ctx.reconfirm ? `Confirm and pay ${ctx.fmt(cc.total)}`
      : co.pay === "whatsapp" ? `Send order on WhatsApp · ${ctx.fmt(cc.total)}`
        : co.pay === "transfer" ? `Place order · ${ctx.fmt(cc.total)}` : `Pay ${ctx.fmt(cc.total)}`;
  const payNote = co.pay === "paystack" ? "Secured by Paystack" : co.pay === "transfer" ? "We hold your order for 2 hours" : "We'll confirm it with you in chat";
  const shipValue = ctx.planning && !plan ? "—" : cc.ship === 0 ? "Free" : ctx.fmt(cc.ship);
  const box = { ...card16, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10 };
  const secTitle = { fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)" };
  const label = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--text-body)" };
  const field = { ...fieldM, background: "var(--mr-cream)" };
  const row = (l, v, color) => <div style={{ display: "flex", justifyContent: "space-between", color: color || "inherit" }}><span>{l}</span><span style={{ color: color || "var(--text-strong)" }}>{v}</span></div>;
  const set = (patch) => setCo({ ...co, ...patch });

  return (
    <main style={{ padding: "18px 16px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text-strong)", margin: 0 }}>Checkout</h1>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}>{I.lock(12, 2)}Secure checkout</span>
      </div>

      <div style={{ background: "var(--mr-lavender-200)", borderRadius: "var(--radius-md)" }}>
        <button onClick={() => setSumOpen(!sumOpen)} aria-expanded={sumOpen} style={{ width: "100%", minHeight: 50, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--mr-purple-900)" }}>
          {I.bag(16)}
          <span style={{ flex: 1, textAlign: "left" }}>Order summary · {n} {n === 1 ? "item" : "items"}</span>
          <strong style={{ fontWeight: 600 }}>{ctx.fmt(cc.total)}</strong>
          <span style={{ display: "flex", transform: sumOpen ? "rotate(180deg)" : "none" }}>{I.chevDown(14)}</span>
        </button>
        {sumOpen && (
          <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {cc.items.map((it) => (
              <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", overflow: "hidden", flex: "none", background: "var(--surface-card)" }}><ImageSlot src={it.imageUrl} name={it.name} sizes="44px" monoSize={18} style={{ width: "100%", height: "100%" }} /></span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text-strong)" }}>{it.name} <span style={{ color: "var(--text-muted)" }}>· {it.size} × {it.qty}</span></span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mr-purple-900)" }}>{it.lineLabel}</span>
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, borderTop: "1px solid var(--border-strong)", paddingTop: 8 }}>
              {row("Subtotal", ctx.fmt(cc.sub))}
              {cc.discount > 0 && row(ctx.promoInfo ? ctx.promoInfo.code : "Discount", "−" + ctx.fmt(cc.discount), "#3f6b45")}
              {row(co.fulfill === "collect" ? "Collection" : split ? `Delivery (${plan.deliveries.length})` : "Delivery", shipValue)}
            </div>
          </div>
        )}
      </div>

      <div style={box}>
        <div style={secTitle}>1 · Your details</div>
        <label style={label}>Full name<input value={co.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" style={field} /></label>
        <label style={label}>Phone (WhatsApp)<input type="tel" value={co.phone} onChange={(e) => set({ phone: e.target.value })} autoComplete="tel" placeholder="0803 000 0000" style={field} /></label>
        <label style={label}>{co.pay === "paystack" ? "Email — your receipt goes here" : "Email (optional)"}<input type="email" value={co.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" style={field} /></label>
      </div>

      <div style={box}>
        <div style={secTitle}>2 · Delivery</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {fulfilOpts.map((o) => {
            const on = co.fulfill === o.id;
            return (
              <button key={o.id} onClick={() => set({ fulfill: o.id })} aria-pressed={on} style={{ minHeight: 62, padding: "10px 12px", borderRadius: "var(--radius-md)", border: `1.5px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--surface-card)" : "transparent", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 3, fontFamily: "var(--font-sans)" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{o.label}</span>
                <span style={{ fontSize: 11.5, lineHeight: 1.35, color: "var(--text-muted)" }}>{o.sub}</span>
              </button>
            );
          })}
        </div>
        <button onClick={() => ctx.setSheet({ kind: "city" })} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 44, padding: "0 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", background: "var(--mr-cream)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--text-strong)" }}>
          <span>City · <strong style={{ fontWeight: 600 }}>{ctx.cityName}</strong></span>
          <span style={{ fontSize: 12.5, color: "var(--mr-purple-700)" }}>Change</span>
        </button>
        {co.fulfill === "delivery" ? (
          <>
            <label style={label}>Delivery address
              <textarea value={co.address} onChange={(e) => set({ address: e.target.value })} rows={3} autoComplete="street-address" placeholder="House number, street, area" style={{ ...field, height: "auto", padding: "12px 14px", resize: "none" }} />
            </label>
            {arrival && !blocked && <div style={{ fontSize: 12.5, color: "var(--text-body)" }}>{arrival}</div>}
          </>
        ) : L && (
          <div style={{ background: "var(--mr-lavender-200)", borderRadius: "var(--radius-sm)", padding: 12, fontSize: 13, lineHeight: 1.5, color: "var(--mr-purple-900)" }}>
            <strong style={{ fontWeight: 600 }}>{L.store}</strong>{L.address ? <><br />{L.address}</> : null}<br />{arrival}. We&apos;ll message you when it&apos;s packed.
          </div>
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
                  <span style={{ display: "block" }}>{d.items.map((x) => `${x.name} ${x.size}${x.qty > 1 ? ` ×${x.qty}` : ""}`).join(", ")}</span>
                </span>
                <span style={{ fontWeight: 500, color: "var(--mr-purple-900)" }}>{d.ship === 0 ? "Free" : ctx.fmt(d.ship)}</span>
              </div>
            ))}
          </div>
        )}
        {blocked && (
          <div role="alert" style={{ background: "var(--mr-gold-200)", borderRadius: "var(--radius-sm)", padding: "10px 12px", fontSize: 13, color: "var(--mr-purple-900)" }}>
            Something in your cart can&apos;t be sent to {ctx.cityName} right now. Try another city, or remove it from your cart.
          </div>
        )}
      </div>

      <div style={{ ...box, gap: 8 }}>
        <div style={{ ...secTitle, paddingBottom: 2 }}>3 · Payment</div>
        {payDefs.map((p) => {
          const on = co.pay === p.id;
          return (
            <button key={p.id} onClick={() => set({ pay: p.id })} aria-pressed={on} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 58, padding: "10px 12px", borderRadius: "var(--radius-md)", border: `1.5px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: "var(--surface-card)", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-sans)" }}>
              <Radio on={on} />
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-strong)" }}>{p.label}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.note}</span>
              </span>
            </button>
          );
        })}
      </div>

      <PromoBox ctx={ctx} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 2px", fontSize: 14 }}>
        {row("Subtotal", ctx.fmt(cc.sub))}
        {cc.discount > 0 && row(ctx.promoInfo ? ctx.promoInfo.code : "Discount", "−" + ctx.fmt(cc.discount), "#3f6b45")}
        {row(co.fulfill === "collect" ? "Collection" : split ? `Delivery (${plan.deliveries.length})` : "Delivery", shipValue)}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 600, color: "var(--text-strong)", borderTop: "1px solid var(--border-hairline)", paddingTop: 10 }}><span>Total</span><span>{ctx.fmt(cc.total)}</span></div>
        {rewardLine(ctx) && <div style={{ fontSize: 12.5, color: "var(--mr-purple-700)" }}>{rewardLine(ctx).replace("when you order", "with this order")}.</div>}
      </div>

      <ActionBar>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ctx.coErr && <div role="alert" style={{ fontSize: 12.5, lineHeight: 1.45, color: "#c0587a", textAlign: "center" }}>{ctx.coErr}</div>}
          <BtnM variant="gold" size="lg" block disabled={ctx.placing || blocked} onClick={ctx.placeOrder}>{payLabel}</BtnM>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 11.5, color: "var(--text-muted)" }}>{I.lock(11, 2.2)}{payNote}</div>
        </div>
      </ActionBar>
    </main>
  );
}

// ---- Wishlist -------------------------------------------------------------

export function MobileWishlist({ ctx }) {
  const saved = ctx.wishlist.map((id) => ctx.listings.find((e) => e.product.id === id)).filter(Boolean);
  return (
    <main style={{ padding: "18px 0 24px" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text-strong)", margin: 0, padding: "0 16px 4px" }}>
        Saved <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--text-muted)" }}>({saved.length})</span>
      </h1>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0, padding: "0 16px 4px" }}>
        {ctx.cust ? "Saved to your account — it follows you to any device you sign in on." : "Kept in this browser. "}
        {!ctx.cust && <button onClick={() => ctx.nav("account")} style={{ background: "none", border: "none", padding: 0, fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", textDecoration: "underline", cursor: "pointer" }}>Sign in to see it on every device.</button>}
      </p>
      {saved.length > 0
        ? <CardGrid cards={saved.map((e) => ctx.card(e))} />
        : (
          <div style={{ padding: 24, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--mr-lavender-500)" }}>
            {I.heart(40)}
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 21, color: "var(--text-strong)", margin: 0 }}>Nothing saved yet.</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Tap the heart on anything you like.</p>
            <BtnM onClick={() => goShop(ctx, { fSeg: "best-sellers" })}>Browse best sellers</BtnM>
          </div>
        )}
    </main>
  );
}
