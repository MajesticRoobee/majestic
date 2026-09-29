// Majestic Roobee design system — ported from the handoff bundle.
import React from "react";
import { srcSetFor } from "../lib/images.js";

export function Eyebrow({ children, tick = true, tone = "gold", style = {}, ...rest }) {
  const color = tone === "gold" ? "var(--accent-gold-ink)" : tone === "light" ? "var(--text-on-dark-muted)" : "var(--mr-purple-600)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "var(--font-condensed)", fontSize: "var(--fs-eyebrow)", letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", fontWeight: 600, color, ...style }} {...rest}>
      {tick && <span style={{ width: 22, height: 1, background: "currentColor", opacity: 0.7 }} />}
      {children}
    </span>
  );
}

export function GildedRule({ diamond = true, width = "100%", style = {}, ...rest }) {
  const line = { flex: 1, height: 1, background: "var(--gold-line)" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, width, ...style }} {...rest}>
      <span style={line} />
      {diamond && <span style={{ color: "var(--mr-gold-500)", fontSize: 10, lineHeight: 1, transform: "rotate(45deg)" }}>◆</span>}
      <span style={line} />
    </div>
  );
}

export function Badge({ children, tone = "neutral", dot = false, style = {}, ...rest }) {
  const tones = {
    neutral: { background: "var(--surface-sunken)", color: "var(--mr-purple-800)" },
    orchid: { background: "var(--mr-orchid-500)", color: "#fff" },
    gold: { background: "var(--accent-gold)", color: "var(--mr-purple-950)" },
    success: { background: "#e4efe4", color: "#3f6b45" },
    outline: { background: "transparent", color: "var(--text-body)", boxShadow: "inset 0 0 0 1px var(--border-hairline)" },
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: dot ? "3px 10px 3px 8px" : "3px 10px", borderRadius: "var(--radius-pill)", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, letterSpacing: "0.01em", lineHeight: 1.4, ...tones[tone], ...style }} {...rest}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", opacity: 0.85 }} />}
      {children}
    </span>
  );
}

export function Button({ children, variant = "primary", size = "md", block = false, disabled = false, iconLeft = null, iconRight = null, style = {}, ...rest }) {
  const sizes = {
    sm: { padding: "8px 16px", fontSize: 13 },
    md: { padding: "12px 24px", fontSize: 14 },
    lg: { padding: "16px 34px", fontSize: 15 },
  };
  const base = {
    display: block ? "flex" : "inline-flex",
    width: block ? "100%" : undefined,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    fontFamily: "var(--font-sans)",
    fontWeight: 500,
    letterSpacing: "0.02em",
    lineHeight: 1,
    borderRadius: "var(--radius-pill)",
    border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-base) var(--ease-glide), transform var(--dur-fast) var(--ease-standard)",
    ...sizes[size],
  };
  const variants = {
    primary: { background: "var(--brand-primary)", color: "var(--mr-cream)", boxShadow: "var(--shadow-sm)" },
    secondary: { background: "transparent", color: "var(--mr-purple-800)", borderColor: "var(--border-strong)" },
    ghost: { background: "transparent", color: "var(--mr-purple-700)" },
    gold: { background: "var(--accent-gold)", color: "var(--mr-purple-950)", boxShadow: "var(--shadow-gold)" },
  };
  const hoverFor = {
    primary: (e, on) => (e.currentTarget.style.background = on ? "var(--brand-primary-hover)" : "var(--brand-primary)"),
    secondary: (e, on) => {
      e.currentTarget.style.background = on ? "var(--surface-sunken)" : "transparent";
      e.currentTarget.style.borderColor = on ? "var(--mr-purple-600)" : "var(--border-strong)";
    },
    ghost: (e, on) => (e.currentTarget.style.color = on ? "var(--mr-orchid-500)" : "var(--mr-purple-700)"),
    gold: (e, on) => (e.currentTarget.style.background = on ? "var(--mr-gold-400)" : "var(--accent-gold)"),
  };
  return (
    <button
      type="button"
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={(e) => !disabled && hoverFor[variant]?.(e, true)}
      onMouseLeave={(e) => !disabled && hoverFor[variant]?.(e, false)}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(0.98)")}
      onMouseUp={(e) => !disabled && (e.currentTarget.style.transform = "scale(1)")}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}

const labelStyle = { fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)", letterSpacing: "0.02em" };
const hintStyle = (error) => ({ fontFamily: "var(--font-sans)", fontSize: 12, color: error ? "#c0587a" : "var(--text-muted)" });
const fieldStyle = (focus, error) => ({
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  color: "var(--text-strong)",
  background: "var(--surface-card)",
  border: `1px solid ${error ? "#c0587a" : focus ? "var(--mr-orchid-500)" : "var(--border-hairline)"}`,
  borderRadius: "var(--radius-md)",
  padding: "11px 14px",
  outline: "none",
  boxShadow: focus ? "0 0 0 3px var(--focus-ring)" : "none",
  transition: "border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard)",
  // Fill the field's box and never force it wider: two fields side by side on a
  // phone must be able to share 360px.
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
});

