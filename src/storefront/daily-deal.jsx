// The daily-deal card: one product, one price, and a clock running down beside
// it, in the corner the redesign reserves for it at the top of the home page.
//
// Everything on the card comes from the server (`/api/store` → dailyDeal),
// which is also where the price came from before it reached the shop grid and
// the cart — so the number under the countdown is the number that gets charged.
// The browser's only job here is the second hand.
import React, { useEffect, useState } from "react";
import { Button, ImageSlot } from "../ds/components.jsx";

const pad = (n) => String(n).padStart(2, "0");

// Days, hours, minutes, seconds left — days unpadded because "6" reads better
// than "06" at the head of a countdown, the rest padded so the row stops
// jittering as the digits change.
function units(msLeft) {
  const left = Math.max(0, msLeft);
  return [
    { label: "Day", n: String(Math.floor(left / 86400000)) },
    { label: "Hour", n: pad(Math.floor(left / 3600000) % 24) },
    { label: "Min", n: pad(Math.floor(left / 60000) % 60) },
    { label: "Sec", n: pad(Math.floor(left / 1000) % 60) },
  ];
}

// The deal and its clock, shared by the desktop card and the phone's compact
// one. Returns null once the window has closed (and asks for the catalogue
// again, so the next deal in the queue takes over).
export function useDealClock(ctx) {
  const deal = ctx.dailyDeal;
  const [left, setLeft] = useState(() => (deal ? deal.endsAtMs - Date.now() : 0));

  useEffect(() => {
    if (!deal) return undefined;
    setLeft(deal.endsAtMs - Date.now());
    const t = setInterval(() => setLeft(deal.endsAtMs - Date.now()), 1000);
    return () => clearInterval(t);
  }, [deal]);

  // The moment the window closes the card is showing a price the server has
  // already stopped honouring, so it asks for the catalogue again rather than
  // sitting on it — the next deal in the queue takes over in the same breath.
  useEffect(() => {
    if (!deal || left > 0) return undefined;
    const t = setTimeout(() => ctx.refreshStore(), 1200);
    return () => clearTimeout(t);
  }, [deal, left > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return deal && left > 0 ? { deal, left, units: units(left) } : null;
}

export function DailyDealCard({ ctx, style = {} }) {
  const clock = useDealClock(ctx);
  if (!clock) return null;
  const { deal, left } = clock;

  const product = ctx.products.find((p) => p.id === deal.productId);
  const variant = product ? (product.variants || []).find((v) => v.id === deal.variantId) : null;
  const openProduct = () => ctx.nav("product", { productId: deal.productId, prSku: deal.sku, prVariantId: deal.variantId });

  return (
    <aside style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", padding: 18, display: "flex", flexDirection: "column", gap: 12, ...style }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 21, color: "var(--text-strong)", textAlign: "center" }}>{deal.headline}</div>
      <div style={{ position: "relative", cursor: "pointer" }} onClick={openProduct}>
        <ImageSlot src={deal.imageUrl} name={deal.productName} sizes="300px" style={{ width: "100%", height: 210 }} />
        {deal.off > 0 && (
          <span style={{ position: "absolute", top: 8, left: 8, background: "var(--mr-purple-900)", color: "var(--mr-cream)", fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: "var(--radius-xs)", whiteSpace: "nowrap" }}>{deal.off}% OFF</span>
        )}
      </div>
      <a href={"/product/" + deal.productId} onClick={(e) => { e.preventDefault(); openProduct(); }}
        style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, color: "var(--text-strong)", lineHeight: 1.45 }}>
        {deal.productName}{deal.size ? ` · ${deal.size}` : ""}
      </a>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: "var(--mr-purple-900)" }}>{ctx.fmt(deal.priceNgn)}</span>
        {deal.compareAtNgn && <span style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "line-through" }}>{ctx.fmt(deal.compareAtNgn)}</span>}
      </div>
      <Button variant="primary" size="md" block disabled={!variant} onClick={() => variant && ctx.addToCart(deal.productId, variant, 1)}>
        {variant ? "Add to cart" : "View product"}
      </Button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, paddingTop: 4 }}>
        {units(left).map((u) => (
          <div key={u.label} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--mr-purple-900)" }}>{u.n}</div>
            <div style={{ fontFamily: "var(--font-condensed)", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>{u.label}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
