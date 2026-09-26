// The phone's building blocks, from "Majestic Roobee Mobile.dc.html": the
// product card every rail and grid is made of, the rail itself, the sheet that
// every menu, filter and picker slides up in, and the bar that pins a page's
// one action to the bottom of the screen.
//
// Everything here draws what it is handed. Prices, availability and what a
// button does come from `ctx.card()` in App.jsx, exactly as the desktop grid's
// do, so a phone and a laptop never disagree about what a bottle costs or
// whether it is on the shelf.
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { ImageSlot } from "../ds/components.jsx";

// ---- Icons ----------------------------------------------------------------

const svg = (size, sw, children, extra = {}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{children}</svg>
);
export const I = {
  menu: (s = 22) => svg(s, 1.5, <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>),
  back: (s = 22) => svg(s, 1.6, <path d="m15 18-6-6 6-6" />),
  search: (s = 21) => svg(s, 1.5, <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>),
  user: (s = 21) => svg(s, 1.5, <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>),
  pin: (s = 14) => svg(s, 1.6, <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>),
  chevDown: (s = 12, sw = 2) => svg(s, sw, <path d="m6 9 6 6 6-6" />),
  chevRight: (s = 16, sw = 1.8) => svg(s, sw, <path d="m9 18 6-6-6-6" />),
  cal: (s = 13) => svg(s, 1.8, <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>),
  close: (s = 18, sw = 1.8) => svg(s, sw, <path d="M18 6 6 18M6 6l12 12" />),
  home: (s = 22) => svg(s, 1.5, <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />),
  grid: (s = 22) => svg(s, 1.5, <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  tag: (s = 22) => svg(s, 1.5, <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>),
  heart: (s = 22, fill = "none") => svg(s, 1.6, <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />, { fill }),
  bag: (s = 22) => svg(s, 1.5, <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></>),
  chat: (s = 22) => svg(s, 1.6, <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />),
  truck: (s = 18) => svg(s, 1.5, <><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>),
  lock: (s = 18, sw = 1.5) => svg(s, sw, <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  gift: (s = 18) => svg(s, 1.5, <><rect x="3" y="8" width="18" height="13" rx="1" /><path d="M12 8v13M3 12h18M12 8S10 3 7.5 3a2.5 2.5 0 0 0 0 5M12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" /></>),
  store: (s = 20) => svg(s, 1.5, <path d="M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6" />),
  filter: (s = 16) => svg(s, 1.6, <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>),
  sort: (s = 16) => svg(s, 1.6, <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />),
  share: (s = 18) => svg(s, 1.6, <path d="M12 3v13M7 8l5-5 5 5M5 14v6h14v-6" />),
  check: (s = 18, sw = 2) => svg(s, sw, <path d="M20 6 9 17l-5-5" />),
};

// ---- Type -----------------------------------------------------------------

export const eyebrowM = { fontFamily: "var(--font-condensed)", fontSize: 10.5, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--accent-gold-ink)" };
export const h2M = { fontFamily: "var(--font-display)", fontSize: 21, lineHeight: 1.2, color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: 0, textWrap: "pretty" };
export const linkBtn = { flex: "none", background: "none", border: "none", padding: "8px 0", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--mr-purple-700)", cursor: "pointer" };
// 16px on every field: anything smaller and iOS zooms the page on focus.
export const fieldM = { height: 48, boxSizing: "border-box", width: "100%", fontFamily: "var(--font-sans)", fontSize: 16, padding: "0 14px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", background: "var(--surface-card)", color: "var(--text-strong)", outline: "none" };

/** Eyebrow, heading and a "see all" on the right — the head of every rail. */
export function HeadM({ eyebrow, title, action, onAction, pad = "0 16px 12px" }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, padding: pad }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div style={eyebrowM}>{eyebrow}</div>}
        {title && <h2 style={{ ...h2M, marginTop: eyebrow ? 4 : 0 }}>{title}</h2>}
      </div>
      {action && onAction && <button onClick={onAction} style={linkBtn}>{action}</button>}
    </div>
  );
}

// ---- Buttons --------------------------------------------------------------

const BTN = {
  primary: { background: "var(--mr-purple-900)", color: "var(--mr-cream)", border: "1px solid var(--mr-purple-900)" },
  secondary: { background: "transparent", color: "var(--mr-purple-800)", border: "1px solid var(--border-strong)" },
  gold: { background: "var(--accent-gold)", color: "var(--mr-purple-950)", border: "1px solid var(--accent-gold)" },
};
/** The design system's pill button at the phone's heights: sm 32, md 40, lg 48. */
export function BtnM({ variant = "primary", size = "md", block = false, disabled = false, style = {}, children, ...rest }) {
  const h = size === "sm" ? 32 : size === "lg" ? 48 : 40;
  return (
    <button type="button" disabled={disabled} {...rest}
      style={{
        ...BTN[variant], height: h, width: block ? "100%" : undefined, padding: `0 ${size === "sm" ? 14 : 20}px`,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, flex: block ? undefined : "none",
        borderRadius: "var(--radius-pill)", fontFamily: "var(--font-sans)", fontSize: size === "lg" ? 15 : size === "sm" ? 13 : 14,
        fontWeight: 500, letterSpacing: "0.02em", whiteSpace: "nowrap", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, boxShadow: variant === "gold" ? "var(--shadow-gold)" : variant === "primary" ? "var(--shadow-sm)" : "none",
        ...style,
      }}>
      {children}
    </button>
  );
}

