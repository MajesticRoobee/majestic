// The pages the header's second row leads to: a wishlist, our stores, the
// reviews wall, and the blog.
import React, { useEffect, useRef, useState } from "react";
import { Eyebrow, GildedRule, Button, ImageSlot } from "../ds/components.jsx";
import { useWindowWidth } from "../lib/hooks.js";
import { ProductCard } from "./product-card.jsx";
import { routeToPath } from "./router.js";
import { paragraphs } from "../lib/blog.js";
import { FAQS } from "../lib/faqs.js";

const PAD = "clamp(16px, 4vw, 40px)";
const shellStyle = { maxWidth: 1280, margin: "0 auto", padding: `clamp(28px, 4vw, 48px) ${PAD}` };

function PageHead({ eyebrow, title, sub }) {
  return (
    <>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: `${eyebrow ? 12 : 0}px 0 ${sub ? 6 : 24}px` }}>{title}</h1>
      {sub && <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 26px", maxWidth: "62ch", lineHeight: 1.7 }}>{sub}</p>}
    </>
  );
}

function Empty({ title, children }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 20px", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)" }}>
      <p style={{ fontFamily: "var(--font-serif)", fontSize: 19, color: "var(--text-body)", margin: "0 0 14px" }}>{title}</p>
      {children}
    </div>
  );
}

// ---- Wishlist -------------------------------------------------------------

export function WishlistPage({ ctx }) {
  const saved = ctx.wishlist.map((id) => ctx.listings.find((e) => e.product.id === id)).filter(Boolean);
  const missing = ctx.wishlist.length - saved.length;
  return (
    <main style={shellStyle}>
      <PageHead title="Wishlist" />
      {!ctx.wishlist.length ? (
        <Empty title="Nothing saved yet.">
          <Button variant="primary" onClick={() => ctx.nav("shop")}>Shop</Button>
        </Empty>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 22 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{saved.length} {saved.length === 1 ? "product" : "products"} saved</span>
            {!ctx.cust && (
              <button onClick={() => ctx.nav("account")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--mr-orchid-600)" }}>
                Create an account to keep it
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
            {saved.map((e) => <ProductCard key={e.key} p={ctx.card(e)} />)}
          </div>
          {missing > 0 && (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 20 }}>
              {missing} saved {missing === 1 ? "product is" : "products are"} no longer on sale — {missing === 1 ? "it will reappear" : "they'll reappear"} here if {missing === 1 ? "it comes" : "they come"} back.
            </p>
          )}
        </>
      )}
    </main>
  );
}

// ---- Locations ------------------------------------------------------------

