// Storefront chrome: announcement bar, city gate, header, cart drawer,
// concierge chat, lead popup, footer. Markup ported from the design handoff.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Eyebrow, Button, ImageSlot } from "../ds/components.jsx";
import { routeToPath } from "./router.js";
import { useWindowWidth, useDismiss } from "../lib/hooks.js";
import { catTree, catFamily, countIn } from "../lib/categories.js";

// Profile menu — sign in / create account when logged out, the customer's name
// and account actions when logged in, and always the gateway to the staff portal.
function ProfileMenu({ ctx }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  useDismiss(wrap, open, useCallback(() => setOpen(false), []));
  const cust = ctx.cust;
  const firstName = cust ? (cust.name || cust.email).trim().split(" ")[0] : "";
  const initial = cust ? (cust.name || cust.email || "?").trim().charAt(0).toUpperCase() : "";
  const item = (label, onClick, color) => (
    <button onClick={() => { setOpen(false); onClick(); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, color: color || "var(--mr-purple-800)", padding: "9px 12px", borderRadius: "var(--radius-sm)" }}>{label}</button>
  );
  return (
    <div ref={wrap} style={{ position: "relative" }}>
      {/* The labelled form on desktop, matching the wishlist and cart beside it;
          a bare avatar on a phone, where there is no room for two lines. */}
      <button onClick={() => setOpen((o) => !o)} title={cust ? cust.name : "Sign in"} aria-label="Account"
        style={{ background: "none", border: "none", cursor: "pointer", padding: ctx.isMobile ? 6 : 0, display: "flex", alignItems: "center", gap: ctx.isMobile ? 8 : 9 }}>
        {cust ? (
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--mr-purple-900)", color: "var(--mr-cream)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 13, flex: "none" }}>{initial}</span>
        ) : (
          <span style={{ display: "flex", color: "var(--mr-purple-800)" }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>
          </span>
        )}
        {!ctx.isMobile && (
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, textAlign: "left" }}>
            <span style={{ fontFamily: "var(--font-condensed)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{cust ? `Hello, ${firstName}` : "Hello, sign in"}</span>
            <span style={{ fontFamily: "var(--font-condensed)", fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mr-purple-900)", whiteSpace: "nowrap" }}>Your account</span>
          </span>
        )}
      </button>
      {open && (
        <>
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

// Cities come from the stores the business actually has open.
function CitySelect({ ctx, style }) {
  return (
    <select
      value={ctx.city}
      onChange={(e) => ctx.setCityConfirmed(e.target.value)}
      title="Your city"
      style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "7px 8px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", background: "var(--surface-card)", color: "var(--mr-purple-800)", cursor: "pointer", outline: "none", ...style }}
    >
      {/* The list a browser paints for a <select> keeps its own white ground, so
          the options are given an ink colour rather than inheriting the cream
          this control wears on the purple band. */}
      {ctx.locations.map((l) => <option key={l.id} value={l.id} style={{ color: "var(--mr-ink)" }}>{l.city}</option>)}
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
        <Eyebrow>First order</Eyebrow>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "14px 0 8px" }}>{content ? content.title : "10% off your first order"}</h2>
        <p style={{ fontSize: 14, lineHeight: "var(--lh-body)", margin: "0 0 20px" }}>{content ? content.message : "Enter your email and we'll send you the code."}</p>
        {ctx.plDone ? (
          <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", padding: 16 }}>
            <div style={{ fontFamily: "var(--font-condensed)", letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", fontSize: 12, color: "var(--accent-gold-ink)" }}>Your code</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--mr-purple-900)", marginTop: 4 }}>FIRSTTRAIL</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>We've sent it to your inbox too.</div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <input value={ctx.plEmail} onChange={(e) => ctx.setPlEmail(e.target.value)} placeholder="you@email.com" style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 14, padding: "12px 14px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", color: "var(--text-strong)", background: "var(--surface-card)" }} />
            <Button variant="gold" onClick={ctx.submitLead}>Get my code</Button>
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
      <span style={{ fontSize: 13, color: "var(--mr-purple-800)" }}>Shopping from <strong style={{ fontWeight: 600 }}>{ctx.cityName}</strong>? We'll show you what's in stock there first.</span>
      <Button variant="primary" size="sm" onClick={() => ctx.setCityConfirmed(ctx.city)}>Yes, that's right</Button>
      <CitySelect ctx={ctx} style={{ fontSize: 13, padding: "7px 10px", border: "1px solid var(--border-strong)" }} />
    </div>
  );
}

// The header, in two tiers, as the redesign draws it.
//
// Tier one is the cream bar: the wordmark, and on the right the three things a
// shopper reaches for — saved products, their account, their cart — each with its
// own label rather than a bare icon, so nothing has to be guessed at.
//
// Tier two is the purple band: a fixed 250px "All categories" panel opening a
// menu of the store's categories, the main pages by name, and then search,
// currency and city. The homepage's hero grid leaves a 250px column empty on
// the left precisely so the rail can stand open over it.
//
// The band is a fixed 1280px wide at most, of which the menu takes 250 and the
// search box up to 320 — so it seats five tabs and no more. Everything else the
// old header carried moves into the menu's own footer, which has no such
// ceiling. `from` drops the last tab, and then the search box, on the narrow
// desktops where even five will not fit: the band shortens rather than clipping
// a word in half.
const NAV_TABS = [
  { label: "Home", page: "home" },
  { label: "New arrivals", page: "shop", extra: { fSeg: "new-arrivals" } },
  { label: "Deals", page: "shop", extra: { fSeg: "deals" }, hot: true },
  { label: "Best sellers", page: "shop", extra: { fSeg: "best-sellers" } },
  // The blog takes the band's last tab. The house writes it weekly and it is
  // what brings people back; the story does not change and does not need a slot
  // at the top of every page. /about is still there — the menu below names it,
  // the footer links it, and the home page still runs its opening paragraph.
  { label: "Blog", page: "blog", from: 1000 },
];

// Below this the search box leaves the band and takes its old place in the top
// bar, where there is room to spare.
const BAND_SEARCH_FROM = 1150;

// Under the categories in the menu: the whole catalogue, and the pages the band
// has no room to name.
const RAIL_FOOTER = [
  { label: "All products", extra: { fCat: "all", fSeg: null, fBrand: "", fCol: null } },
  { label: "Our stores", page: "locations" },
  { label: "Blog", page: "blog" },
  { label: "Our story", page: "about" },
  { label: "FAQs", page: "faq" },
];

// Which nav tab is lit. A tab lights when its own page is the one being looked
// at, not merely when the shop page is open.
function navActive(ctx, tab) {
  if (tab.extra && tab.extra.fSeg) return ctx.page === "shop" && ctx.fSeg === tab.extra.fSeg;
  if (tab.page === "shop") return ctx.page === "shop" && !ctx.fSeg;
  return ctx.page === tab.page;
}

const RAIL_W = 250;
const RAIL_ROW_H = 56;
const FLY_W = 250;

// The categories menu, its flyout, and the one rule that makes both usable:
// **the thing that owns "open" has to contain everything the pointer touches.**
//
// It didn't. The panel hangs below the purple band (`top: 100%`, outside its
// box) while the band owned the mouse-leave — so walking down from "All
// categories" into the list left the band, closed the menu, and every category
// in it was unclickable. The trigger and the panel now sit inside one relative
// wrapper that owns the hover, and the flyout is a DOM descendant of that
// wrapper, so moving out along a row doesn't close anything either.
//
// Three ways in, because a menu is used three ways: hover (a mouse), click (a
// trackpad, a touchscreen, a keyboard), and pinned open by the home page, whose
// hero grid leaves a 250px column empty for exactly that.
function CategoryRail({ ctx, pinned }) {
  const [hover, setHover] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [flyId, setFlyId] = useState(null);
  const [scroll, setScroll] = useState(0);
  const wrap = useRef(null);
  const open = pinned || hover || stuck;
  useDismiss(wrap, stuck, useCallback(() => setStuck(false), []));

  // The categories the store sells by, each carrying its own sub-categories.
  const cats = catTree(ctx.categories);
  const byId = new Map(ctx.products.map((p) => [p.id, p]));
  const close = () => { setHover(false); setStuck(false); setFlyId(null); };
  const go = (extra) => { close(); ctx.nav("shop", extra); };
  const goPage = (page) => { close(); ctx.nav(page); };

  const flyIdx = cats.findIndex((c) => c.id === flyId);
  const fly = flyIdx >= 0 ? cats[flyIdx] : null;
  const inCat = (id) => countIn(ctx.categories, ctx.products, id);

  // How many products a merchandising shelf holds *within* one category. The
  // shelf itself is the server's answer (worker/merch.js); this only asks how
  // much of it is filed under here, so a row that would land on an empty grid
  // is never offered.
  const shelfCount = (segment, catId) => {
    const fam = catFamily(ctx.categories, catId);
    return (ctx.segments[segment] || []).filter((id) => {
      const p = byId.get(id);
      return p && (!fam || fam.has(p.cat));
    }).length;
  };

  const row = {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    height: RAIL_ROW_H, padding: "0 20px", borderBottom: "1px solid var(--border-hairline)",
    fontFamily: "var(--font-sans)", fontSize: 13.5, cursor: "pointer", background: "transparent",
    border: "none", borderBottomStyle: "solid", width: "100%", textAlign: "left",
  };
  const flyRow = {
    display: "flex", width: "100%", justifyContent: "space-between", gap: 10, alignItems: "center",
    padding: "9px 20px", background: "none", border: "none", cursor: "pointer",
    fontFamily: "var(--font-sans)", fontSize: 13, textAlign: "left",
  };
  const count = (n) => <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{n}</span>;

  return (
    <div
      ref={wrap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setFlyId(null); }}
      style={{ position: "relative", flex: "none", alignSelf: "stretch", display: "flex", alignItems: "center" }}>
      {/* Clicking pins the menu open, for a trackpad or a touchscreen where
          there is no hover to hold it. */}
      <button
        onClick={() => setStuck((v) => !v)}
        aria-expanded={open}
        aria-label="All categories"
        style={{ width: RAIL_W, background: "var(--mr-purple-950)", color: "var(--mr-cream)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0 20px", height: 50, cursor: "pointer", border: "none", fontFamily: "var(--font-condensed)" }}>
        <span style={{ fontSize: 12, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase" }}>All categories</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
      </button>

      {open && (
        <div style={{ position: "absolute", left: 0, top: "100%", width: RAIL_W, background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderTop: "none", boxShadow: "var(--shadow-md)", zIndex: 60 }}>
          {/* A store with a dozen categories would otherwise hang a 700px
              curtain over the page, so the list keeps its own scroll. The
              flyout sits outside it — inside, the scroller would clip it. */}
          <div onScroll={(e) => setScroll(e.currentTarget.scrollTop)} style={{ maxHeight: "min(60vh, 520px)", overflowY: "auto" }}>
            {cats.map((c) => {
              const on = flyId === c.id;
              return (
                <button key={c.id} onMouseEnter={() => setFlyId(c.id)} onFocus={() => setFlyId(c.id)}
                  onClick={() => go({ fCat: c.id, fSeg: null, fBrand: "", fCol: null })}
                  style={{ ...row, color: on ? "var(--mr-orchid-600)" : "var(--text-body)", background: on ? "var(--surface-sunken)" : "transparent", borderBottomColor: "var(--border-hairline)", borderBottomWidth: 1 }}>
                  <span>{c.label}</span>
                  {/* Every category opens something now — its shelves, if not
                      its sub-categories — so every one carries the chevron. */}
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {count(inCat(c.id))}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                  </span>
                </button>
              );
            })}
            {RAIL_FOOTER.map((r) => (
              <button key={r.label} onMouseEnter={() => setFlyId(null)}
                onClick={() => (r.page ? goPage(r.page) : go(r.extra))}
                style={{ ...row, height: 44, borderBottom: "none", fontSize: 13, color: "var(--mr-orchid-600)" }}>
                <span>{r.label}</span>
              </button>
            ))}
          </div>

          {fly && (
            <div
              // It opens beside the row it belongs to, and it starts exactly at
              // the panel's right edge — a gap there would be a gap the pointer
              // falls through on the way over.
              style={{ position: "absolute", left: RAIL_W, top: Math.max(0, flyIdx * RAIL_ROW_H - scroll), width: FLY_W, background: "var(--surface-card)", border: "1px solid var(--border-hairline)", boxShadow: "var(--shadow-md)", padding: "12px 0", zIndex: 61 }}>
              <div style={{ fontFamily: "var(--font-condensed)", fontSize: 10, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)", padding: "0 20px 8px" }}>{fly.label}</div>

              <button onClick={() => go({ fCat: fly.id, fSeg: null, fBrand: "", fCol: null })}
                style={{ ...flyRow, fontWeight: 500, color: "var(--text-strong)" }}>
                <span>Everything</span>
                {count(inCat(fly.id))}
              </button>

              {fly.children.map((sc) => (
                <button key={sc.id} onClick={() => go({ fCat: sc.id, fSeg: null, fBrand: "", fCol: null })}
                  style={{ ...flyRow, color: "var(--mr-purple-800)" }}>
                  <span>{sc.label}</span>
                  {count(inCat(sc.id))}
                </button>
              ))}

              {/* The shelves, narrowed to this category — "/best-sellers?
                  category=perfumes" is a real address, so each of these is a
                  link a shopper can keep. A shelf with nothing on it here is
                  left out rather than offered as a road to an empty page. */}
              {(() => {
                const shelves = [
                  { seg: "best-sellers", label: "Best sellers" },
                  { seg: "new-arrivals", label: "New arrivals" },
                  { seg: "deals", label: "Deals" },
                ].map((sh) => ({ ...sh, n: shelfCount(sh.seg, fly.id) })).filter((sh) => sh.n > 0);
                if (!shelves.length) return null;
                return (
                  <div style={{ borderTop: "1px solid var(--border-hairline)", margin: "8px 20px 0", paddingTop: 6 }}>
                    {shelves.map((sh) => (
                      <button key={sh.seg} onClick={() => go({ fCat: fly.id, fSeg: sh.seg, fBrand: "", fCol: null })}
                        style={{ ...flyRow, padding: "8px 0", fontSize: 12.5, color: "var(--mr-orchid-600)" }}>
                        <span>{sh.label}</span>
                        {count(sh.n)}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {fly.desc && <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55, padding: "10px 20px 0", borderTop: "1px solid var(--border-hairline)", margin: "8px 20px 0" }}>{fly.desc}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// The store's logo.
//
// A logo is set in Admin → Settings, and until one is there the typeset lockup
// stands in — the store must never open with a broken image where its name
// should be. The supplied artwork is a full lockup (the bottle *and* the words),
// so it replaces both lines rather than sitting beside them.
//
// `tone="light"` is the footer, which is near-black purple: a dark logo would
// vanish into it, so it takes a light version if one has been uploaded and
// otherwise keeps the cream wordmark. Better a legible name than an invisible
// mark.
//
// The store's own artwork ships with the build, so the logo shows from the
// first request rather than waiting on someone to upload one. The setting still
// wins where it is filled in — that is how the logo gets changed without a
// deploy.
const LOGO = { dark: "/logo.png", light: "/logo-light.png" };

function Wordmark({ ctx, height, tone = "dark", onClick }) {
  const { settings } = ctx;
  const src = (tone === "light" ? settings.logoLightUrl : settings.logoUrl) || LOGO[tone];
  const inner = src
    ? <img src={src} alt="Majestic Roobee" style={{ display: "block", height, width: "auto", maxWidth: "min(52vw, 260px)", objectFit: "contain" }} />
    : (
      <>
        <span style={{ fontFamily: "var(--font-display)", fontSize: tone === "light" ? 22 : "clamp(20px, 2.4vw, 27px)", color: tone === "light" ? "var(--mr-cream)" : "var(--mr-purple-900)", letterSpacing: "0.01em", whiteSpace: "nowrap" }}>Majestic Roobee</span>
        <span style={{ fontFamily: "var(--font-condensed)", fontSize: 9.5, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--accent-gold-ink)", paddingTop: 4 }}>Perfumes &amp; wellness</span>
      </>
    );
  const style = { display: "flex", flexDirection: "column", lineHeight: 1.05 };
  if (!onClick) return <div style={style}>{inner}</div>;
  return <a href="/" onClick={(e) => { e.preventDefault(); onClick(); }} style={style} aria-label="Majestic Roobee — home">{inner}</a>;
}

// One of the three labelled destinations on the right of the top bar: an icon,
// a quiet line, and the line that carries the state.
function HeaderAction({ icon, kicker, label, onClick, href, badge }) {
  const body = (
    <>
      <span style={{ position: "relative", display: "flex", color: "var(--mr-purple-800)" }}>
        {icon}
        {badge != null && (
          <span style={{ position: "absolute", top: -5, right: -6, background: "var(--accent-gold)", color: "var(--mr-purple-950)", fontSize: 10.5, fontWeight: 600, minWidth: 17, height: 17, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{badge}</span>
        )}
      </span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, textAlign: "left" }}>
        <span style={{ fontFamily: "var(--font-condensed)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{kicker}</span>
        <span style={{ fontFamily: "var(--font-condensed)", fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mr-purple-900)", whiteSpace: "nowrap" }}>{label}</span>
      </span>
    </>
  );
  const style = { display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", padding: 0 };
  return href
    ? <a href={href} onClick={(e) => { e.preventDefault(); onClick(); }} style={style}>{body}</a>
    : <button onClick={onClick} style={style}>{body}</button>;
}

const ICON_HEART = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>;
const ICON_BAG = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;

function Header({ ctx }) {
  const [atTop, setAtTop] = useState(true);
  const w = useWindowWidth();
  const tabs = NAV_TABS.filter((t) => !t.from || w >= t.from);
  const bandSearch = w >= BAND_SEARCH_FROM;
  // The menu stands open on the home page, which is the one layout that leaves
  // it a column of its own, and only while the hero is still on screen — below
  // that it would hang over the shelves. Everywhere else it opens on hover or a
  // click, which the menu itself owns; this only says when it is *pinned*, so
  // the two can't fight over one piece of state.
  const home = ctx.page === "home" && !ctx.isMobile;
  useEffect(() => {
    if (!home) return undefined;
    const sync = () => setAtTop(window.scrollY < 200);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, [home]);

  const cartCount = ctx.cart.reduce((n, c) => n + c.qty, 0);
  const wishCount = ctx.wishlist.length;
  const searchBox = (dark) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, alignSelf: "center", flex: dark ? "0 1 320px" : undefined, minWidth: dark ? 160 : undefined, background: "var(--surface-card)", borderRadius: "var(--radius-sm)", padding: "8px 14px", border: dark ? "none" : "1px solid var(--border-hairline)" }}>
      <input value={ctx.search} onChange={(e) => ctx.setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && ctx.nav("shop", { fSeg: null, fCol: null })}
        placeholder="Search for a perfume, oil or mist…" aria-label="Search the store"
        style={{ border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--text-strong)", width: "100%" }} />
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mr-mute)" strokeWidth="1.6" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
    </div>
  );
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250,246,241,0.94)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--border-hairline)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(16px, 4vw, 40px)", display: "flex", alignItems: "center", gap: 16, height: ctx.isMobile ? 66 : 78, minWidth: 0 }}>
        {ctx.isMobile && (
          <button onClick={() => ctx.setMnav(!ctx.mnav)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex" }} aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--mr-purple-900)" strokeWidth="1.5" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
          </button>
        )}
        <Wordmark ctx={ctx} height={ctx.isMobile ? 34 : 46} onClick={() => ctx.nav("home")} />
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 clamp(8px, 2vw, 28px)" }}>
          {!ctx.isMobile && !bandSearch && <div style={{ width: "100%", maxWidth: 420 }}>{searchBox(false)}</div>}
        </div>
        {!ctx.isMobile ? (
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(16px, 2.2vw, 30px)" }}>
            <HeaderAction icon={ICON_HEART} href="/wishlist" kicker="Welcome" label={`Wish list${wishCount ? ` (${wishCount})` : ""}`} onClick={() => ctx.nav("wishlist")} />
            <ProfileMenu ctx={ctx} />
            <HeaderAction icon={ICON_BAG} kicker="Your cart" label={ctx.fmt(ctx.cc.sub)} badge={cartCount || null} onClick={() => ctx.setCartOpen(true)} />
          </div>
        ) : (
          <button onClick={() => ctx.setCartOpen(true)} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex" }} aria-label="Cart">
            {ICON_BAG}
            {cartCount > 0 && (
              <span style={{ position: "absolute", top: -2, right: -4, background: "var(--accent-gold)", color: "var(--mr-purple-950)", fontSize: 10.5, fontWeight: 600, minWidth: 17, height: 17, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{cartCount}</span>
            )}
          </button>
        )}
      </div>

      {!ctx.isMobile && (
        <div style={{ background: "var(--mr-purple-900)" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(16px, 4vw, 40px)", display: "flex", alignItems: "stretch", position: "relative", minWidth: 0 }}>
            <CategoryRail ctx={ctx} pinned={home && atTop} />
            <nav style={{ display: "flex", alignItems: "center", gap: "clamp(10px, 1.5vw, 26px)", padding: "0 clamp(12px, 1.8vw, 28px)", fontFamily: "var(--font-condensed)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", flex: "0 0 auto" }}>
              {tabs.map((t) => (
                <a key={t.label} href={routeToPath(t.page, t.extra)}
                  onClick={(e) => { e.preventDefault(); ctx.nav(t.page, t.extra || {}); }}
                  style={{ position: "relative", color: navActive(ctx, t) ? "var(--accent-gold)" : "var(--mr-cream)" }}>
                  {t.label}
                  {t.hot && (
                    <span style={{ position: "absolute", top: -10, right: -17, background: "var(--mr-orchid-600)", color: "#fff", fontFamily: "var(--font-sans)", fontSize: 8.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 5px", borderRadius: "var(--radius-xs)" }}>hot</span>
                  )}
                </a>
              ))}
            </nav>
            <div style={{ flex: 1, minWidth: 12 }} />
            {/* Currency and city used to sit here, at the right-hand end of
                the band — which is the one place on the page a shopper is not
                looking once they have started shopping, and nowhere at all on
                a phone until they opened the menu. They float with the support
                buttons now; see SupportDock. */}
            {bandSearch && searchBox(true)}
          </div>
        </div>
      )}

      {ctx.mnav && ctx.isMobile && (
        <nav style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--border-hairline)", background: "var(--mr-cream)", padding: "8px 0", maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ margin: "8px 24px 12px" }}>{searchBox(false)}</div>
          {/* The drawer has room the band has not, so the story keeps its place
              here rather than disappearing with the header tab. */}
          {NAV_TABS.concat([{ label: "Shop", page: "shop" }, { label: "Wishlist", page: "wishlist" }, { label: "Our story", page: "about" }, { label: "Track order", page: "track" }, { label: "FAQs", page: "faq" }, { label: "Contact", page: "contact" }]).map((t) => (
            <a key={t.label} href={routeToPath(t.page, t.extra)} onClick={(e) => { e.preventDefault(); ctx.nav(t.page, t.extra || {}); }} style={{ padding: "12px 24px", fontSize: 15, fontWeight: 500 }}>{t.label}</a>
          ))}
          <div style={{ borderTop: "1px solid var(--border-hairline)", margin: "8px 0", paddingTop: 8 }}>
            <div style={{ padding: "4px 24px 8px", fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)" }}>Categories</div>
            {/* The menu bar is a desktop thing, so on a phone this drawer *is*
                the category system — which means it carries the whole tree, not
                a flattened list of the top-level categories. */}
            {catTree(ctx.categories).map((c) => (
              <div key={c.id}>
                <a href={routeToPath("shop", { fCat: c.id })} onClick={(e) => { e.preventDefault(); ctx.nav("shop", { fCat: c.id, fSeg: null, fBrand: "", fCol: null }); }}
                  style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 24px", fontSize: 14.5, fontWeight: c.children.length ? 500 : 400 }}>
                  <span>{c.label}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{countIn(ctx.categories, ctx.products, c.id)}</span>
                </a>
                {c.children.map((sc) => (
                  <a key={sc.id} href={routeToPath("shop", { fCat: sc.id })} onClick={(e) => { e.preventDefault(); ctx.nav("shop", { fCat: sc.id, fSeg: null, fBrand: "", fCol: null }); }}
                    style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 24px 8px 38px", fontSize: 13.5, color: "var(--text-body)" }}>
                    <span>{sc.label}</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{countIn(ctx.categories, ctx.products, sc.id)}</span>
                  </a>
                ))}
              </div>
            ))}
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
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--text-muted)", textAlign: "center", marginTop: 40 }}>Your cart is empty.</p>
          )}
          {cc.items.map((it) => (
            <div key={it.key} style={{ display: "flex", gap: 14 }}>
              <ImageSlot src={it.imageUrl} name={it.name} sizes="58px" shape="rounded" radius={10} style={{ width: 58, height: 58, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{it.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 8px" }}>{it.size}</div>
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
          {/* Free delivery has been enforced since the shop opened and never
              once shown to the person it would move. */}
          {cc.items.length > 0 && cc.freeShip && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, color: cc.freeShip.remaining ? "var(--text-body)" : "#3f6b45", fontWeight: 500, marginBottom: 6 }}>
                {cc.freeShip.remaining
                  ? <>Add {ctx.fmt(cc.freeShip.remaining)} more for free delivery</>
                  : <>Free delivery unlocked</>}
              </div>
              <div style={{ height: 6, borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", overflow: "hidden" }}>
                <div style={{ width: `${cc.freeShip.pct}%`, height: "100%", background: cc.freeShip.remaining ? "var(--mr-gold-500)" : "#8fd694", transition: "width .3s" }} />
              </div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 600, color: "var(--text-strong)", marginBottom: 6 }}>
            <span>Subtotal</span><span>{ctx.fmt(cc.sub)}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Delivery calculated at checkout.</div>
          <Button variant="gold" size="lg" block disabled={cc.items.length === 0} onClick={() => ctx.nav("checkout")}>Checkout</Button>
        </div>
      </aside>
    </>
  );
}

// One quiet word to somebody with a full cart who is about to leave.
//
// Everything about it is deliberately restrained: it is off until the house
// writes its own copy, it never appears for a shopper with an empty cart or one
// already at checkout, it takes no for an answer for days at a time, and it is
// a card in the corner rather than a sheet over the shop. A pop-up is the
// easiest thing in this sprint to make a shop worse with.
function LeaveNudge({ ctx }) {
  if (!ctx.nudge) return null;
  const st = ctx.settings || {};
  const n = ctx.cart.reduce((a, c) => a + c.qty, 0);
  // The consent banner owns the bottom of the screen until it is answered, and
  // two cards stacked on the same 16px would sit on top of each other.
  const bottom = ctx.showConsent ? 128 : 16;
  return (
    <div role="dialog" aria-label={st.nudgeTitle || "Still deciding?"}
      style={{ position: "fixed", left: 16, right: 16, bottom, zIndex: 175, maxWidth: 400, margin: "0 auto", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text-strong)" }}>{st.nudgeTitle || "Still deciding?"}</div>
        <button onClick={ctx.dismissNudge} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "var(--text-muted)", lineHeight: 1 }}>✕</button>
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)", margin: "8px 0 0" }}>{st.nudgeBody}</p>
      {st.nudgeCode && (
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--mr-purple-900)" }}>
          Use <strong style={{ fontFamily: "var(--font-condensed)", letterSpacing: "0.08em" }}>{st.nudgeCode}</strong> at checkout.
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <Button variant="primary" onClick={ctx.takeNudge}>{st.nudgeCta || "Back to my cart"}</Button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{n} item{n === 1 ? "" : "s"} waiting</span>
      </div>
    </div>
  );
}

// The floating dock: currency, city, and the way into the Perfume Studio's
// calendar — a horizontal row sitting just above the support button.
//
// Currency and city were at the right-hand end of the purple band, which is
// the last place a shopper looks once they have started shopping and is not on
// the page at all on a phone until they open the menu. The house asked for
// them to float instead, with "Book a consultation" beside them. That turns
// out to be the right place for all three: a shopper works out halfway down a
// product page that the price is in the wrong currency, or that they are
// looking at Lagos stock, and the control is under their thumb rather than a
// scroll away.
//
// It stands down for the chat panel, which occupies the same corner when open.
function SupportDock({ ctx }) {
  if (ctx.chat.open) return null;
  const consult = ctx.consultation || {};
  // The chat button is 56px at bottom:20. The consent banner owns the bottom of
  // the screen until it is answered, and on a phone it is full width, so the
  // dock climbs over it rather than hiding behind it.
  const bottom = ctx.showConsent ? 168 : 88;
  const pill = {
    display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface-card)",
    border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)",
    padding: "8px 13px", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500,
    color: "var(--mr-purple-800)", cursor: "pointer", boxShadow: "var(--shadow-sm)", outline: "none",
    appearance: "none", lineHeight: 1.2,
  };
  return (
    <div style={{ position: "fixed", right: 20, bottom, zIndex: 158, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, maxWidth: "calc(100vw - 40px)" }}>
      {consult.on && (
        <a href="/consultation" onClick={(e) => { e.preventDefault(); ctx.nav("consultation"); }}
          style={{ ...pill, background: "var(--accent-gold)", borderColor: "transparent", color: "var(--mr-purple-950)", fontWeight: 600, boxShadow: "var(--shadow-gold)", textDecoration: "none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" />
          </svg>
          {consult.ctaLabel || "Book a consultation"}
        </a>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button onClick={ctx.toggleCurrency} title="Switch currency" aria-label={`Prices in ${ctx.currency}. Switch currency.`} style={pill}>
          {ctx.currency === "NGN" ? "\u20a6 NGN" : "$ USD"}
        </button>
        <CitySelect ctx={ctx} style={{ ...pill, paddingRight: 11 }} />
      </div>
    </div>
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
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Majestic Roobee customer service</div>
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

// Instagram, TikTok and Facebook — each shown only once its link is filled in
// under Admin → Settings → Footer.
const SOCIALS = [
  { id: "instagram", name: "Instagram", setting: "igUrl",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg> },
  { id: "tiktok", name: "TikTok", setting: "tiktokUrl",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3a5 5 0 0 0 5 5" /><path d="M16 3v11.5a5.5 5.5 0 1 1-5.5-5.5c.35 0 .69.03 1 .1" /></svg> },
  { id: "facebook", name: "Facebook", setting: "facebookUrl",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" /></svg> },
];

function Footer({ ctx }) {
  const { settings } = ctx;
  const link = (label, page, extra) => (
    <a href={routeToPath(page, extra)} onClick={(e) => { e.preventDefault(); ctx.nav(page, extra); }} style={{ color: "var(--text-on-dark-muted)" }}>{label}</a>
  );
  // Shipping and returns are answers on the FAQ page rather than pages of their
  // own, so these open it and then move to the question. The scroll is a
  // nicety: if the anchor isn't there, the shopper is still on the FAQ.
  const faqLink = (label, hash) => (
    <a href={`/faq#${hash}`} style={{ color: "var(--text-on-dark-muted)" }}
      onClick={(e) => {
        e.preventDefault();
        ctx.nav("faq");
        setTimeout(() => {
          const el = document.getElementById(hash);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }}>{label}</a>
  );
  const colTitle = { fontFamily: "var(--font-condensed)", fontSize: 12, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--mr-gold-400)", marginBottom: 14 };
  return (
    <footer style={{ background: "var(--mr-purple-950)", color: "var(--text-on-dark-muted)", marginTop: "clamp(48px, 8vw, 88px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px, 6vw, 64px) clamp(16px, 4vw, 40px) 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 32 }}>
        <div>
          <div style={{ marginBottom: 12 }}><Wordmark ctx={ctx} height={44} tone="light" /></div>
          <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: "34ch", margin: 0 }}>{settings.footerTagline}</p>
          {/* Only the accounts the store actually keeps: a dead icon linking
              nowhere is worse than no icon. */}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            {SOCIALS.filter((so) => settings[so.setting]).map((so) => (
              <a key={so.id} href={settings[so.setting]} target="_blank" rel="noopener noreferrer" aria-label={so.name} title={so.id === "instagram" ? settings.igHandle || so.name : so.name}
                style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid var(--border-inverse)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mr-gold-400)" }}>
                {so.icon}
              </a>
            ))}
          </div>
        </div>
        <div>
          <div style={colTitle}>Shop</div>
          {/* The categories themselves, so this column says the same thing as
              the header menu rather than keeping its own list to go stale. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
            {catTree(ctx.categories).map((c) => (
              <a key={c.id} href={routeToPath("shop", { fCat: c.id })}
                onClick={(e) => { e.preventDefault(); ctx.nav("shop", { fCat: c.id, fSeg: null, fBrand: "", fCol: null }); }}
                style={{ color: "var(--text-on-dark-muted)" }}>{c.label}</a>
            ))}
            {link("Best sellers", "shop", { fSeg: "best-sellers" })}
          </div>
        </div>
        <div>
          <div style={colTitle}>About</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
            {link("Our story", "about")}
            {link("Our stores", "locations")}
            {/* Only while the studio is taking bookings — a footer link to a
                page that says "not at the moment" is a link nobody wanted. */}
            {ctx.consultation && ctx.consultation.on && link("Book a consultation", "consultation")}
            {link("Blog", "blog")}
            {link("Reviews", "reviews")}
            {link("Contact us", "contact")}
            {link("FAQs", "faq")}
          </div>
        </div>
        <div>
          <div style={colTitle}>Help</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
            {link("Track an order", "track")}
            {link("Your wishlist", "wishlist")}
            {faqLink("Shipping & delivery", "shipping")}
            {faqLink("Returns & exchanges", "returns")}
            {/* The pages the house has actually published, in the order it put
                them in — rather than a list kept here that promises a returns
                policy nobody has written. */}
            {ctx.pages.map((pg) => (
              <a key={pg.slug} href={`/${pg.slug}`} onClick={(e) => { e.preventDefault(); ctx.nav("info", { pageSlug: pg.slug }); }}
                style={{ color: "var(--text-on-dark-muted)" }}>{pg.title}</a>
            ))}
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border-inverse)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "18px clamp(16px, 4vw, 40px)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
          <span>© {new Date().getFullYear()} Majestic Roobee. All rights reserved.</span>
          <span style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-condensed)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mr-gold-400)" }}>Elevate Your Smellgame</span>
            <a href="/privacy" onClick={(e) => { e.preventDefault(); ctx.nav("info", { pageSlug: "privacy" }); }} style={{ color: "var(--text-on-dark-muted)" }}>Privacy &amp; cookies</a>
            <a href="/admin/" style={{ color: "var(--text-on-dark-muted)" }}>Staff portal</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

// A slim, non-blocking bottom bar (no backdrop — the whole store stays usable
// while it's open). Says what the cookies are for and takes an answer either
// way; it never stands between a shopper and the store.
function ConsentBanner({ ctx }) {
  if (!ctx.showConsent) return null;
  return (
    <div style={{ position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 180, maxWidth: 720, margin: "0 auto", background: "var(--mr-purple-950)", color: "var(--text-on-dark-muted)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", padding: "14px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, lineHeight: 1.5, flex: 1, minWidth: 220 }}>
        We use cookies to run the store and, if you accept, to measure and improve it.
        {" "}<a href="/privacy" onClick={(e) => { e.preventDefault(); ctx.nav("info", { pageSlug: "privacy" }); }} style={{ color: "var(--mr-gold-400)" }}>Privacy policy</a>
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="gold" size="sm" onClick={ctx.grantConsent}>Accept</Button>
        <button onClick={ctx.denyConsent} style={{ background: "none", border: "1px solid var(--border-inverse)", borderRadius: "var(--radius-pill)", padding: "8px 16px", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--text-on-dark-muted)", cursor: "pointer" }}>Decline</button>
      </div>
    </div>
  );
}

// The announcement bar carries whatever promotion is running, scrolling across
// the top of the store. A shopper who doesn't want it can close it, and it
// stays closed — keyed on the message itself, so the next promotion is still
// shown rather than being suppressed by a dismissal of the one before it.
function AnnouncementBar({ ctx }) {
  const message = (ctx.settings.announcement || "").trim();
  const key = "mr-announce-dismissed";
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === message; } catch { return false; }
  });
  if (!message || dismissed) return null;
  const close = () => {
    try { localStorage.setItem(key, message); } catch {}
    setDismissed(true);
  };
  // Two copies of the line make the loop: the track is translated by exactly
  // half its width, so the second copy arrives where the first began. A reader
  // who wants it to stop can hover it, and one who has asked for less motion
  // never sees it move (see .mr-marquee in theme.css).
  const run = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 28, padding: "0 14px", whiteSpace: "nowrap" }}>
      {message}
    </span>
  );
  return (
    <div style={{ position: "relative", background: "var(--mr-purple-950)", color: "var(--text-on-dark-muted)", fontSize: 12, letterSpacing: "0.06em", padding: "9px 44px" }}>
      <div className="mr-marquee">
        <div className="mr-marquee-track">
          {run}
          <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", gap: 28, padding: "0 14px", whiteSpace: "nowrap" }}>{message}</span>
        </div>
      </div>
      <button onClick={close} aria-label="Dismiss this announcement" title="Dismiss"
        style={{ position: "absolute", top: "50%", right: 10, transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.7, fontSize: 14, lineHeight: 1, padding: 6 }}>
        ✕
      </button>
    </div>
  );
}

// "Dorothy from Abuja bought Osk 30ml" — a real, paid order, shown to the next
// shopper. It rotates through the last dozen; closing it puts it away for the
// rest of the visit rather than for one card, because a shopper who dismisses
// this is telling us they don't want it, not that they want the next one.
function PurchaseProof({ ctx }) {
  const list = ctx.proof.purchases;
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [closed, setClosed] = useState(() => {
    try { return sessionStorage.getItem("mr-proof-closed") === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (closed || !list.length) return undefined;
    // A quiet beat before the first one, so it doesn't land on top of the page
    // the shopper has only just opened.
    const first = setTimeout(() => setShown(true), 6000);
    const every = setInterval(() => {
      setShown(false);
      setTimeout(() => { setI((n) => (n + 1) % list.length); setShown(true); }, 600);
    }, Math.max(6000, ctx.proof.intervalMs || 14000));
    return () => { clearTimeout(first); clearInterval(every); };
  }, [closed, list.length, ctx.proof.intervalMs]);

  if (closed || !list.length) return null;
  const p = list[i % list.length];
  const close = () => {
    try { sessionStorage.setItem("mr-proof-closed", "1"); } catch {}
    setClosed(true);
  };
  return (
    <div aria-live="polite" style={{ position: "fixed", left: 16, bottom: 16, zIndex: 155, maxWidth: "min(330px, calc(100vw - 32px))", background: "var(--mr-purple-900)", color: "var(--mr-cream)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", padding: "14px 40px 14px 16px", opacity: shown ? 1 : 0, transform: shown ? "translateY(0)" : "translateY(10px)", transition: "opacity var(--dur-base) var(--ease-glide), transform var(--dur-base) var(--ease-glide)", pointerEvents: shown ? "auto" : "none" }}>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
        <strong style={{ fontWeight: 600 }}>{p.name}</strong>{p.city ? ` from ${p.city}` : ""} purchased <strong style={{ fontWeight: 600 }}>{p.item}</strong>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-on-dark-muted)", marginTop: 4 }}>{p.when}</div>
      <button onClick={close} aria-label="Hide purchase notifications" title="Hide these" style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", cursor: "pointer", color: "var(--text-on-dark-muted)", fontSize: 14, lineHeight: 1, padding: 6 }}>✕</button>
    </div>
  );
}

export function Chrome({ ctx, children }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-body)", background: "var(--mr-cream)", minHeight: "100vh" }}>
      <PromoPopup ctx={ctx} />
      <ConsentBanner ctx={ctx} />
      <AnnouncementBar ctx={ctx} />
      <CityGate ctx={ctx} />
      <Header ctx={ctx} />
      {children}
      <CartDrawer ctx={ctx} />
      <LeaveNudge ctx={ctx} />
      <PurchaseProof ctx={ctx} />
      <SupportDock ctx={ctx} />
      <ChatWidget ctx={ctx} />
      <Footer ctx={ctx} />
    </div>
  );
}