/** Selected / not selected, the one chip style every filter and size uses. */
export function chipTone(on) {
  return {
    background: on ? "var(--mr-purple-900)" : "var(--surface-card)",
    color: on ? "var(--mr-cream)" : "var(--mr-purple-800)",
    border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`,
  };
}

/** A radio dot, as the sort, city and payment lists draw it. */
export function Radio({ on }) {
  return (
    <span style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${on ? "var(--mr-purple-900)" : "var(--border-strong)"}`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: on ? "var(--mr-purple-900)" : "transparent" }} />
    </span>
  );
}

/** − n + at a thumb's size. */
export function Stepper({ value, onDec, onInc, h = 44, w = 44 }) {
  const b = { width: w, height: h, background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--mr-purple-800)", fontFamily: "var(--font-sans)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)", background: "var(--surface-card)" }}>
      <button onClick={onDec} aria-label="Less" style={b}>−</button>
      <span style={{ minWidth: 22, textAlign: "center", fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>{value}</span>
      <button onClick={onInc} aria-label="More" style={b}>+</button>
    </span>
  );
}

/** The free-delivery line and bar, on the cart and the "added" sheet. */
export function FreeShipBar({ ctx }) {
  const f = ctx.cc.freeShip;
  if (!f || !ctx.cc.items.length) return null;
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: f.remaining ? "var(--text-body)" : "#3f6b45", paddingBottom: 8 }}>
        {f.remaining ? `Add ${ctx.fmt(f.remaining)} more for free delivery` : "Free delivery unlocked"}
      </div>
      <div style={{ height: 6, borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", overflow: "hidden" }}>
        <div style={{ width: `${f.pct}%`, height: "100%", background: f.remaining ? "var(--mr-gold-500)" : "#8fd694", transition: "width 300ms" }} />
      </div>
    </div>
  );
}

// ---- The product card -----------------------------------------------------

/**
 * One product, as a phone shows it: a square photo with its badge and heart,
 * the name, the size, the price, one line of availability and one button.
 *
 * `p` is `ctx.card(entry)`. The button adds the default size in one tap when
 * there is only one to add; with several it opens the size sheet rather than
 * choosing for the shopper; sold out, it offers the waitlist.
 */
export function MobileProductCard({ p }) {
  if (!p) return null;
  const v = p.variants.find((x) => x.id === p.defaultVariantId) || p.variants[0];
  const badge = p.offPct > 0
    ? { text: `${p.offPct}% OFF`, bg: "var(--mr-purple-900)", fg: "var(--mr-cream)" }
    : p.isNew ? { text: "New", bg: "var(--accent-gold)", fg: "var(--mr-purple-950)" } : null;
  const label = p.chooseSize ? "Choose size" : v.addLabel;
  const act = p.chooseSize || v.add;
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", overflow: "hidden", display: "flex", flexDirection: "column", height: "100%", boxShadow: "var(--shadow-xs)", fontFamily: "var(--font-sans)", minWidth: 0 }}>
      <div style={{ position: "relative", aspectRatio: "1 / 1", background: "var(--mr-lavender-200)" }}>
        <a href={p.href} onClick={(e) => { e.preventDefault(); v.open(); }} aria-label={p.name} style={{ position: "absolute", inset: 0 }}>
          <ImageSlot src={v.imageUrl} name={p.name} sizes="(max-width: 480px) 46vw, 220px" style={{ width: "100%", height: "100%" }} />
        </a>
        {badge && (
          <span style={{ position: "absolute", top: 8, left: 8, background: badge.bg, color: badge.fg, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.03em", padding: "3px 7px", borderRadius: "var(--radius-xs)", pointerEvents: "none" }}>{badge.text}</span>
        )}
        {p.toggleWish && (
          <button onClick={(e) => { e.stopPropagation(); p.toggleWish(); }} aria-label={p.wished ? "Remove from wishlist" : "Save to wishlist"} aria-pressed={p.wished}
            style={{ position: "absolute", top: 6, right: 6, width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.94)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-sm)", cursor: "pointer", padding: 0, color: p.wished ? "var(--mr-orchid-500)" : "var(--mr-purple-800)" }}>
            {I.heart(17, p.wished ? "var(--mr-orchid-500)" : "none")}
          </button>
        )}
      </div>
      <div style={{ padding: "10px 11px 12px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <a href={p.href} onClick={(e) => { e.preventDefault(); v.open(); }} className="mr-clamp2"
          style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.25, color: "var(--text-strong)", minHeight: 37 }}>
          {p.name}
        </a>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.sizeLabel}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 14.5, color: "var(--mr-purple-900)" }}>{p.rangeLabel || v.priceLabel}</span>
          {!p.rangeLabel && v.compareAtLabel && <span style={{ fontSize: 11.5, color: "var(--text-muted)", textDecoration: "line-through" }}>{v.compareAtLabel}</span>}
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.35, color: v.availColor }}>{v.availLine}</div>
        <div style={{ marginTop: "auto", paddingTop: 6 }}>
          <BtnM variant="secondary" block onClick={act}>{label}</BtnM>
        </div>
      </div>
    </div>
  );
}