export function LocationsPage({ ctx }) {
  const { settings } = ctx;
  return (
    <main style={shellStyle}>
      <PageHead
        eyebrow="Visit us"
        title="Our stores"
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 18 }}>
        {ctx.locations.map((l) => {
          const here = l.id === ctx.city;
          return (
            <div key={l.id} style={{ background: "var(--surface-card)", border: `1px solid ${here ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, borderRadius: "var(--radius-lg)", padding: "22px 24px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 21, color: "var(--text-strong)" }}>{l.city}</div>
                {here && <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: "#e4efe4", color: "#3f6b45" }}>Your store</span>}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--mr-purple-800)" }}>{l.store}</div>
              <div style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.6 }}>{l.address}</div>
              {l.hours && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{l.hours}</div>}
              {!l.hours && settings.contactHours && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{settings.contactHours}</div>}
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Delivery here: {l.eta}</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
                {l.phone && <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} style={{ fontSize: 13, fontWeight: 500 }}>{l.phone}</a>}
                {l.mapsUrl && <a href={l.mapsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500 }}>Get directions —</a>}
              </div>
              {!here && (
                <button onClick={() => ctx.setCityConfirmed(l.id)} style={{ marginTop: 10, alignSelf: "flex-start", background: "none", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", padding: "8px 16px", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-800)", cursor: "pointer" }}>
                  Shop {l.city} stock
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 32, padding: "22px 24px", background: "var(--surface-sunken)", borderRadius: "var(--radius-lg)", fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.7 }}>
        We deliver nationwide and worldwide.
        {settings.contactPhone && <> Call <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`}>{settings.contactPhone}</a>.</>}
      </div>
    </main>
  );
}

// ---- FAQ ------------------------------------------------------------------

// The questions and answers live in src/lib/faqs.js, which the page's
// structured data reads too.
export { FAQS };

export function FaqPage({ ctx }) {
  const { settings } = ctx;
  const wa = `https://wa.me/${String(settings.contactPhone || "").replace(/[^\d]/g, "").replace(/^0/, "234")}`;
  return (
    <main style={{ ...shellStyle, maxWidth: 820 }}>
      <PageHead title="Frequently asked questions" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {FAQS.map((f) => (
          <div key={f.q} id={f.id} style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "20px 22px", scrollMarginTop: 100 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text-strong)", margin: "0 0 8px" }}>{f.q}</h2>
            {f.a.map((par) => (
              <p key={par} style={{ fontSize: 14.5, lineHeight: 1.75, color: "var(--text-body)", margin: "0 0 8px" }}>{par}</p>
            ))}
            {f.whatsapp && settings.contactPhone && (
              <a href={wa} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 500 }}>
                Message us on WhatsApp — {settings.contactPhone}
              </a>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 28, padding: "22px 24px", background: "var(--surface-sunken)", borderRadius: "var(--radius-lg)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, color: "var(--text-body)", lineHeight: 1.7, maxWidth: "48ch" }}>
          Still have a question about an order, product or fragrance? We&apos;re happy to help.
        </div>
        <Button variant="primary" onClick={() => ctx.nav("contact")}>Send us a message</Button>
      </div>
    </main>
  );
}

// ---- Reviews & testimonials ----------------------------------------------

// One testimonial. An Instagram, TikTok or YouTube post is rendered as that
// platform's own embed inside an iframe — no third-party script runs on the
// page, so nothing here can slow the store down or watch the shopper. A stored
// video file plays inline; anything else is a plain quote card.
// A platform's embed is a fixed shape, and it is the platform that decides it:
// Instagram letterboxes any post into a 4:5 media box and adds its own header
// and "View more on Instagram" bar, TikTok is taller again, YouTube is 16:9.
// An iframe cannot tell its parent how tall it wants to be across origins, so
// the card measures its own width and gives the frame the height that shape
// actually needs — the alternative is the black bars and cropping you get from
// guessing one fixed height for every platform.
const FRAME_HEIGHT = {
  // The captioned embed: the 4:5 post, Instagram's header and bar, and room
  // under them for the caption — the customer's own words.
  instagram: (w) => Math.round(w * 1.25) + 290,
  tiktok: (w) => Math.round(w * 1.78) + 118,
  youtube: (w) => Math.round(w * 0.5625),
  video: (w) => Math.round(w * 1.25),
};

// The width an embed is designed around. Instagram's own embed is 326–658px
// and sits at the narrow end of that in practice; a card much wider letterboxes
// rather than filling, which is why the rail and the wall cap their columns
// rather than stretching a card across the page.
export const EMBED_MAX_WIDTH = 360;

function useMeasuredWidth(fallback = 326) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w || fallback];
}

// `frameHeight` lets a caller impose one shape on a row of cards — the rail
// does, so a TikTok next to a YouTube next to an Instagram post still reads as
// one even row rather than three ragged ones. Left off, each card takes the
// shape its own platform wants.
export function EmbedCard({ t, frameHeight }) {
  const [ref, width] = useMeasuredWidth();
  const height = frameHeight || (FRAME_HEIGHT[t.kind] || FRAME_HEIGHT.instagram)(width);
  const frameStyle = { width: "100%", height, border: "none", display: "block", background: "var(--surface-sunken)" };
  const shell = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", flexGrow: 1 };
  const byline = (
    (t.author || t.handle || t.city) && (
      <div style={{ padding: "12px 16px 14px", borderTop: t.kind === "quote" && !t.thumbUrl ? "none" : "1px solid var(--border-hairline)" }}>
        {/* A written review signs off the way the brief writes it: "— Name". */}
        {t.author && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{t.kind === "quote" && !t.embedUrl ? `— ${t.author}` : t.author}</div>}
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {[t.handle, t.city].filter(Boolean).join(" · ")}
          {t.url && (
            <> {t.handle || t.city ? "·" : ""} <a href={t.url} target="_blank" rel="noopener noreferrer">View the post</a></>
          )}
        </div>
      </div>
    )
  );
  if (t.kind === "video" && t.embedUrl) {
    return (
      <div ref={ref} style={shell}>
        <video src={t.embedUrl} controls playsInline poster={t.thumbUrl || undefined} style={{ ...frameStyle, objectFit: "cover" }} />
        {byline}
      </div>
    );
  }
  if (t.embedUrl) {
    return (
      <div ref={ref} style={shell}>
        <iframe
          src={t.embedUrl}
          title={t.author ? `${t.author} on ${t.kind}` : `A customer post on ${t.kind}`}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          scrolling="no"
          style={frameStyle}
        />
        {/* What the house wrote down for this post — the review in words —
            under the post itself, with its stars. */}
        {t.quote && (
          <div style={{ padding: "14px 16px 0" }}>
            <div aria-label={`${t.rating} out of 5`} style={{ color: "var(--accent-gold-ink)", fontSize: 13, letterSpacing: 2 }}>{"★".repeat(Math.max(1, Math.min(5, t.rating || 5)))}</div>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.55, color: "var(--text-body)", margin: "8px 0 0" }}>“{t.quote}”</p>
          </div>
        )}
        {byline}
      </div>
    );
  }
  // A written review, with the photo the store was sent when there is one.
  return (
    <div ref={ref} style={{ ...shell, justifyContent: "space-between", gap: 0, minHeight: frameHeight || undefined }}>
      {t.thumbUrl && <ImageSlot src={t.thumbUrl} name={t.author || "A customer's photo"} sizes="(max-width: 640px) 92vw, 400px" style={{ width: "100%", height: Math.round(width * 1.25) }} />}
      <div style={{ padding: "26px 24px 16px" }}>
        <div aria-label={`${t.rating} out of 5`} style={{ color: "var(--accent-gold-ink)", fontSize: 14, letterSpacing: 2 }}>{"★".repeat(Math.max(1, Math.min(5, t.rating || 5)))}</div>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, lineHeight: 1.6, color: "var(--text-body)", margin: "14px 0 0" }}>“{t.quote}”</p>
      </div>
      {byline}
    </div>
  );
}

