// Storefront pages — ported from "Majestic Roobee Storefront.dc.html".
import React, { useState } from "react";
import { Eyebrow, GildedRule, Badge, Button, Input, Textarea, ImageSlot } from "../ds/components.jsx";

const PAD = "clamp(16px, 4vw, 40px)";

function AvailBadge({ p }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: "var(--radius-pill)", background: p.badgeBg, color: p.badgeFg, boxShadow: p.outline ? "inset 0 0 0 1px var(--border-strong)" : "none" }}>
      {p.avail}
    </span>
  );
}

function WishHeart({ wished, onClick, size = 32 }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={wished ? "Remove from wishlist" : "Save to wishlist"} title={wished ? "Saved" : "Save to wishlist"}
      style={{ position: "absolute", top: 10, right: 10, width: size, height: size, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-sm)" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill={wished ? "var(--mr-orchid-500)" : "none"} stroke={wished ? "var(--mr-orchid-500)" : "var(--mr-purple-800)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
    </button>
  );
}

// The variation picker on a listing card. Chips rather than a dropdown so the
// shopper sees every option without opening anything; below ~3 options a
// <select> would hide exactly the choice we want them to make. Past four
// options the chips wrap, which is why very long lists fall back to a select.
function VariantChips({ variants, selectedId, onSelect, optionName }) {
  const useSelect = variants.length > 4;
  if (useSelect) {
    return (
      <select
        aria-label={optionName}
        value={selectedId}
        onChange={(e) => onSelect(parseInt(e.target.value, 10))}
        style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, padding: "8px 10px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", background: "var(--surface-card)", color: "var(--text-strong)", cursor: "pointer", width: "100%" }}>
        {variants.map((v) => (
          <option key={v.id} value={v.id}>{v.label} — {v.priceLabel}{v.soldOut ? " · sold out" : ""}</option>
        ))}
      </select>
    );
  }
  return (
    <div role="group" aria-label={optionName} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {variants.map((v) => {
        const on = v.id === selectedId;
        return (
          <button
            key={v.id}
            onClick={(e) => { e.stopPropagation(); onSelect(v.id); }}
            aria-pressed={on}
            title={v.soldOut ? `${v.label} — out of stock` : `${v.label} — ${v.priceLabel}`}
            style={{
              cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500,
              padding: "5px 11px", borderRadius: "var(--radius-pill)",
              border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`,
              background: on ? "var(--mr-purple-900)" : "var(--surface-card)",
              color: on ? "var(--mr-cream)" : v.soldOut ? "var(--text-muted)" : "var(--mr-purple-800)",
              textDecoration: v.soldOut ? "line-through" : "none",
              transition: "all var(--dur-fast) var(--ease-standard)",
            }}>
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProductCard({ p, height = 230 }) {
  const [selId, setSelId] = useState(p ? p.defaultVariantId : null);
  // `card()` yields nothing for a product with no sellable variation.
  if (!p) return null;
  // The catalogue can reload under a mounted card (a placed order refreshes
  // stock); fall back to the default rather than rendering nothing.
  const v = p.variants.find((x) => x.id === selId) || p.variants.find((x) => x.id === p.defaultVariantId) || p.variants[0];
  const multi = p.variants.length > 1;
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative" }}>
        <div onClick={v.open} style={{ cursor: "pointer" }}>
          <ImageSlot src={v.imageUrl} name={p.name} style={{ width: "100%", height }} />
        </div>
        {p.toggleWish && <WishHeart wished={p.wished} onClick={p.toggleWish} />}
      </div>
      <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ fontSize: 11, fontFamily: "var(--font-condensed)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          {p.catLabel}
        </div>
        <a href={p.href} onClick={(e) => { e.preventDefault(); v.open(); }} style={{ fontFamily: "var(--font-display)", fontSize: 18.5, color: "var(--text-strong)", lineHeight: 1.25 }}>
          {/* A split card already carries the variation in its name. */}
          {p.name} {!multi && !p.split && <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>{v.label}</span>}
        </a>
        {multi && (
          <div style={{ marginTop: 4 }}>
            <VariantChips variants={p.variants} selectedId={v.id} onSelect={setSelId} optionName={p.optionName} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto", paddingTop: 8 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: "var(--mr-purple-900)" }}>{v.priceLabel}</span>
            {v.compareAtLabel && <span style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "line-through" }}>{v.compareAtLabel}</span>}
          </span>
          <AvailBadge p={v} />
        </div>
        {/* Never disabled: a sold-out variation still offers "Notify me". */}
        <Button variant="secondary" size="sm" block onClick={v.add}>{v.addLabel}</Button>
      </div>
    </div>
  );
}

export function HomePage({ ctx }) {
  const { settings, products, categories, cityName, L } = ctx;
  const dir = settings.heroDirection || "editorial split";
  const sellable = products.filter((p) => p.variants && p.variants.length);
  const inCity = sellable.filter((p) => ctx.availInfo(p).inCity).slice(0, 4).map(ctx.card).filter(Boolean);
  // Three picks from whatever is live, city stock first — never named ids, which
  // would break the moment the catalogue changes.
  const heroPicks = sellable
    .slice().sort((a, b) => (ctx.availInfo(b).inCity ? 1 : 0) - (ctx.availInfo(a).inCity ? 1 : 0))
    .slice(0, 3).map(ctx.card).filter(Boolean);
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
      {dir === "editorial split" && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 88px) ${PAD}`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", gap: "clamp(28px, 5vw, 64px)", alignItems: "center" }}>
          <div>
            <Eyebrow>Seductive fragrances · Feminine care</Eyebrow>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(38px, 5.4vw, 64px)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)", color: "var(--text-strong)", margin: "18px 0 0", whiteSpace: "pre-line" }}>{settings.heroHeadline}</h1>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(19px, 2vw, 23px)", lineHeight: 1.5, color: "var(--text-body)", maxWidth: "46ch", margin: "22px 0 30px" }}>{settings.heroSub}</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="primary" size="lg" onClick={() => ctx.nav("shop")}>Shop the collection</Button>
              <Button variant="ghost" size="lg" onClick={() => ctx.nav("about")}>Our story —</Button>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 34, fontSize: 12.5, color: "var(--text-muted)" }}>
              <span style={{ width: 22, height: 1, background: "var(--mr-gold-500)" }} />
              Now serving {cityName} from our {L ? L.store : "store"}
            </div>
          </div>
          <div style={{ position: "relative", minHeight: 380 }}>
            <div style={{ position: "absolute", inset: "24px -8px -8px 24px", border: "1px solid var(--mr-gold-400)", borderRadius: "var(--radius-lg)", pointerEvents: "none" }} />
            <ImageSlot shape="rounded" radius={16} name="Majestic Roobee" label="Warm editorial hero — bottle on silk" style={{ width: "100%", height: 460 }} />
          </div>
        </section>
      )}
      {dir === "royal statement" && (
        <section style={{ background: "var(--royal-wash)", textAlign: "center", padding: `clamp(64px, 10vw, 130px) ${PAD}` }}>
          <Eyebrow tone="light">The house of Majestic Roobee</Eyebrow>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px, 6.4vw, 84px)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)", color: "var(--mr-cream)", margin: "22px auto 0", maxWidth: "18ch" }}>Leave a trail, not just an impression.</h1>
          <GildedRule width="220px" style={{ margin: "18px auto" }} />
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(18px, 2vw, 22px)", color: "var(--text-on-dark-muted)", maxWidth: "52ch", margin: "0 auto 34px" }}>Perfume oils and extraits blended for presence that lingers — routed to you from the store nearest {cityName}.</p>
          <Button variant="gold" size="lg" onClick={() => ctx.nav("shop")}>Begin your trail</Button>
        </section>
      )}
      {dir === "product-led" && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 6vw, 72px) ${PAD}` }}>
          <div style={{ maxWidth: 640 }}>
            <Eyebrow>The Majestic edit — July</Eyebrow>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px, 4.6vw, 56px)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)", color: "var(--text-strong)", margin: "16px 0 12px" }}>This month's most-followed trails</h1>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text-body)", margin: "0 0 30px" }}>Three fragrances {cityName} keeps coming back for.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(250px, 100%), 1fr))", gap: 20 }}>
            {heroPicks.map((hp) => (
              <div key={hp.key} onClick={hp.open} style={{ cursor: "pointer", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                <ImageSlot src={hp.imageUrl} name={hp.name} style={{ width: "100%", height: 240 }} />
                <div style={{ padding: "16px 18px 20px" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text-strong)" }}>{hp.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>{hp.priceLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ maxWidth: 1280, margin: "0 auto", padding: `12px ${PAD} 8px` }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(230px, 100%), 1fr))", gap: 14 }}>
          {perk(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>,
            "Routed from your nearest store", "Orders ship from the location that has everything you chose."
          )}
          {perk(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
            "Secure payments", "Paystack, bank transfer, or order over WhatsApp."
          )}
          {perk(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>,
            "Worldwide shipping", "Naira and US Dollar pricing, delivered anywhere."
          )}
        </div>
      </section>

      <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(36px, 6vw, 64px) ${PAD} 0` }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <Eyebrow>In {cityName} now</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 3vw, 36px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "10px 0 0" }}>Ready at your store today</h2>
          </div>
          <a href="#shop" onClick={(e) => { e.preventDefault(); ctx.nav("shop"); }} style={{ fontSize: 13.5, fontWeight: 500 }}>View everything —</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
          {inCity.map((p) => <ProductCard key={p.key} p={p} />)}
        </div>
      </section>

      <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0` }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <Eyebrow>Shop by moment</Eyebrow>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 14 }}>
          {categories.map((c) => {
            const n = products.filter((p) => p.cat === c.id).length;
            return (
              <button key={c.id} className="mr-lift" onClick={() => ctx.nav("shop", { fCat: c.id })} style={{ cursor: "pointer", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "22px 14px", textAlign: "center", fontFamily: "var(--font-sans)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--mr-purple-900)" }}>{c.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5 }}>{n} {n === 1 ? "piece" : "pieces"}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ background: "var(--surface-inverse)", marginTop: "clamp(48px, 8vw, 88px)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: `clamp(48px, 7vw, 80px) ${PAD}`, textAlign: "center" }}>
          <GildedRule width="200px" style={{ margin: "18px auto" }} />
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(22px, 2.6vw, 30px)", fontWeight: 300, lineHeight: 1.5, color: "var(--mr-cream)", margin: "24px 0 18px" }}>
            "The full-day assassination package gave me everything I needed in a perfume — countless hugs and everyday compliments."
          </p>
          <div style={{ fontFamily: "var(--font-condensed)", fontSize: 12, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--text-on-dark-muted)" }}>Sally Benson — verified queen</div>
        </div>
      </section>
    </main>
  );
}

export function ShopPage({ ctx }) {
  const { listings, categories, collections, cityName } = ctx;
  const searching = !!ctx.search.trim();
  const collection = collections.find((c) => c.id === ctx.fCol) || null;
  // The grid iterates listing entries, not products: one entry per card. A
  // product with a picker is one entry carrying all its variations; a
  // split-listed product contributes one entry per variation.
  //
  // "On the shelf here" therefore means any variation the card can show is in
  // the city — which is the whole product for a picker card, and exactly one
  // variation for a split card.
  const inStockHere = (e) => e.variants.some((v) => (v.stock[ctx.city] || 0) > 0);
  const scopedOut = listings.filter((e) => !inStockHere(e)).length;
  // The shelf you can walk up to today is the default. A search always reaches
  // every store — someone looking for a specific scent wants to know it exists
  // in Lagos, not to be told it doesn't exist.
  let list = listings.filter((e) => {
    const p = e.product;
    if (ctx.fCat !== "all" && p.cat !== ctx.fCat) return false;
    if (collection && !collection.productIds.includes(p.id)) return false;
    if (ctx.search) {
      // Sizes and SKUs are searchable too, now that they are real identities.
      const hay = (p.name + " " + p.notes + " " + e.variants.map((v) => `${v.size} ${v.sku || ""}`).join(" ")).toLowerCase();
      if (!hay.includes(ctx.search.toLowerCase())) return false;
    }
    if (!searching && ctx.fScope === "city" && !inStockHere(e)) return false;
    return true;
  });
  // Sorting reads the cheapest variation on the card, so a card never sorts by
  // a price the shopper can't actually see on it.
  const priceOf = (e) => Math.min(...e.variants.map((v) => v.ngn));
  if (ctx.fSort === "low") list = list.slice().sort((a, b) => priceOf(a) - priceOf(b));
  else if (ctx.fSort === "high") list = list.slice().sort((a, b) => priceOf(b) - priceOf(a));
  else if (ctx.fSort === "name") list = list.slice().sort((a, b) => a.product.name.localeCompare(b.product.name));
  else list = list.slice().sort((a, b) => (inStockHere(b) ? 1 : 0) - (inStockHere(a) ? 1 : 0));
  const filtersDirty = ctx.fCat !== "all" || !!ctx.search || !!collection || ctx.fScope !== "city";
  const filterCats = [{ id: "all", label: "Everything" }].concat(categories);
  const selStyle = { fontFamily: "var(--font-sans)", fontSize: 13, padding: "9px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", background: "var(--surface-card)", color: "var(--text-strong)", outline: "none", cursor: "pointer" };
  const chip = (on, onClick, label, key) => (
    <button key={key} onClick={onClick} style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "8px 16px", borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : "var(--mr-purple-800)", transition: "all var(--dur-fast) var(--ease-standard)" }}>
      {label}
    </button>
  );
  // Curated sets lead the page — but only when the shopper is browsing, not
  // when they have already narrowed to a category, a set or a search.
  const showStrips = !searching && !collection && ctx.fCat === "all" && collections.length > 0;
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
                <Eyebrow>Collection</Eyebrow>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 2.6vw, 32px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "8px 0 4px" }}>{col.title}</h2>
                {col.desc && <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0, maxWidth: "60ch" }}>{col.desc}</p>}
              </div>
              {picks.length > 4 && (
                <button onClick={() => ctx.nav("shop", { fCol: col.id })} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, color: "var(--mr-orchid-600)" }}>
                  See all {picks.length} —
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
              {picks.slice(0, 4).map((e) => <ProductCard key={e.key} p={ctx.card(e)} />)}
            </div>
          </section>
        );
      })}

      <Eyebrow>{collection ? "Collection" : "The collection"}</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "12px 0 6px" }}>
        {collection ? collection.title : "All products"}
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
        {collection && collection.desc
          ? collection.desc
          : searching
            ? `Searching every store — pieces held in ${cityName} come first.`
            : ctx.fScope === "city"
              ? `On the shelf at our ${cityName} store today.`
              : `Everything the house carries — pieces held in ${cityName} come first.`}
      </p>
      {collection && (
        <button onClick={() => ctx.nav("shop", { fCol: null })} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-orchid-600)", fontWeight: 500, padding: 0, marginBottom: 18 }}>← Back to everything</button>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {filterCats.map((c) => chip(ctx.fCat === c.id, () => ctx.setFCat(c.id), c.label, c.id))}
      </div>
      {/* Shelf vs house. Hidden mid-search, where the scope is always the house. */}
      {!searching && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          {chip(ctx.fScope === "city", () => ctx.setFScope("city"), `In ${cityName} now`, "sc-city")}
          {chip(ctx.fScope === "all", () => ctx.setFScope("all"), "Every store", "sc-all")}
          {ctx.fScope === "city" && scopedOut > 0 && (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {scopedOut} more {scopedOut === 1 ? "piece ships" : "pieces ship"} from our other stores — search or switch to see {scopedOut === 1 ? "it" : "them"}.
            </span>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 28 }}>
        <select value={ctx.fSort} onChange={(e) => ctx.setFSort(e.target.value)} style={selStyle}>
          <option value="featured">Sort — {cityName} first</option>
          <option value="low">Price · low to high</option>
          <option value="high">Price · high to low</option>
          <option value="name">Name A–Z</option>
        </select>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{list.length} {list.length === 1 ? "piece" : "pieces"}</span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {list.reduce((n, e) => n + e.variants.length, 0)} sizes in total
        </span>
        {filtersDirty && (
          <button onClick={() => { ctx.setFCat("all"); ctx.setFCol(null); ctx.setFScope("city"); ctx.setSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-orchid-600)", fontWeight: 500 }}>Clear filters</button>
        )}
      </div>
      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 20px", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)" }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 19, color: "var(--text-body)", margin: "0 0 14px" }}>
            {searching ? `Nothing matches "${ctx.search}" in any of our stores.` : `Nothing on the ${cityName} shelf under this filter.`}
          </p>
          {!searching && ctx.fScope === "city" && scopedOut > 0 && (
            <Button variant="secondary" onClick={() => ctx.setFScope("all")}>Look in every store</Button>
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
  if (!pr || !variants.length) return <ShopPage ctx={ctx} />;

  // The selected variation: whatever the shopper picked, else the SKU the URL
  // asked for, else the first one on the shelf in their city.
  const prV = variants.find((v) => v.id === ctx.prVariantId)
    || (ctx.prSku && variants.find((v) => v.sku === ctx.prSku))
    || ctx.defaultVariant(variants);
  const prA = ctx.variantAvail(prV);
  const { cityName, L } = ctx;
  const soldOut = prA.soldOut;
  const optionName = (pr.optionNames && pr.optionNames[0]) || "Size";

  // The gallery for this variation: its own shots first, then the shots shared
  // across the product, so switching size changes the picture where there is a
  // picture to change to and holds steady where there isn't.
  const gallery = (() => {
    const shots = pr.images || [];
    const own = shots.filter((im) => im.variantId === prV.id);
    const shared = shots.filter((im) => !im.variantId);
    const urls = [...own, ...shared].map((im) => ({ url: im.url, alt: im.alt }));
    if (!urls.length && (prV.imageUrl || pr.imageUrl)) urls.push({ url: prV.imageUrl || pr.imageUrl, alt: pr.name });
    return urls;
  })();
  const hero = gallery[Math.min(shot, Math.max(0, gallery.length - 1))];

  const selectVariant = (v) => {
    setShot(0);
    ctx.setPrVariantId(v.id);
    ctx.setPrSku(v.sku);
    // Keep the URL on the chosen variation so it can be shared and indexed.
    window.history.replaceState({}, "", `/product/${encodeURIComponent(pr.id)}${v.sku ? `?variant=${encodeURIComponent(v.sku)}` : ""}`);
  };

  // Only products that still have something to sell — `card` reads the default
  // variation's price and photo, so an empty one has nothing to render.
  const related = ctx.products
    .filter((p) => p.id !== pr.id && p.cat === pr.cat && p.variants && p.variants.length)
    .slice(0, 3)
    .map(ctx.card)
    .filter(Boolean);
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: `clamp(24px, 4vw, 44px) ${PAD}` }}>
      <button onClick={() => ctx.nav("shop")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-purple-700)", padding: 0, marginBottom: 22 }}>← Back to the collection</button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(400px, 100%), 1fr))", gap: "clamp(28px, 5vw, 56px)", alignItems: "start" }}>
        <div style={{ position: "relative" }}>
          <ImageSlot src={hero && hero.url} shape="rounded" radius={16} name={pr.name}
            label={`${pr.name} ${prV.size} — product photo`} style={{ width: "100%", height: 520 }} />
          {gallery.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {gallery.map((im, i) => (
                <button key={im.url + i} onClick={() => setShot(i)} aria-label={`View photo ${i + 1}`}
                  style={{ padding: 0, width: 64, height: 64, borderRadius: "var(--radius-md)", overflow: "hidden", cursor: "pointer", background: "none", border: `1px solid ${i === shot ? "var(--mr-purple-900)" : "var(--border-hairline)"}` }}>
                  <img src={im.url} alt={im.alt || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Eyebrow>{ctx.catLabel(pr.cat)}</Eyebrow>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 42px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "12px 0 6px" }}>{pr.name}</h1>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill={ctx.custData.wishlist.includes(pr.id) ? "var(--mr-orchid-500)" : "none"} stroke={ctx.custData.wishlist.includes(pr.id) ? "var(--mr-orchid-500)" : "var(--mr-purple-800)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
              {ctx.custData.wishlist.includes(pr.id) ? "Saved" : "Save"}
            </button>
          </div>
          <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "18px 20px", marginBottom: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-strong)", marginBottom: 10 }}>AVAILABILITY BY STORE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ctx.locations.map((l) => {
                const n = prV.stock[l.id] || 0;
                return (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                    <span style={{ color: "var(--text-body)" }}>{l.store}, {l.city}</span>
                    <span style={{ fontWeight: 500, color: n > 5 ? "#3f6b45" : n > 0 ? "var(--accent-gold-ink)" : "var(--text-muted)" }}>
                      {n > 5 ? "In stock" : n > 0 ? "Only " + n + " left" : "Out of stock"}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: "1px solid var(--border-hairline)", marginTop: 12, paddingTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
              {prA.inCity
                ? `Delivery in ${cityName}: ${L ? L.eta : ""} · Click & collect today at ${L ? L.store : ""}`
                : prA.soldOut
                ? "Join the waitlist — we'll notify you the moment it returns."
                : `Delivery to ${cityName}: 3–5 days (${prA.note})`}
            </div>
          </div>
        </div>
      </div>
      <section style={{ marginTop: "clamp(40px, 6vw, 64px)" }}>
        <Eyebrow>You may also follow</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20, marginTop: 18 }}>
          {related.map((p) => (
            <div key={p.key} style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <div onClick={p.open} style={{ cursor: "pointer" }}>
                <ImageSlot src={p.imageUrl} name={p.name} style={{ width: "100%", height: 200 }} />
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

export function AboutPage({ ctx }) {
  return (
    <main>
      <section style={{ background: "var(--royal-wash)", textAlign: "center", padding: `clamp(52px, 8vw, 96px) ${PAD}` }}>
        <Eyebrow tone="light">Our house</Eyebrow>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 5vw, 60px)", color: "var(--mr-cream)", letterSpacing: "var(--ls-display)", margin: "18px auto 0", maxWidth: "20ch" }}>A ruby you carry. A mark you leave.</h1>
      </section>
      <section style={{ maxWidth: 860, margin: "0 auto", padding: `clamp(40px, 6vw, 64px) ${PAD}` }}>
        <p style={{ fontFamily: "var(--font-editorial)", fontSize: 17, lineHeight: "var(--lh-relaxed)", margin: "0 0 18px" }}>Majestic Roobee began in Abuja with a simple conviction — that fragrance is not decoration, it is legacy. Every extrait, mist and moment in our house is blended to leave a trail: the pause when you enter a room, the question after you leave it.</p>
        <p style={{ fontFamily: "var(--font-editorial)", fontSize: 17, lineHeight: "var(--lh-relaxed)", margin: "0 0 18px" }}>Today we serve kings and queens from three stores — Abuja, Lagos and Ibadan — and ship worldwide. Every order is routed to the store nearest you that holds everything you chose, hand-wrapped, and sent with a note.</p>
        <GildedRule style={{ margin: "34px 0" }} />
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
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: `0 ${PAD} clamp(48px, 7vw, 72px)`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 16 }}>
        <ImageSlot shape="rounded" radius={14} name="The Atelier" label="The atelier — blending table" style={{ width: "100%", height: 300 }} />
        <ImageSlot shape="rounded" radius={14} name="Abuja Store" label="Abuja store interior" style={{ width: "100%", height: 300 }} />
      </section>
    </main>
  );
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
// when it turns up, and in how many pieces.
function arrivalLine(ctx) {
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
              <ImageSlot src={it.imageUrl} name={it.name} shape="rounded" radius={8} style={{ width: 46, height: 46 }} />
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
          onKeyDown={(e) => e.key === "Enter" && ctx.applyPromo()} placeholder="Promo code" aria-label="Promo code"
          style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 13, padding: "10px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", textTransform: "uppercase", color: "var(--text-strong)", background: "var(--surface-card)" }} />
        <Button variant="secondary" size="sm" onClick={ctx.applyPromo}>Apply</Button>
      </div>
      {ctx.promoMsg && (
        <div style={{ fontSize: 12.5, marginTop: -8, display: "flex", gap: 8, color: ctx.promoInfo ? "var(--accent-gold-ink)" : "#c0587a" }}>
          <span style={{ flex: 1 }}>{ctx.promoMsg}</span>
          {ctx.promoInfo && <button onClick={ctx.clearPromo} aria-label="Remove promo code" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 14, lineHeight: 1 }}>✕</button>}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13.5, borderTop: "1px solid var(--border-hairline)", paddingTop: 15 }}>
        {row("Subtotal", ctx.fmt(cc.sub))}
        {cc.discount > 0 && row(ctx.promoInfo ? ctx.promoInfo.code : "Promo", "−" + ctx.fmt(cc.discount), "var(--accent-gold-ink)")}
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

  const payDefs = [
    { id: "paystack", label: "Card, transfer or USSD", note: "Pay securely with Paystack" },
    { id: "transfer", label: "Bank transfer", note: "Held for 2 hours" },
    { id: "whatsapp", label: "WhatsApp", note: "Finish with us in chat" },
  ];

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
            : <>We'll send you the account details shortly. Your order is held for 2 hours.</>}
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
      <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)", marginBottom: 4 }}>Save this order</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>Track it faster and keep your address for next time.</div>
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
      <Eyebrow>At your service</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", color: "var(--text-strong)", margin: "12px 0 28px" }}>Speak with the house</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 24, alignItems: "start" }}>
        <div style={{ ...card, padding: 26 }}>
          {ctx.contactSent ? (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--mr-purple-900)", marginBottom: 8 }}>Received — quietly.</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>We reply within a few hours, {cf.name.split(" ")[0] || "friend"}. Watch your inbox.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Input label="Your name" value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} placeholder="Adaeze Okafor" />
              <Input label="Email" value={cf.email} onChange={(e) => setCf({ ...cf, email: e.target.value })} placeholder="you@email.com" />
              <Textarea label="How can we help?" value={cf.msg} onChange={(e) => setCf({ ...cf, msg: e.target.value })} rows={4} placeholder="An order, a gift, a fragrance question…" />
              <Button variant="primary" onClick={ctx.sendContact}>Send message</Button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-strong)" }}>Live chat</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 10px" }}>Real people, usually within minutes — {settings.contactHours}.</div>
              <Button variant="secondary" size="sm" onClick={() => ctx.setChat((s) => ({ ...s, open: true }))}>Start a chat</Button>
            </div>
          </div>
          <div style={{ ...card, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-strong)" }}>WhatsApp &amp; phone</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{settings.contactPhone} — orders, gifting, wholesale.</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{settings.contactEmail}</div>
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

export function PrivacyPage({ ctx }) {
  const { settings } = ctx;
  const h = { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-strong)", margin: "28px 0 8px" };
  const p = { fontFamily: "var(--font-editorial)", fontSize: 15.5, lineHeight: "var(--lh-relaxed)", color: "var(--text-body)", margin: "0 0 12px" };
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: `clamp(32px, 5vw, 56px) ${PAD}` }}>
      <Eyebrow>The house keeps confidence</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", color: "var(--text-strong)", margin: "12px 0 6px" }}>Privacy &amp; cookies</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 8px" }}>Last updated July 2026</p>
      <GildedRule style={{ margin: "18px 0 4px" }} />

      <p style={p}>Majestic Roobee ("we") respects your privacy. This notice explains what we collect, why, and the choices you have. You can shop as a guest without creating an account.</p>

      <h2 style={h}>What we collect</h2>
      <p style={p}>To fulfil an order we collect your name, phone, email and delivery address, plus the items and amounts in your order. If you contact us or start a live chat, we keep that conversation so we can help. If you join our list, we keep your email until you unsubscribe.</p>

      <h2 style={h}>Payments</h2>
      <p style={p}>Card payments are processed by our payment provider (Paystack). We never see or store your full card details — payment is confirmed to us by the provider.</p>

      <h2 style={h}>Cookies &amp; analytics</h2>
      <p style={p}>We use cookies for two things: essential store function (your cart, your chosen city) and — only if you accept — analytics and marketing tools that help us understand and improve the experience. You can decline the optional cookies from the banner and still shop normally. Optional tools we may use include Google Analytics, Google Ads, Meta Pixel, TikTok Pixel and Microsoft Clarity.</p>

      <h2 style={h}>How we use your information</h2>
      <p style={p}>To process and deliver orders, provide support, prevent fraud, and — where you've opted in — send you offers and updates. We do not sell your personal information.</p>

      <h2 style={h}>Your choices</h2>
      <p style={p}>You can decline optional cookies, unsubscribe from marketing at any time, and ask us to access or delete the information we hold about you.</p>

      <h2 style={h}>Contact</h2>
      <p style={p}>Questions about your privacy? Reach us at {settings.contactEmail || "hello@majesticroobee.com"} or {settings.contactPhone || "+234 906 227 7470"}.</p>
    </main>
  );
}
