// Storefront chrome: announcement bar, city gate, header, cart drawer,
// concierge chat, lead popup, footer. Markup ported from the design handoff.
import React, { useState } from "react";
import { Eyebrow, Button } from "../ds/components.jsx";
import { routeToPath } from "./router.js";

// Profile menu — sign in / create account when logged out, the customer's name
// and account actions when logged in, and always the gateway to the staff portal.
function ProfileMenu({ ctx }) {
  const [open, setOpen] = useState(false);
  const cust = ctx.cust;
  const firstName = cust ? (cust.name || cust.email).trim().split(" ")[0] : "";
  const initial = cust ? (cust.name || cust.email || "?").trim().charAt(0).toUpperCase() : "";
  const item = (label, onClick, color) => (
    <button onClick={() => { setOpen(false); onClick(); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, color: color || "var(--mr-purple-800)", padding: "9px 12px", borderRadius: "var(--radius-sm)" }}>{label}</button>
  );
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} title={cust ? cust.name : "Sign in"} aria-label="Account" style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", gap: 8 }}>
        {cust ? (
          <>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--mr-purple-900)", color: "var(--mr-cream)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 13 }}>{initial}</span>
            {!ctx.isMobile && <span style={{ fontSize: 13, fontWeight: 500, color: "var(--mr-purple-900)" }}>{firstName}</span>}
          </>
        ) : (
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--mr-purple-900)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        )}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 170 }} />
          <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 224, background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", zIndex: 171, padding: 8 }}>
            {cust ? (
              <>
                <div style={{ padding: "8px 12px 10px", fontSize: 12.5, color: "var(--text-muted)" }}>Signed in as<br /><strong style={{ color: "var(--text-strong)", fontSize: 13.5 }}>{cust.name || cust.email}</strong></div>
                {item("My account & orders", () => ctx.nav("account"))}
                {item("Sign out", () => ctx.custLogout(), "var(--mr-orchid-600)")}
              </>
            ) : (
              <>
                <div style={{ padding: "8px 12px 6px", fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)" }}>Your account</div>
                {item("Sign in", () => ctx.nav("account"))}
                {item("Create account", () => ctx.nav("account"))}
              </>
            )}
            <div style={{ borderTop: "1px solid var(--border-hairline)", margin: "6px 4px" }} />
            <a href="/admin/" style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--text-muted)", padding: "9px 12px" }}>Staff portal →</a>
          </div>
        </>
      )}
    </div>
  );
}

const CITY_OPTIONS = [
  ["abuja", "Abuja"],
  ["lagos", "Lagos"],
  ["ibadan", "Ibadan"],
];