// The home page's reviews rail: the same cards as the wall at /reviews, moving
// one card at a time on a timer so a shopper who stays on the page sees more of
// them than fit across it. Everything shown here is what the admin has marked
// live under Reviews — nothing is written into the page.
export function TestimonialCarousel({ items, intervalMs = 6000 }) {
  const w = useWindowWidth();
  // Columns come from the window, never from how many reviews there happen to
  // be: with one review and a column each, that review used to be stretched
  // across the whole page and the embed inside it letterboxed to fit.
  const perView = w < 700 ? 1 : w < 1060 ? 2 : 3;
  const last = Math.max(0, items.length - perView);
  // One shape for the whole row — the Instagram post's, which is what the store
  // mostly posts — so the rail's height is steady and a single tall TikTok
  // doesn't set it for everyone.
  const [railRef, railWidth] = useMeasuredWidth(1000);
  const frameHeight = FRAME_HEIGHT.instagram(Math.min(EMBED_MAX_WIDTH, railWidth / perView - 20));
  const [i, setI] = useState(0);
  // Paused while the shopper is reading a card (hover or keyboard focus) and
  // for anyone who has asked the system for less motion.
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);
  useEffect(() => {
    try { reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { reduced.current = false; }
  }, []);
  // A narrower window can leave the rail scrolled past its own end.
  useEffect(() => { setI((n) => Math.min(n, last)); }, [last]);
  useEffect(() => {
    if (paused || reduced.current || last === 0) return undefined;
    const t = setInterval(() => setI((n) => (n >= last ? 0 : n + 1)), Math.max(3000, intervalMs));
    return () => clearInterval(t);
  }, [paused, last, intervalMs]);

  if (!items.length) return null;
  const step = (d) => setI((n) => (n + d < 0 ? last : n + d > last ? 0 : n + d));
  const arrow = (label, d, glyph) => (
    <button onClick={() => step(d)} aria-label={label} title={label}
      style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--border-hairline)", background: "var(--surface-card)", color: "var(--mr-purple-800)", cursor: "pointer", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{glyph}</button>
  );
  return (
    <div
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      role="group" aria-roledescription="carousel" aria-label="Reviews and testimonials"
    >
      <div ref={railRef} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "stretch", justifyContent: items.length <= perView ? "center" : "flex-start", transform: `translateX(-${(i * 100) / perView}%)`, transition: "transform var(--dur-slow) var(--ease-glide)" }}>
          {items.map((t, n) => (
            <div key={t.id} aria-hidden={n < i || n >= i + perView} style={{ flex: `0 0 ${100 / perView}%`, maxWidth: `${100 / perView}%`, padding: "0 10px", boxSizing: "border-box", display: "flex", justifyContent: "center" }}>
              <div style={{ width: "100%", maxWidth: EMBED_MAX_WIDTH, display: "flex" }}><EmbedCard t={t} frameHeight={frameHeight} /></div>
            </div>
          ))}
        </div>
      </div>
      {last > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 18 }}>
          {arrow("Previous review", -1, "\u2039")}
          <div style={{ display: "flex", gap: 7 }}>
            {Array.from({ length: last + 1 }, (_, n) => (
              <button key={n} onClick={() => setI(n)} aria-label={`Go to review ${n + 1}`} aria-current={n === i}
                style={{ width: n === i ? 20 : 8, height: 8, padding: 0, borderRadius: 4, border: "none", cursor: "pointer", background: n === i ? "var(--mr-purple-900)" : "var(--border-hairline)", transition: "width var(--dur-base) var(--ease-glide)" }} />
            ))}
          </div>
          {arrow("Next review", 1, "\u203a")}
        </div>
      )}
    </div>
  );
}

