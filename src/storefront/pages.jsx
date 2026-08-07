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
  const [selId, setSelId] = useState(p.defaultVariantId);
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
  const inCity = products.filter((p) => ctx.availInfo(p).inCity).slice(0, 4).map(ctx.card);
  // Three picks from whatever is live, city stock first — never named ids, which
  // would break the moment the catalogue changes.
  const heroPicks = products
    .slice().sort((a, b) => (ctx.availInfo(b).inCity ? 1 : 0) - (ctx.availInfo(a).inCity ? 1 : 0))
    .slice(0, 3).map(ctx.card);
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
  const { listings, categories, cityName } = ctx;
  // The grid iterates listing entries, not products: one entry per card. A
  // product with a picker is one entry; a split-listed product contributes one
  // entry per variation, so its variations really are separate cards.
  let list = listings.filter((e) => {
    const p = e.product;
    if (ctx.fCat !== "all" && p.cat !== ctx.fCat) return false;
    if (ctx.search) {
      const hay = (p.name + " " + p.notes + " " + e.variants.map((v) => `${v.size} ${v.sku || ""}`).join(" ")).toLowerCase();
      if (!hay.includes(ctx.search.toLowerCase())) return false;
    }
    return true;
  });
  // Sorting reads the cheapest variation on the card, so a card never sorts by
  // a price the shopper can't actually see on it.
  const priceOf = (e) => Math.min(...e.variants.map((v) => v.ngn));
  const inCity = (e) => (e.variants.some((v) => (v.stock[ctx.city] || 0) > 0) ? 1 : 0);
  if (ctx.fSort === "low") list = list.slice().sort((a, b) => priceOf(a) - priceOf(b));
  else if (ctx.fSort === "high") list = list.slice().sort((a, b) => priceOf(b) - priceOf(a));
  else if (ctx.fSort === "name") list = list.slice().sort((a, b) => a.product.name.localeCompare(b.product.name));
  else list = list.slice().sort((a, b) => inCity(b) - inCity(a));
  const filtersDirty = ctx.fCat !== "all" || !!ctx.search;
  const filterCats = [{ id: "all", label: "Everything" }].concat(categories);
  const selStyle = { fontFamily: "var(--font-sans)", fontSize: 13, padding: "9px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", background: "var(--surface-card)", color: "var(--text-strong)", outline: "none", cursor: "pointer" };
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(28px, 4vw, 48px) ${PAD}` }}>
      <Eyebrow>The collection</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "12px 0 6px" }}>All products</h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>Showing availability for {cityName} — pieces at your store come first.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {filterCats.map((c) => {
          const on = ctx.fCat === c.id;
          return (
            <button key={c.id} onClick={() => ctx.setFCat(c.id)} style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "8px 16px", borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : "var(--mr-purple-800)", transition: "all var(--dur-fast) var(--ease-standard)" }}>
              {c.label}
            </button>
          );
        })}
      </div>
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
          <button onClick={() => { ctx.setFCat("all"); ctx.setFFam("all"); ctx.setSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-orchid-600)", fontWeight: 500 }}>Clear filters</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
        {list.map((e) => <ProductCard key={e.key} p={ctx.card(e)} />)}
      </div>
    </main>
  );
}

export function ProductPage({ ctx }) {
  const pr = ctx.products.find((p) => p.id === ctx.productId);
  const [shot, setShot] = useState(0);
  if (!pr) return <ShopPage ctx={ctx} />;

  // The selected variation: whatever the shopper picked, else the SKU the URL
  // asked for, else the first one on the shelf in their city.
  const prV = pr.variants.find((v) => v.id === ctx.prVariantId)
    || (ctx.prSku && pr.variants.find((v) => v.sku === ctx.prSku))
    || ctx.defaultVariant(pr.variants);
  const prA = ctx.variantAvail(prV);
  const { cityName, L } = ctx;
  const soldOut = prA.soldOut;
  const optionName = (pr.optionNames && pr.optionNames[0]) || "Size";

  // The gallery for this variation: its own shots first, then the shots shared
  // across the product, so switching size changes the picture where there is a
  // picture to change to and holds steady where there isn't.
  const gallery = (() => {
    const own = pr.images.filter((im) => im.variantId === prV.id);
    const shared = pr.images.filter((im) => !im.variantId);
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

  const related = ctx.products.filter((p) => p.id !== pr.id && p.cat === pr.cat).slice(0, 3).map(ctx.card);
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
            {pr.variants.map((v) => {
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

export function CheckoutPage({ ctx }) {
  const { cc, co, setCo, cityName, L, settings } = ctx;
  const radioStyle = (on) => ({
    bd: on ? "var(--mr-purple-600)" : "var(--border-hairline)",
    bg: on ? "var(--mr-lavender-200)" : "var(--surface-card)",
    dot: on ? "var(--mr-purple-800)" : "var(--mr-lavender-300)",
  });
  const payDefs = [
    { id: "paystack", label: "Pay with card — Paystack", note: "Cards, USSD & bank — confirmed instantly" },
    { id: "transfer", label: "Bank transfer", note: "We hold your order 2 hours while you transfer" },
    { id: "whatsapp", label: "Order via WhatsApp", note: "A concierge completes your order in chat" },
  ];
  const routingNote = !cc.items.length ? "" : cc.allInCity
    ? `Everything is in stock at ${L ? L.store : ""}, ${cityName} — one shipment, ${L ? L.eta : ""}.`
    : `Some pieces aren't in ${cityName} right now — we'll route your order from the nearest store that holds everything (3–5 days).`;
  const radioBtn = (on, onClick, title, note) => {
    const st = radioStyle(on);
    return (
      <button onClick={onClick} style={{ cursor: "pointer", textAlign: "left", fontFamily: "var(--font-sans)", display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", borderRadius: "var(--radius-md)", border: `1px solid ${st.bd}`, background: st.bg }}>
        <span style={{ width: 16, height: 16, borderRadius: "50%", border: `5px solid ${st.dot}`, background: "var(--surface-card)", flexShrink: 0, marginTop: 2 }} />
        <span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{title}</span><br />
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{note}</span>
        </span>
      </button>
    );
  };
  const sectionCard = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: 24 };
  const sectionTitle = { fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-strong)", marginBottom: 16 };
  const shipEtaNote = cc.allInCity
    ? (L ? L.eta : "") + " · " + ctx.fmt(L ? L.shipNGN : 2500) + (ctx.city === "abuja" ? ` (free over ${ctx.fmt(settings.freeShipAbujaOver ?? 100000)})` : "")
    : `3–5 days · ${ctx.fmt(settings.crossCityShipNGN ?? 4500)} (routed shipment)`;
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: `clamp(28px, 4vw, 48px) ${PAD}` }}>
      <Eyebrow>Almost yours</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 40px)", color: "var(--text-strong)", margin: "12px 0 28px" }}>Checkout</h1>
      {cc.items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)" }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text-body)", margin: "0 0 18px" }}>Your cart is quietly empty.</p>
          <Button variant="primary" onClick={() => ctx.nav("shop")}>Browse the collection</Button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 28, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={sectionCard}>
              <div style={sectionTitle}>1 · YOUR DETAILS <span style={{ fontWeight: 400, color: "var(--text-muted)", letterSpacing: 0 }}>— guest checkout, no account needed</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 14 }}>
                <Input label="Full name" value={co.name} onChange={(e) => setCo({ ...co, name: e.target.value })} placeholder="Adaeze Okafor" />
                <Input label="Phone" value={co.phone} onChange={(e) => setCo({ ...co, phone: e.target.value })} placeholder="0803 000 0000" />
                <Input label="Email" value={co.email} onChange={(e) => setCo({ ...co, email: e.target.value })} placeholder="you@email.com" hint="Order updates & receipt land here" />
              </div>
            </div>
            <div style={sectionCard}>
              <div style={sectionTitle}>2 · FULFILMENT</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {radioBtn(co.fulfill === "delivery", () => setCo({ ...co, fulfill: "delivery" }), `Delivery to ${cityName}`, shipEtaNote)}
                {radioBtn(co.fulfill === "collect", () => setCo({ ...co, fulfill: "collect" }), `Click & collect — ${L ? L.store : "your store"}`, `Free — ready in 3 hours when everything is in stock at ${L ? L.store : "your store"}`)}
              </div>
              {co.fulfill === "delivery" && (
                <div style={{ marginTop: 14 }}>
                  <Input label="Delivery address" value={co.address} onChange={(e) => setCo({ ...co, address: e.target.value })} placeholder="House, street, area" />
                </div>
              )}
            </div>
            <div style={sectionCard}>
              <div style={sectionTitle}>3 · PAYMENT</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {payDefs.map((p) => radioBtn(co.pay === p.id, () => setCo({ ...co, pay: p.id }), p.label, p.note))}
              </div>
            </div>
          </div>
          <div style={{ ...sectionCard, position: "sticky", top: 84 }}>
            <div style={sectionTitle}>ORDER SUMMARY</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              {cc.items.map((it) => (
                <div key={it.key} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: "var(--mr-lavender-200)", color: "var(--mr-purple-800)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 15, flexShrink: 0 }}>{it.initials}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-strong)" }}>{it.name} <span style={{ color: "var(--text-muted)" }}>{it.size} × {it.qty}</span></span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mr-purple-900)" }}>{it.lineLabel}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--mr-lavender-200)", borderRadius: "var(--radius-md)", padding: "12px 14px", fontSize: 12.5, lineHeight: 1.55, color: "var(--mr-purple-800)", marginBottom: 16, display: "flex", gap: 10 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              <span>{routingNote}</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input value={co.promo} onChange={(e) => setCo({ ...co, promo: e.target.value.toUpperCase() })} placeholder="Promo code" style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13, padding: "10px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", textTransform: "uppercase", color: "var(--text-strong)", background: "var(--surface-card)" }} />
              <Button variant="secondary" size="sm" onClick={ctx.applyPromo}>Apply</Button>
            </div>
            {ctx.promoMsg && (
              <div style={{ fontSize: 12.5, margin: "-8px 0 12px", color: ctx.promoInfo ? "var(--accent-gold-ink)" : "#c0587a" }}>{ctx.promoMsg}</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5, borderTop: "1px solid var(--border-hairline)", paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span style={{ fontWeight: 500, color: "var(--text-strong)" }}>{ctx.fmt(cc.sub)}</span></div>
              {cc.discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--accent-gold-ink)" }}>
                  <span>Promo — {ctx.promoInfo && ctx.promoInfo.code}</span><span>−{ctx.fmt(cc.discount)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{co.fulfill === "collect" ? "Click & collect" : "Delivery"}</span>
                <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>{cc.ship === 0 ? "Free" : ctx.fmt(cc.ship)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 600, color: "var(--mr-purple-900)", borderTop: "1px solid var(--border-hairline)", paddingTop: 10, marginTop: 4 }}>
                <span>Total</span><span>{ctx.fmt(cc.total)}</span>
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <Button variant="gold" size="lg" block disabled={ctx.placing} onClick={ctx.placeOrder}>
                {ctx.placing ? "Placing…" : co.pay === "whatsapp" ? "Continue on WhatsApp" : "Place order — " + ctx.fmt(cc.total)}
              </Button>
            </div>
            {ctx.coErr && <div style={{ fontSize: 12.5, color: "#c0587a", marginTop: 10, textAlign: "center" }}>{ctx.coErr}</div>}
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", textAlign: "center", marginTop: 12 }}>Payment is confirmed server-side before your order is recorded as paid.</div>
          </div>
        </div>
      )}
    </main>
  );
}

export function ConfirmPage({ ctx }) {
  const p = ctx.placed;
  if (!p) return <HomePage ctx={ctx} />;
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: `clamp(40px, 6vw, 72px) ${PAD}`, textAlign: "center" }}>
      <GildedRule width="180px" style={{ margin: "18px auto" }} />
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 42px)", color: "var(--text-strong)", margin: "22px 0 10px" }}>Your trail is on its way.</h1>
      <p style={{ fontFamily: "var(--font-serif)", fontSize: 19, color: "var(--text-body)", margin: "0 0 26px" }}>
        Order <strong style={{ color: "var(--mr-purple-900)" }}>{p.no}</strong>{p.totalLabel ? ` — ${p.totalLabel}` : ""} · {p.pay}
      </p>
      {p.pay === "Bank transfer" && (
        <div style={{ background: "var(--mr-gold-200)", borderRadius: "var(--radius-md)", padding: "14px 18px", fontSize: 13, color: "var(--mr-gold-600)", marginBottom: 18, textAlign: "left" }}>
          We're holding your order for 2 hours. Transfer to <strong>Majestic Roobee — 0123456789 (Providus Bank)</strong> with <strong>{p.no}</strong> as reference, and we'll confirm by SMS.
        </div>
      )}
      {p.paid === false && p.pay === "Paystack" && (
        <div style={{ background: "var(--mr-sand)", borderRadius: "var(--radius-md)", padding: "14px 18px", fontSize: 13, color: "var(--mr-gold-600)", marginBottom: 18 }}>
          Payment hasn't been confirmed yet — if you completed it, it will reflect shortly.
        </div>
      )}
      {(p.route || p.eta) && (
        <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: 24, textAlign: "left", marginBottom: 24 }}>
          <div style={{ fontFamily: "var(--font-condensed)", fontSize: 12, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)", marginBottom: 10 }}>Fulfilment</div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-body)" }}>{p.route}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>{p.eta}</div>
        </div>
      )}
      {!ctx.cust && ctx.co.email && <AccountNudge ctx={ctx} />}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Button variant="primary" onClick={() => { ctx.setTrack((t) => ({ ...t, no: p.no, contact: ctx.co.email || ctx.co.phone, err: "" })); ctx.nav("track"); }}>Track this order</Button>
        <Button variant="ghost" onClick={() => ctx.nav("shop")}>Keep browsing</Button>
      </div>
    </main>
  );
}

// Progressive nudge shown on the confirmation page for guests — turns the order
// they just placed into a saved account with one tap (email already known).
function AccountNudge({ ctx }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const create = async () => {
    if (pw.length < 8) return setErr("Choose a password of at least 8 characters.");
    setBusy(true); setErr("");
    try {
      await ctx.custRegister({ email: ctx.co.email, password: pw, name: ctx.co.name, phone: ctx.co.phone, city: ctx.city, marketingOptIn: true });
      setDone(true);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  if (done) return (
    <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-lg)", padding: "18px 22px", marginBottom: 24, fontSize: 14, color: "var(--mr-purple-900)" }}>
      Account created — this order is now saved to <strong>{ctx.co.email}</strong>. Welcome to the house. 💜
    </div>
  );
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "20px 22px", marginBottom: 24, textAlign: "left" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-strong)", marginBottom: 4 }}>Save this order — create an account</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>Track faster next time, save your address, build a wishlist and earn perks. We'll use <strong>{ctx.co.email}</strong>.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Input label="Choose a password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} style={{ flex: 1, minWidth: 200 }} />
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
      <Eyebrow>Follow the trail</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 42px)", color: "var(--text-strong)", margin: "12px 0 8px" }}>Track your order</h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
        No account needed — your order number and the phone or email you ordered with. <span style={{ color: "var(--mr-purple-700)" }}>Try MR-10234.</span>
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 14, alignItems: "end", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: 22 }}>
        <Input label="Order number" value={track.no} onChange={(e) => setTrack((t) => ({ ...t, no: e.target.value }))} placeholder="MR-10234" />
        <Input label="Phone or email" value={track.contact} onChange={(e) => setTrack((t) => ({ ...t, contact: e.target.value }))} placeholder="0803 000 0000" />
        <Button variant="primary" onClick={ctx.doTrack}>Find my order</Button>
      </div>
      {track.err && <div style={{ fontSize: 13, color: "#c0587a", marginTop: 14 }}>{track.err}</div>}
      {o && (
        <div style={{ marginTop: 28, background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: 26 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 4 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text-strong)" }}>{o.no}</div>
            <Badge tone="gold">{o.status}</Badge>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 22 }}>Placed {o.placed} · {ctx.fmt(o.total)} · Fulfilled by {o.from}</div>
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
