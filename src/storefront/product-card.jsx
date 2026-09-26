// The product card — the one component every grid on the storefront is built
// from (shop, wishlist, deals, a collection strip, related products). It lives
// on its own because five pages need it and none of them should have to import
// the whole page module to get it.
import React, { useState } from "react";
import { Button, ImageSlot } from "../ds/components.jsx";

function AvailBadge({ p }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: "var(--radius-pill)", background: p.badgeBg, color: p.badgeFg, boxShadow: p.outline ? "inset 0 0 0 1px var(--border-strong)" : "none" }}>
      {p.avail}
    </span>
  );
}

export function WishHeart({ wished, onClick, size = 32 }) {
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
          <ImageSlot src={v.imageUrl} name={p.name} sizes="(max-width: 640px) 92vw, (max-width: 1100px) 45vw, 300px" style={{ width: "100%", height }} />
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