export function ReviewsPage({ ctx }) {
  const { testimonials, settings } = ctx;
  const [kind, setKind] = useState("all");
  // How many columns of embed-width fit. Worked out here rather than left to
  // `column-width`, which treats its value as a minimum and then stretches the
  // columns to fill the page — a 360px post in a 590px column is the stretching
  // this is meant to stop.
  const winW = useWindowWidth();
  const wallColumns = Math.max(1, Math.min(3, Math.floor((Math.min(winW, 1280) - 32) / (EMBED_MAX_WIDTH + 20))));
  const kinds = [...new Set(testimonials.map((t) => t.kind))];
  const list = kind === "all" ? testimonials : testimonials.filter((t) => t.kind === kind);
  const label = { instagram: "Instagram", tiktok: "TikTok", youtube: "Video", video: "Video", quote: "Written" };
  const chip = (on, onClick, text, key) => (
    <button key={key} onClick={onClick} style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "8px 16px", borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : "var(--mr-purple-800)" }}>{text}</button>
  );
  return (
    <main style={shellStyle}>
      <PageHead
        eyebrow="Reviews"
        title={settings.reviewsHeadline || "Don't just take our word for it"}
        sub={settings.reviewsIntro || "What our customers say, in their own words and their own posts."}
      />
      {kinds.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {chip(kind === "all", () => setKind("all"), "Everything", "all")}
          {kinds.map((k) => chip(kind === k, () => setKind(k), label[k] || k, k))}
        </div>
      )}
      {!list.length ? (
        <Empty title="The wall is going up.">
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 18px" }}>
            {settings.igHandle ? <>Meanwhile, everything our customers post is on Instagram at {settings.igHandle}.</> : "Customer posts will appear here shortly."}
          </p>
          {settings.igUrl && <a href={settings.igUrl} target="_blank" rel="noopener noreferrer"><Button variant="primary">Visit us on Instagram</Button></a>}
        </Empty>
      ) : (
        /* Columns rather than a grid: an Instagram post, a TikTok and a written
           review are three different heights, and a grid row is as tall as its
           tallest card — which leaves holes. Columns let each card sit directly
           under the one above it. */
        <div style={{ columnCount: wallColumns, columnGap: 20, maxWidth: wallColumns * EMBED_MAX_WIDTH + (wallColumns - 1) * 20, margin: "0 auto" }}>
          {list.map((t) => (
            <div key={t.id} style={{ breakInside: "avoid", WebkitColumnBreakInside: "avoid", marginBottom: 20 }}>
              <EmbedCard t={t} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// ---- The blog -------------------------------------------------------------

// A story is read into blocks by src/lib/blog.js — it accepts a blank line or
// a single line break between paragraphs, spots headings nobody marked, and
// understands bold, italic, lists and links. Those become elements here; no
// string a writer typed is ever handed to dangerouslySetInnerHTML.

// **bold**, *italic*, and [a link](https://…) inside a paragraph. Written as a
// loop rather than one regex with a lookbehind: older iPhones (Safari before
// 16.4) cannot parse a lookbehind at all, and a syntax error in this bundle is
// a white screen on every page, not just the blog.
const INLINE = /\*\*([^*]+)\*\*|__([^_]+)__|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]*)\)|([*_])([^*_\s][^*_]*?)\5(?=[\s).,;:!?]|$)/g;
export function Inline({ text }) {
  const s = String(text || "");
  const out = [];
  let last = 0;
  let m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(s))) {
    // An italic mark only counts at the start of a word — "5*3*2" is arithmetic.
    if (m[5] && m.index > 0 && !/[\s(]/.test(s[m.index - 1])) continue;
    if (m.index > last) out.push(s.slice(last, m.index));
    const k = out.length;
    if (m[1] || m[2]) out.push(<strong key={k} style={{ fontWeight: 600, color: "var(--text-strong)" }}>{m[1] || m[2]}</strong>);
    else if (m[3]) {
      const external = /^https?:\/\//.test(m[4]);
      out.push(<a key={k} href={m[4]} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} style={{ color: "var(--mr-orchid-600)", textDecoration: "underline", textUnderlineOffset: 3 }}>{m[3]}</a>);
    } else out.push(<em key={k}>{m[6]}</em>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out.map((x, i) => (typeof x === "string" ? <React.Fragment key={`t${i}`}>{x}</React.Fragment> : x));
}

export function PostBody({ body, size = 16.5 }) {
  const blocks = paragraphs(body);
  const para = { fontSize: size, lineHeight: 1.85, color: "var(--text-body)", margin: 0 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {blocks.map((b, i) => {
        if (b.type === "h") {
          return <h2 key={i} style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.4vw, 28px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", lineHeight: 1.25, margin: i ? "18px 0 -4px" : "0 0 -4px" }}><Inline text={b.text} /></h2>;
        }
        // A line that is only an address is a picture: an uploaded one (which
        // is served from /images and so has narrower copies to offer) or a
        // pasted external one.
        if (b.type === "img") {
          return <ImageSlot key={i} src={b.src} shape="rounded" radius={14} sizes="(max-width: 760px) 92vw, 720px" style={{ width: "100%", margin: "6px 0" }} />;
        }
        if (b.type === "quote") {
          return (
            <blockquote key={i} style={{ margin: "8px 0", padding: "6px 0 6px 22px", borderLeft: "3px solid var(--mr-gold-400)", fontFamily: "var(--font-serif)", fontSize: size + 4, lineHeight: 1.55, color: "var(--mr-purple-900)", fontStyle: "italic" }}>
              <Inline text={b.text} />
            </blockquote>
          );
        }
        if (b.type === "ul" || b.type === "ol") {
          const List = b.type;
          return (
            <List key={i} style={{ ...para, paddingLeft: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              {b.items.map((it, j) => <li key={j} style={{ paddingLeft: 4 }}><Inline text={it} /></li>)}
            </List>
          );
        }
        return <p key={i} style={para}><Inline text={b.text} /></p>;
      })}
    </div>
  );
}

// The line above a card's title: date · first tag · minutes to read.
function PostMeta({ p, style }) {
  const bits = [p.published, p.tags && p.tags[0], p.readMins ? `${p.readMins} min read` : ""].filter(Boolean);
  return (
    <div style={{ fontSize: 11, fontFamily: "var(--font-condensed)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent-gold-ink)", display: "flex", flexWrap: "wrap", gap: "4px 10px", ...style }}>
      {bits.map((b, i) => <span key={i}>{i > 0 && <span aria-hidden="true" style={{ marginRight: 10, opacity: 0.5 }}>·</span>}{b}</span>)}
    </div>
  );
}

// Three lines at most, whatever is in the preview. The preview is already cut
// short by the server; this is the belt that keeps the grid square regardless.
const clampLines = (n) => ({ display: "-webkit-box", WebkitLineClamp: n, WebkitBoxOrient: "vertical", overflow: "hidden" });

export function PostCard({ p, onOpen, compact = false }) {
  return (
    <a href={routeToPath("post", { postSlug: p.slug })} onClick={(e) => { e.preventDefault(); onOpen(); }} className="mr-lift"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", textDecoration: "none" }}>
      <ImageSlot src={p.coverUrl} name={p.title} label={p.tags && p.tags[0]} sizes="(max-width: 640px) 92vw, 400px" style={{ width: "100%", aspectRatio: compact ? "16 / 9" : "3 / 2", height: "auto" }} />
      <div style={{ padding: compact ? "14px 16px 18px" : "18px 20px 22px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <PostMeta p={p} />
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: compact ? 18 : 21, fontWeight: 400, color: "var(--text-strong)", lineHeight: 1.28, margin: 0, ...clampLines(2) }}>{p.title}</h3>
        {p.excerpt && (
          <p style={{ fontSize: 14, color: "var(--text-body)", lineHeight: 1.6, margin: 0, ...clampLines(compact ? 2 : 3) }}>{p.excerpt}</p>
        )}
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mr-orchid-600)", marginTop: "auto", paddingTop: 8 }}>Read the story →</span>
      </div>
    </a>
  );
}

// The newest story, given the width of the page: picture on one side, the
// promise on the other. A blog with one lead and a grid behind it reads as a
// publication; a grid of equals reads as a product listing.
function FeaturedPost({ p, onOpen }) {
  return (
    <a href={routeToPath("post", { postSlug: p.slug })} onClick={(e) => { e.preventDefault(); onOpen(); }} className="mr-lift"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)", textDecoration: "none", marginBottom: 28 }}>
      <ImageSlot src={p.coverUrl} name={p.title} label={p.tags && p.tags[0]} eager sizes="(max-width: 760px) 92vw, 640px" style={{ width: "100%", height: "100%", minHeight: 260, aspectRatio: "4 / 3" }} />
      <div style={{ padding: "clamp(22px, 3.5vw, 44px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
        <span style={{ alignSelf: "flex-start", fontFamily: "var(--font-condensed)", fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", background: "var(--mr-purple-900)", color: "var(--mr-cream)", padding: "5px 10px", borderRadius: "var(--radius-xs)" }}>Latest</span>
        <PostMeta p={p} />
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 3vw, 36px)", fontWeight: 400, color: "var(--text-strong)", lineHeight: 1.18, letterSpacing: "var(--ls-heading)", margin: 0 }}>{p.title}</h2>
        {p.excerpt && <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--text-body)", lineHeight: 1.6, margin: 0, ...clampLines(3) }}>{p.excerpt}</p>}
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--mr-orchid-600)", paddingTop: 6 }}>Read the story →</span>
      </div>
    </a>
  );
}

export function BlogPage({ ctx }) {
  const { blog, settings } = ctx;
  const tag = ctx.blogTag;
  const posts = tag ? blog.posts.filter((p) => p.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) : blog.posts;
  // The lead story only leads the unfiltered page; inside a tag every story is
  // an equal answer to the question the chip asked.
  const [lead, ...rest] = tag ? [null, ...posts] : posts;
  const open = (p) => ctx.nav("post", { postSlug: p.slug });
  const chip = (on, onClick, text, key) => (
    <button key={key} onClick={onClick} style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "8px 16px", borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : "var(--mr-purple-800)" }}>{text}</button>
  );
  return (
    <main style={shellStyle}>
      {/* One word above the grid, not two. "Journal" over "From the blog" was
          the house reading its own blog page and finding neither of them said
          "blog" — so the kicker is gone and the heading is the word itself,
          still overridable in Settings → Editorial. */}
      <PageHead
        title={settings.blogHeadline || "Blog"}
        sub={settings.blogIntro || "How to wear it, how to layer it and how to make it last."}
      />
      {blog.tags.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 26 }}>
          {chip(!tag, () => ctx.setBlogTag(""), "Everything", "all")}
          {blog.tags.map((t) => chip(tag === t, () => ctx.setBlogTag(t), t, t))}
        </div>
      )}
      {!blog.loaded ? (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Opening the blog…</p>
      ) : !posts.length ? (
        <Empty title={tag ? `Nothing filed under “${tag}” yet.` : "The first story is being written."}>
          <Button variant="primary" onClick={() => (tag ? ctx.setBlogTag("") : ctx.nav("shop"))}>{tag ? "Show all posts" : "Shop"}</Button>
        </Empty>
      ) : (
        <>
          {lead && <FeaturedPost p={lead} onOpen={() => open(lead)} />}
          {rest.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 24 }}>
              {rest.map((p) => <PostCard key={p.slug} p={p} onOpen={() => open(p)} />)}
            </div>
          )}
        </>
      )}
    </main>
  );
}