function CitySelect({ ctx, style }) {
  return (
    <select
      value={ctx.city}
      onChange={(e) => ctx.setCityConfirmed(e.target.value)}
      title="Your city"
      style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "7px 8px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", background: "var(--surface-card)", color: "var(--mr-purple-800)", cursor: "pointer", outline: "none", ...style }}
    >
      {CITY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function PromoPopup({ ctx }) {
  if (!ctx.popup) return null;
  const content = ctx.D && ctx.D.popup ? ctx.D.popup : null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,20,48,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={ctx.closePopup}>
      <div style={{ background: "var(--surface-card)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", maxWidth: 440, width: "100%", padding: "40px 36px", textAlign: "center", position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={ctx.closePopup} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-muted)" }}>✕</button>
        <Eyebrow>Your trail begins here</Eyebrow>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "14px 0 8px" }}>{content ? content.title : "10% off your first order"}</h2>
        <p style={{ fontSize: 14, lineHeight: "var(--lh-body)", margin: "0 0 20px" }}>{content ? content.message : "Leave your email — we'll send the code, and only what's worth reading."}</p>
        {ctx.plDone ? (
          <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", padding: 16 }}>
            <div style={{ fontFamily: "var(--font-condensed)", letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", fontSize: 12, color: "var(--accent-gold-ink)" }}>Your code</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--mr-purple-900)", marginTop: 4 }}>FIRSTTRAIL</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Saved — quietly. It's in your inbox too.</div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <input value={ctx.plEmail} onChange={(e) => ctx.setPlEmail(e.target.value)} placeholder="you@email.com" style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 14, padding: "12px 14px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", color: "var(--text-strong)", background: "var(--surface-card)" }} />
            <Button variant="gold" onClick={ctx.submitLead}>Claim it</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CityGate({ ctx }) {
  if (!ctx.gateOpen) return null;
  return (
    <div style={{ background: "var(--mr-lavender-200)", borderBottom: "1px solid var(--border-hairline)", padding: "12px 20px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "center" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mr-purple-700)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
      <span style={{ fontSize: 13, color: "var(--mr-purple-800)" }}>Shopping from <strong style={{ fontWeight: 600 }}>{ctx.cityName}</strong>? We've arranged your nearest store first.</span>
      <Button variant="primary" size="sm" onClick={() => ctx.setCityConfirmed(ctx.city)}>That's right</Button>
      <CitySelect ctx={ctx} style={{ fontSize: 13, padding: "7px 10px", border: "1px solid var(--border-strong)" }} />
    </div>
  );
}

function Header({ ctx }) {
  const navLink = (label, page, extra) => (
    <a href={routeToPath(page, extra)} onClick={(e) => { e.preventDefault(); ctx.nav(page, extra); }}>{label}</a>
  );
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250,246,241,0.9)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--border-hairline)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(16px, 4vw, 40px)", display: "flex", alignItems: "center", gap: 18, height: 66 }}>
        {ctx.isMobile && (
          <button onClick={() => ctx.setMnav(!ctx.mnav)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex" }} aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--mr-purple-900)" strokeWidth="1.5" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
          </button>
        )}
        <a href="/" onClick={(e) => { e.preventDefault(); ctx.nav("home"); }} style={{ fontFamily: "var(--font-display)", fontSize: 21, color: "var(--mr-purple-900)", letterSpacing: "0.01em", whiteSpace: "nowrap" }}>Majestic Roobee</a>
        {!ctx.isMobile && (
          <>
            <nav style={{ display: "flex", gap: 26, marginLeft: 18, fontSize: 13.5, fontWeight: 500, letterSpacing: "0.03em" }}>
              {navLink("Shop", "shop")}
              {navLink("Our House", "about")}
              {navLink("Track Order", "track")}
              {navLink("Contact", "contact")}
            </nav>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", padding: "7px 14px", background: "var(--surface-card)", minWidth: 180 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--mr-mute)" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
              <input value={ctx.search} onChange={(e) => ctx.setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ctx.nav("shop")} placeholder="Search fragrances" style={{ border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--text-strong)", width: "100%" }} />
            </div>
            <button onClick={ctx.toggleCurrency} title="Switch currency" style={{ background: "none", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", padding: "7px 13px", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, color: "var(--mr-purple-800)", cursor: "pointer" }}>
              {ctx.currency === "NGN" ? "₦ NGN" : "$ USD"}
            </button>
            <CitySelect ctx={ctx} />
          </>
        )}
        {ctx.isMobile && <div style={{ flex: 1 }} />}
        <ProfileMenu ctx={ctx} />
        <button onClick={() => ctx.setCartOpen(true)} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex" }} aria-label="Cart">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--mr-purple-900)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
          {ctx.cc.items.length > 0 && (
            <span style={{ position: "absolute", top: -2, right: -4, background: "var(--accent-gold)", color: "var(--mr-purple-950)", fontSize: 10.5, fontWeight: 600, minWidth: 17, height: 17, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
              {ctx.cart.reduce((n, c) => n + c.qty, 0)}
            </span>
          )}
        </button>
      </div>
      {ctx.mnav && ctx.isMobile && (
        <nav style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--border-hairline)", background: "var(--mr-cream)", padding: "8px 0" }}>
          {[["Home", "home"], ["Shop", "shop"], ["Our House", "about"], ["Track Order", "track"], ["Contact", "contact"]].map(([label, page]) => (
            <a key={page} href={routeToPath(page)} onClick={(e) => { e.preventDefault(); ctx.nav(page); }} style={{ padding: "13px 24px", fontSize: 15, fontWeight: 500 }}>{label}</a>
          ))}
          <div style={{ display: "flex", gap: 10, padding: "12px 24px", alignItems: "center" }}>
            <button onClick={ctx.toggleCurrency} style={{ background: "none", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", padding: "8px 14px", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-purple-800)", cursor: "pointer" }}>
              {ctx.currency === "NGN" ? "₦ NGN" : "$ USD"}
            </button>
            <CitySelect ctx={ctx} style={{ fontSize: 13, padding: "8px 10px" }} />
          </div>
        </nav>
      )}
    </header>
  );
}

function CartDrawer({ ctx }) {
  if (!ctx.cartOpen) return null;
  const { cc } = ctx;
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(36,20,48,0.45)", zIndex: 150 }} onClick={() => ctx.setCartOpen(false)} />
      <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(420px, 100vw)", background: "var(--surface-card)", zIndex: 151, boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border-hairline)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-strong)" }}>
            Your cart <span style={{ fontSize: 14, color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>({ctx.cart.reduce((n, c) => n + c.qty, 0)})</span>
          </div>
          <button onClick={() => ctx.setCartOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 17, color: "var(--text-muted)" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          {cc.items.length === 0 && (
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--text-muted)", textAlign: "center", marginTop: 40 }}>Quietly empty — for now.</p>
          )}
          {cc.items.map((it) => (
            <div key={it.key} style={{ display: "flex", gap: 14 }}>
              <span style={{ width: 58, height: 58, borderRadius: "var(--radius-md)", background: "var(--mr-lavender-200)", color: "var(--mr-purple-800)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 18, flexShrink: 0 }}>{it.initials}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{it.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 8px" }}>{it.size} · {it.availNote}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)" }}>
                    <button onClick={it.dec} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 10px", fontSize: 14, color: "var(--mr-purple-800)" }}>−</button>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", minWidth: 16, textAlign: "center" }}>{it.qty}</span>
                    <button onClick={it.inc} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 10px", fontSize: 14, color: "var(--mr-purple-800)" }}>+</button>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--mr-purple-900)" }}>{it.lineLabel}</span>
                  <button onClick={it.remove} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", marginLeft: "auto", textDecoration: "underline" }}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "20px 24px", borderTop: "1px solid var(--border-hairline)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 600, color: "var(--text-strong)", marginBottom: 6 }}>
            <span>Subtotal</span><span>{ctx.fmt(cc.sub)}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
            Shipping calculated at checkout — routed from {cc.allInCity ? (ctx.L ? ctx.L.store : "") : "the nearest stocked store"}.
          </div>
          <Button variant="gold" size="lg" block disabled={cc.items.length === 0} onClick={() => ctx.nav("checkout")}>Checkout</Button>
        </div>
      </aside>
    </>
  );
}

function ChatWidget({ ctx }) {
  const { chat, setChat } = ctx;
  return (
    <>
      {chat.open && (
        <div style={{ position: "fixed", bottom: 92, right: 20, width: "min(340px, calc(100vw - 40px))", height: 430, background: "var(--surface-card)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border-hairline)", zIndex: 160, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ background: "var(--mr-purple-900)", color: "var(--mr-cream)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8fd694" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Majestic Roobee concierge</div>
              <div style={{ fontSize: 11, color: "var(--text-on-dark-muted)" }}>Usually replies in minutes</div>
            </div>
            <button onClick={() => setChat((s) => ({ ...s, open: false }))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-on-dark-muted)", fontSize: 15 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {chat.msgs.map((m, i) => (
              <div key={i} style={{ maxWidth: "82%", padding: "9px 13px", borderRadius: 14, fontSize: 13, lineHeight: 1.5, alignSelf: m.from === "us" ? "flex-start" : "flex-end", background: m.from === "us" ? "var(--mr-lavender-200)" : "var(--mr-purple-900)", color: m.from === "us" ? "var(--mr-purple-900)" : "var(--mr-cream)" }}>{m.text}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border-hairline)" }}>
            <input value={chat.val} onChange={(e) => setChat((s) => ({ ...s, val: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && ctx.sendChat()} placeholder="Write a message…" style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13, padding: "10px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", outline: "none", color: "var(--text-strong)", background: "var(--surface-card)" }} />
            <button onClick={ctx.sendChat} style={{ background: "var(--mr-purple-900)", color: "var(--mr-cream)", border: "none", borderRadius: "50%", width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setChat((s) => ({ ...s, open: !s.open }))} style={{ position: "fixed", bottom: 20, right: 20, width: 56, height: 56, borderRadius: "50%", background: "var(--mr-purple-900)", border: "none", cursor: "pointer", boxShadow: "var(--shadow-md)", zIndex: 159, display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Live chat">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mr-gold-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>
      </button>
    </>
  );
}

function Footer({ ctx }) {
  const { settings } = ctx;
  const link = (label, page, extra) => (
    <a href={routeToPath(page, extra)} onClick={(e) => { e.preventDefault(); ctx.nav(page, extra); }} style={{ color: "var(--text-on-dark-muted)" }}>{label}</a>
  );
  const colTitle = { fontFamily: "var(--font-condensed)", fontSize: 12, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--mr-gold-400)", marginBottom: 14 };
  return (
    <footer style={{ background: "var(--mr-purple-950)", color: "var(--text-on-dark-muted)", marginTop: "clamp(48px, 8vw, 88px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px, 6vw, 64px) clamp(16px, 4vw, 40px) 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 32 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--mr-cream)", marginBottom: 12 }}>Majestic Roobee</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: "34ch", margin: 0 }}>{settings.footerTagline}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <a href={settings.igUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" title={settings.igHandle} style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid var(--border-inverse)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mr-gold-400)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
            </a>
          </div>
        </div>
        <div>
          <div style={colTitle}>Shop</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
            {link("All products", "shop", { fCat: "all" })}
            {link("Gift & fragrance sets", "shop", { fCat: "fragrance-set" })}
            {link("Feminine care", "shop", { fCat: "care" })}
          </div>
        </div>
        <div>
          <div style={colTitle}>The house</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
            {link("Our story", "about")}
            {link("Track an order", "track")}
            {link("Contact & support", "contact")}
          </div>
        </div>
        <div>
          <div style={colTitle}>Stores</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
            {ctx.locations.map((l) => <span key={l.id}>{l.city} — {l.store.replace(" Store", "")}</span>)}
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border-inverse)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "18px clamp(16px, 4vw, 40px)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
          <span>© 2026 Majestic Roobee — all rights reserved</span>
          <span style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <a href="/privacy" onClick={(e) => { e.preventDefault(); ctx.nav("privacy"); }} style={{ color: "var(--text-on-dark-muted)" }}>Privacy &amp; cookies</a>
            <a href="/admin/" style={{ color: "var(--text-on-dark-muted)" }}>Staff portal —</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

// A slim, non-blocking bottom bar (no backdrop — the whole store stays usable
// while it's open). Welcomes every shopper and nudges them to start shopping.
function ConsentBanner({ ctx }) {
  if (!ctx.showConsent) return null;
  return (
    <div style={{ position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 180, maxWidth: 720, margin: "0 auto", background: "var(--mr-purple-950)", color: "var(--text-on-dark-muted)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", padding: "14px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, lineHeight: 1.5, flex: 1, minWidth: 220 }}>
        Welcome to Majestic Roobee — browse freely, the store works with or without cookies. We use them for analytics &amp; marketing to improve your experience.
        {" "}<a href="/privacy" onClick={(e) => { e.preventDefault(); ctx.nav("privacy"); }} style={{ color: "var(--mr-gold-400)" }}>Privacy</a>
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="gold" size="sm" onClick={() => { ctx.grantConsent(); ctx.nav("shop"); }}>Start shopping</Button>
        <button onClick={ctx.denyConsent} style={{ background: "none", border: "1px solid var(--border-inverse)", borderRadius: "var(--radius-pill)", padding: "8px 16px", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--text-on-dark-muted)", cursor: "pointer" }}>Decline cookies</button>
        <button onClick={ctx.grantConsent} style={{ background: "none", border: "none", padding: "8px 10px", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-gold-400)", cursor: "pointer" }}>Accept</button>
      </div>
    </div>
  );
}

export function Chrome({ ctx, children }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-body)", background: "var(--mr-cream)", minHeight: "100vh" }}>
      <PromoPopup ctx={ctx} />
      <ConsentBanner ctx={ctx} />
      <div style={{ background: "var(--mr-purple-950)", color: "var(--text-on-dark-muted)", fontSize: 12, letterSpacing: "0.06em", textAlign: "center", padding: "9px 16px" }}>
        {ctx.settings.announcement || " "}
      </div>
      <CityGate ctx={ctx} />
      <Header ctx={ctx} />
      {children}
      <CartDrawer ctx={ctx} />
      <ChatWidget ctx={ctx} />
      <Footer ctx={ctx} />
    </div>
  );
}