/**
 * The gutter after the last item in a sideways row. A scrolling flex row
 * drops its own right padding in Chrome, so the last card or chip would stop
 * flush against the screen's edge without this.
 */
export const RailEnd = () => <span aria-hidden="true" style={{ flex: "none", width: 6 }} />;

/** A sideways-scrolling row of cards that snaps to each one. */
export function Rail({ children, width = 158, gap = 10, pad = "0 16px 4px", bleed = false }) {
  return (
    <div className="mr-rail" style={{ display: "flex", gap, overflowX: "auto", padding: pad, scrollSnapType: "x mandatory", scrollPaddingLeft: 16, ...(bleed ? { margin: "0 -16px" } : null) }}>
      {React.Children.map(children, (c) => c && (
        <div style={{ flex: "none", width, scrollSnapAlign: "start" }}>{c}</div>
      ))}
      <RailEnd />
    </div>
  );
}

/** Two columns of cards — the listing, the wishlist. Four on a tablet. */
export function CardGrid({ cards }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 45%), 1fr))", gap: 10, padding: "12px 12px 0" }}>
      {cards.map((p) => p && <MobileProductCard key={p.key} p={p} />)}
    </div>
  );
}

// ---- Sheets ---------------------------------------------------------------

// Only one sheet is ever up, but a sheet can mount while the last one is still
// unmounting, so the lock is a count rather than a flag.
let locks = 0;
function useScrollLock() {
  useEffect(() => {
    locks += 1;
    document.documentElement.style.overflow = "hidden";
    return () => {
      locks -= 1;
      if (!locks) document.documentElement.style.overflow = "";
    };
  }, []);
}

/**
 * A panel over the page: up from the bottom (`bottom`), in from the left
 * (`left`, the menu) or the whole screen (`full`, search). Closes on the
 * backdrop, on Escape, and on the ✕ when it has a title.
 */
export function Sheet({ onClose, side = "bottom", title, children, footer, z = 190, bg = "var(--mr-cream)", pad = "0 20px", label }) {
  useScrollLock();
  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const veil = <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(36,20,48,0.5)" }} />;
  if (side === "full") {
    return (
      <div role="dialog" aria-modal="true" aria-label={label || title} style={{ position: "fixed", inset: 0, zIndex: z, background: bg, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    );
  }
  if (side === "left") {
    return (
      <div role="dialog" aria-modal="true" aria-label={label || title} style={{ position: "fixed", inset: 0, zIndex: z, display: "flex" }}>
        {veil}
        <div className="mr-sheet-left" style={{ position: "relative", width: "min(88%, 380px)", height: "100%", background: bg, boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={label || title} style={{ position: "fixed", inset: 0, zIndex: z, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      {veil}
      <div className="mr-sheet-up" style={{ position: "relative", background: bg, borderRadius: "20px 20px 0 0", maxHeight: "90%", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border-strong)", margin: "8px auto 0", flex: "none" }} />
        {title && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 8px 4px 20px", flex: "none" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-strong)" }}>{title}</span>
            <button onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, background: "none", border: "none", cursor: "pointer", color: "var(--mr-purple-900)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>{I.close(18)}</button>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: pad, paddingBottom: footer ? 12 : "calc(26px + env(safe-area-inset-bottom))" }}>
          {children}
        </div>
        {footer && (
          <div style={{ flex: "none", display: "flex", gap: 10, padding: "12px 20px calc(16px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--border-hairline)", background: "var(--surface-card)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- The action bar -------------------------------------------------------

/**
 * A page's one action, pinned to the bottom of the screen above the tab bar —
 * "Add to cart" on a product, "Checkout" on the cart, "Pay" at checkout.
 *
 * Its height is published as --mr-bar-h so the page can leave room for it and
 * the chat button and toasts can sit above it, whatever it ends up holding (an
 * error line at checkout makes it taller).
 */
export function ActionBar({ children, style = {} }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--mr-bar-h", `${el.offsetHeight}px`);
    set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); root.style.setProperty("--mr-bar-h", "0px"); };
  }, []);
  return (
    <div ref={ref} style={{ position: "fixed", left: 0, right: 0, bottom: "var(--mr-tabs-h, 0px)", zIndex: 120, background: "var(--surface-card)", borderTop: "1px solid var(--border-hairline)", boxShadow: "0 -8px 24px -16px rgba(61,35,80,0.3)", padding: "10px 16px", paddingBottom: "calc(10px + var(--mr-bar-safe, 0px))", ...style }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