export function BlogPostPage({ ctx }) {
  const wrapper = ctx.post;
  const [copied, setCopied] = useState(false);
  if (!wrapper) return <main style={shellStyle}><p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Fetching the story…</p></main>;
  if (wrapper.error || !wrapper.post) {
    return (
      <main style={shellStyle}>
        <Empty title="That story isn't here.">
          <Button variant="primary" onClick={() => ctx.nav("blog")}>Back to the blog</Button>
        </Empty>
      </main>
    );
  }
  const p = wrapper.post;
  const url = typeof window !== "undefined" ? window.location.href : "";
  // The standfirst is the writer's own preview, shown in full under the title —
  // but only when they wrote one. A preview derived from the opening paragraph
  // would print that paragraph twice.
  const standfirst = p.hasOwnPreview ? p.excerpt : "";
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: p.title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the shopper closed the share sheet */ }
  };
  const pill = { fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "7px 14px", borderRadius: "var(--radius-pill)", border: "1px solid var(--border-hairline)", background: "var(--surface-card)", color: "var(--mr-purple-800)", cursor: "pointer", textDecoration: "none" };
  return (
    <main style={{ padding: `clamp(24px, 4vw, 44px) ${PAD} 0` }}>
      <article style={{ maxWidth: 720, margin: "0 auto" }}>
        <a href="/blog" onClick={(e) => { e.preventDefault(); ctx.nav("blog"); }} style={{ display: "inline-block", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-orchid-600)", fontWeight: 500, marginBottom: 22 }}>← All stories</a>
        <PostMeta p={p} />
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(32px, 4.6vw, 50px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", lineHeight: 1.12, margin: "14px 0 16px" }}>{p.title}</h1>
        {standfirst && <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(18px, 2vw, 21px)", lineHeight: 1.55, color: "var(--text-body)", margin: "0 0 20px" }}>{standfirst}</p>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid var(--border-hairline)", borderBottom: "1px solid var(--border-hairline)", marginBottom: 30 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>By <strong style={{ fontWeight: 600, color: "var(--text-strong)" }}>{p.author || "Majestic Roobee"}</strong></span>
          <span style={{ display: "flex", gap: 8 }}>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${p.title} ${url}`)}`} target="_blank" rel="noopener noreferrer" style={pill}>Share on WhatsApp</a>
            <button onClick={share} style={pill}>{copied ? "Link copied" : "Copy link"}</button>
          </span>
        </div>
      </article>
      {p.coverUrl && (
        <div style={{ maxWidth: 960, margin: "0 auto 36px" }}>
          <img src={p.coverUrl} alt="" style={{ width: "100%", maxHeight: 560, objectFit: "cover", borderRadius: "var(--radius-lg)", display: "block" }} />
        </div>
      )}
      <article style={{ maxWidth: 720, margin: "0 auto" }}>
        <PostBody body={p.body} size={17} />
        {p.tags.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 34 }}>
            {p.tags.map((t) => (
              <button key={t} onClick={() => { ctx.setBlogTag(t); ctx.nav("blog"); }} style={pill}>{t}</button>
            ))}
          </div>
        )}
        <GildedRule width="180px" style={{ margin: "40px 0 0" }} />
      </article>
      {wrapper.more && wrapper.more.length > 0 && (
        <section style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 0 8px" }}>
          <Eyebrow>Keep reading</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 20, marginTop: 16 }}>
            {wrapper.more.map((m) => <PostCard key={m.slug} p={m} compact onOpen={() => ctx.nav("post", { postSlug: m.slug })} />)}
          </div>
        </section>
      )}
    </main>
  );
}