export function Input({ label, hint, error, id, style = {}, ...rest }) {
  const fieldId = id || (label ? `mr-in-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, ...style }}>
      {label && <label htmlFor={fieldId} style={labelStyle}>{label}</label>}
      <input id={fieldId} onFocus={() => setFocus(true)} onBlur={(e) => { setFocus(false); rest.onBlur && rest.onBlur(e); }} {...rest} style={fieldStyle(focus, error)} />
      {(hint || error) && <span style={hintStyle(error)}>{error || hint}</span>}
    </div>
  );
}

export function Textarea({ label, hint, error, id, rows = 4, style = {}, ...rest }) {
  const fieldId = id || (label ? `mr-ta-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, ...style }}>
      {label && <label htmlFor={fieldId} style={labelStyle}>{label}</label>}
      <textarea id={fieldId} rows={rows} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} {...rest} style={{ ...fieldStyle(focus, error), lineHeight: 1.6, resize: "vertical" }} />
      {(hint || error) && <span style={hintStyle(error)}>{error || hint}</span>}
    </div>
  );
}

export function Select({ label, hint, id, children, style = {}, ...rest }) {
  const fieldId = id || (label ? `mr-sel-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, ...style }}>
      {label && <label htmlFor={fieldId} style={labelStyle}>{label}</label>}
      <div style={{ position: "relative", display: "flex" }}>
        <select id={fieldId} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} {...rest} style={{ ...fieldStyle(focus), appearance: "none", width: "100%", padding: "11px 40px 11px 14px", cursor: "pointer" }}>
          {children}
        </select>
        <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--mr-purple-600)", fontSize: 12 }}>▾</span>
      </div>
      {hint && <span style={hintStyle(false)}>{hint}</span>}
    </div>
  );
}

export function Switch({ label, checked, onChange, disabled = false, style = {}, ...rest }) {
  const on = !!checked;
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, ...style }}>
      <input type="checkbox" role="switch" checked={on} disabled={disabled} onChange={onChange} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} {...rest} />
      <span aria-hidden="true" style={{ width: 44, height: 26, borderRadius: "var(--radius-pill)", background: on ? "var(--brand-primary)" : "var(--mr-lavender-400)", padding: 3, display: "inline-flex", alignItems: "center", transition: "background var(--dur-base) var(--ease-glide)", flex: "none" }}>
        <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "var(--shadow-xs)", transform: on ? "translateX(18px)" : "translateX(0)", transition: "transform var(--dur-base) var(--ease-glide)" }} />
      </span>
      {label && <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--text-body)" }}>{label}</span>}
    </label>
  );
}

// Product imagery slot — shows the product photo when one exists, otherwise a
// branded placeholder (heather wash + display-font monogram).
export function ImageSlot({ src, name = "", label, shape = "rect", radius = 0, sizes, eager = false, monoSize = 44, style = {} }) {
  const r = shape === "rounded" ? radius || 14 : 0;
  if (src) {
    // Every product photo on the storefront comes through here, so this is the
    // one place that has to know about responsive widths. `srcSetFor` returns
    // "" for a pasted external URL, which leaves that image exactly as it was.
    return (
      <img
        src={src}
        srcSet={srcSetFor(src) || undefined}
        // Without this the browser assumes the image fills the viewport and
        // picks the largest copy, undoing the whole exercise. Callers laying
        // out a grid pass their own; a full-width block is the safe default.
        sizes={srcSetFor(src) ? sizes || "100vw" : undefined}
        alt={name || label || ""}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        style={{ display: "block", objectFit: "cover", borderRadius: r, ...style }}
      />
    );
  }
  const initials = (name || label || "MR").split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ background: "var(--heather-wash)", borderRadius: r, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, overflow: "hidden", ...style }}>
      <span style={{ fontFamily: "var(--font-display)", fontSize: monoSize, color: "var(--mr-purple-500)", opacity: 0.8 }}>{initials}</span>
      {label && (
        <span style={{ fontFamily: "var(--font-condensed)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--mr-lavender-600)", padding: "0 18px", textAlign: "center" }}>{label}</span>
      )}
    </div>
  );
}

// A quiet line for a table or panel that has nothing in it yet. Tables here are
// CSS grids, so this spans every column rather than sitting in one cell.
export function EmptyRow({ children, span = 1, pad = "26px 22px" }) {
  return (
    <div style={{ gridColumn: `span ${span}`, padding: pad, borderTop: "1px solid var(--border-hairline)", fontSize: 12.5, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

// A running deal, as the shopper meets it: badge, title, and the one line that
// sells it.
//
// That line used to be 12.5px muted grey on white — the quietest text on the
// Deals page, on the one element whose whole job is to be noticed. It is now
// cream on the house's deepest purple, set bold and larger, with the badge and
// the end date in gold. Contrast is roughly 13:1 for the message against 4:1
// before. Shared by the storefront and the admin's live preview, so what the
// house sees while typing is exactly what goes up.
export function DealCard({ deal, meta, style = {} }) {
  const d = deal || {};
  return (
    <div style={{ background: "linear-gradient(135deg, var(--mr-purple-950), var(--mr-purple-800))", color: "var(--mr-cream)", borderRadius: "var(--radius-lg)", padding: "18px 20px 16px", boxShadow: "var(--shadow-md)", border: "1px solid rgba(214,178,106,0.45)", ...style }}>
      {d.badge && (
        <span style={{ display: "inline-block", fontFamily: "var(--font-condensed)", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", padding: "4px 11px", borderRadius: "var(--radius-pill)", background: "var(--accent-gold)", color: "var(--mr-purple-950)" }}>{d.badge}</span>
      )}
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1.2, color: "#fff", marginTop: 12 }}>{d.title || "Your deal's title"}</div>
      {d.desc && (
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: "var(--mr-cream)", marginTop: 8 }}>{d.desc}</div>
      )}
      {meta && (
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", color: "var(--mr-gold-400)", marginTop: 10 }}>{meta}</div>
      )}
    </div>
  );
}