// ---- The Perfume Studio: book a consultation ------------------------------

// The client's ask, exactly: a page of its own where a customer books an hour
// in the studio, with the calendar *on* it — "so customers can complete the
// booking without having to leave the website".
//
// The calendar is Calendly in a plain iframe. No Calendly script: the same
// rule the testimonial embeds follow, which is that nothing third-party runs
// on this store. Calendly's own page inside the frame does its own work, and
// `embed_domain` is what makes it size itself to the space rather than to a
// browser window.
//
// It is never a dead end. Consultations can be open for booking before the
// calendar link exists — that is the normal order, since somebody has to make
// the Calendly first — so a studio with no link yet shows the same page with
// the phone and the contact form in place of the frame, rather than an empty
// rectangle or a 404.
export function ConsultationPage({ ctx }) {
  const c = ctx.consultation;
  const settings = ctx.settings || {};
  const phone = String(settings.contactPhone || "").trim();

  if (!c.on) {
    return (
      <main style={shellStyle}>
        <PageHead title="Consultations aren’t open at the moment" sub="The studio isn’t taking bookings just now. Send us a message and we’ll tell you when it is." />
        <Empty title="Nothing to book today.">
          <Button variant="primary" onClick={() => ctx.nav("contact")}>Send us a message</Button>
        </Empty>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <PageHead eyebrow={c.eyebrow} title={c.headline} sub={c.intro} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: "clamp(24px, 4vw, 44px)", alignItems: "start" }}>
        <div>
          {c.imageUrl && (
            <ImageSlot src={c.imageUrl} shape="rounded" radius={16} name={c.headline}
              sizes="(max-width: 860px) 94vw, 520px" style={{ width: "100%", height: 300, marginBottom: 22 }} />
          )}
          <PostBody body={c.blocks.join("\n\n")} />
          {phone && (
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 22, lineHeight: 1.7 }}>
              Rather talk it through first? Call the studio on{" "}
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} style={{ color: "var(--mr-orchid-600)", fontWeight: 500 }}>{phone}</a>.
            </p>
          )}
        </div>

        <div>
          <GildedRule width="120px" style={{ margin: "0 0 18px" }} />
          <div style={{ fontFamily: "var(--font-condensed)", fontSize: 11.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent-gold-ink)", marginBottom: 14 }}>
            Pick a date and time
          </div>
          {c.hasCalendar ? (
            <div style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface-card)" }}>
              <iframe
                src={c.calendarUrl}
                title={c.ctaLabel}
                loading="lazy"
                style={{ width: "100%", height: "min(1100px, 82vh)", minHeight: 620, border: "none", display: "block" }}
              />
            </div>
          ) : (
            <Empty title={c.fallbackTitle || "The calendar isn’t open yet"}>
              <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7, margin: "0 0 16px", maxWidth: "44ch", marginInline: "auto" }}>
                We’re taking consultations — the online calendar just isn’t connected yet. Send us a message with the days that
                suit you{phone ? ", or call the studio" : ""} and we’ll put you in the book.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <Button variant="primary" onClick={() => ctx.nav("contact")}>Ask for a time</Button>
                {phone && (
                  <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}><Button variant="secondary">Call {phone}</Button></a>
                )}
              </div>
            </Empty>
          )}
        </div>
      </div>
    </main>
  );
}
