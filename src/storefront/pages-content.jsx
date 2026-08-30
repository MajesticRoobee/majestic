// The pages the header's second row leads to: a wishlist, the brands we carry,
// our stores, the reviews wall, and the journal.
import React, { useState } from "react";
import { Eyebrow, GildedRule, Button, ImageSlot } from "../ds/components.jsx";
import { ProductCard } from "./product-card.jsx";
import { routeToPath } from "./router.js";

const PAD = "clamp(16px, 4vw, 40px)";
const shellStyle = { maxWidth: 1280, margin: "0 auto", padding: `clamp(28px, 4vw, 48px) ${PAD}` };

function PageHead({ eyebrow, title, sub }) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "12px 0 6px" }}>{title}</h1>
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
      <PageHead
        eyebrow="Kept for later"
        title="Your wishlist"
        sub={ctx.cust
          ? `Saved to your account — ${ctx.cust.name || ctx.cust.email}. It follows you to any device you sign in on.`
          : "Saved in this browser. Create an account and everything here comes with you."}
      />
      {!ctx.wishlist.length ? (
        <Empty title="Nothing saved yet.">
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 18px" }}>Tap the heart on any piece and it waits for you here.</p>
          <Button variant="primary" onClick={() => ctx.nav("shop")}>Browse the collection</Button>
        </Empty>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 22 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{saved.length} {saved.length === 1 ? "piece" : "pieces"} saved</span>
            {!ctx.cust && (
              <button onClick={() => ctx.nav("account")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--mr-orchid-600)" }}>
                Create an account to keep it —
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
            {saved.map((e) => <ProductCard key={e.key} p={ctx.card(e)} />)}
          </div>
          {missing > 0 && (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 20 }}>
              {missing} saved {missing === 1 ? "piece is" : "pieces are"} no longer on sale — {missing === 1 ? "it will reappear" : "they'll reappear"} here if {missing === 1 ? "it comes" : "they come"} back.
            </p>
          )}
        </>
      )}
    </main>
  );
}

// ---- Brands ---------------------------------------------------------------

export function BrandsPage({ ctx }) {
  const brands = ctx.brands;
  return (
    <main style={shellStyle}>
      <PageHead
        eyebrow="By the label"
        title="Brands we carry"
        sub="Every house on our shelves, and how many pieces of each we hold. Our own blends sit under Majestic Roobee."
      />
      {!brands.length ? (
        <Empty title="Our brands are being catalogued.">
          <Button variant="primary" onClick={() => ctx.nav("shop")}>Shop everything meanwhile</Button>
        </Empty>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(200px, 100%), 1fr))", gap: 16 }}>
          {brands.map((b) => (
            <a key={b.id} href={routeToPath("shop", { fBrand: b.id })} onClick={(e) => { e.preventDefault(); ctx.nav("shop", { fBrand: b.id }); }} className="mr-lift"
              style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)", display: "block" }}>
              <ImageSlot src={b.imageUrl} name={b.name} sizes="200px" style={{ width: "100%", height: 130 }} />
              <div style={{ padding: "14px 16px 16px" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)" }}>{b.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{b.count} {b.count === 1 ? "piece" : "pieces"}</div>
              </div>
            </a>
          ))}
        </div>
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
        eyebrow="Come and see us"
        title="Our stores"
        sub="Every door we keep open. Order online and collect from any of them, or walk in and be talked through the whole shelf."
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
                  Shop the {l.city} shelf
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 32, padding: "22px 24px", background: "var(--surface-sunken)", borderRadius: "var(--radius-lg)", fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.7 }}>
        Not near a store? We deliver nationwide, and worldwide in Naira or US Dollars — pick anything and we ship it from whichever store holds your whole order.
        {settings.contactPhone && <> Questions before you travel: <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`}>{settings.contactPhone}</a>.</>}
      </div>
    </main>
  );
}

// ---- Reviews & testimonials ----------------------------------------------

// One testimonial. An Instagram, TikTok or YouTube post is rendered as that
// platform's own embed inside an iframe — no third-party script runs on the
// page, so nothing here can slow the store down or watch the shopper. A stored
// video file plays inline; anything else is a plain quote card.
export function EmbedCard({ t, height = 480 }) {
  const frameStyle = { width: "100%", height, border: "none", display: "block", background: "var(--surface-sunken)" };
  const shell = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column" };
  const byline = (
    (t.author || t.handle || t.city) && (
      <div style={{ padding: "12px 16px 14px", borderTop: t.kind === "quote" ? "none" : "1px solid var(--border-hairline)" }}>
        {t.author && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{t.author}</div>}
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
      <div style={shell}>
        <video src={t.embedUrl} controls playsInline poster={t.thumbUrl || undefined} style={{ ...frameStyle, objectFit: "cover" }} />
        {byline}
      </div>
    );
  }
  if (t.embedUrl) {
    return (
      <div style={shell}>
        <iframe
          src={t.embedUrl}
          title={t.author ? `${t.author} on ${t.kind}` : `A customer post on ${t.kind}`}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          scrolling="no"
          style={frameStyle}
        />
        {byline}
      </div>
    );
  }
  return (
    <div style={{ ...shell, padding: "26px 24px", justifyContent: "space-between", gap: 16 }}>
      <div>
        <div aria-label={`${t.rating} out of 5`} style={{ color: "var(--accent-gold-ink)", fontSize: 14, letterSpacing: 2 }}>{"★".repeat(Math.max(1, Math.min(5, t.rating || 5)))}</div>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, lineHeight: 1.6, color: "var(--text-body)", margin: "14px 0 0" }}>“{t.quote}”</p>
      </div>
      {byline}
    </div>
  );
}

export function ReviewsPage({ ctx }) {
  const { testimonials, settings } = ctx;
  const [kind, setKind] = useState("all");
  const kinds = [...new Set(testimonials.map((t) => t.kind))];
  const list = kind === "all" ? testimonials : testimonials.filter((t) => t.kind === kind);
  const label = { instagram: "Instagram", tiktok: "TikTok", youtube: "Video", video: "Video", quote: "Written" };
  const chip = (on, onClick, text, key) => (
    <button key={key} onClick={onClick} style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "8px 16px", borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : "var(--mr-purple-800)" }}>{text}</button>
  );
  return (
    <main style={shellStyle}>
      <PageHead
        eyebrow="In their own words"
        title={settings.reviewsHeadline || "Reviews & testimonials"}
        sub={settings.reviewsIntro || "Posts our customers made themselves, embedded exactly as they published them — nothing here is written by us."}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))", gap: 20, alignItems: "start" }}>
          {list.map((t) => <EmbedCard key={t.id} t={t} />)}
        </div>
      )}
    </main>
  );
}

// ---- The journal ----------------------------------------------------------

// Posts are written as plain text: blank lines separate paragraphs, a line
// starting "## " is a heading, and a line that is only a URL is an image. That
// is enough for the house to write in, and it means nothing user-supplied is
// ever handed to dangerouslySetInnerHTML.
export function PostBody({ body }) {
  const blocks = String(body || "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) {
          return <h2 key={i} style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.4vw, 28px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "10px 0 0" }}>{b.slice(3).trim()}</h2>;
        }
        if (/^https?:\/\/\S+$/.test(b)) {
          return <img key={i} src={b} alt="" loading="lazy" style={{ width: "100%", borderRadius: "var(--radius-lg)", display: "block" }} />;
        }
        if (b.startsWith("> ")) {
          return (
            <blockquote key={i} style={{ margin: 0, padding: "4px 0 4px 18px", borderLeft: "2px solid var(--mr-gold-400)", fontFamily: "var(--font-serif)", fontSize: 19, lineHeight: 1.6, color: "var(--text-body)" }}>
              {b.slice(2).trim()}
            </blockquote>
          );
        }
        return <p key={i} style={{ fontSize: 15.5, lineHeight: 1.85, color: "var(--text-body)", margin: 0, whiteSpace: "pre-line" }}>{b}</p>;
      })}
    </div>
  );
}

function PostCard({ p, onOpen, height = 190 }) {
  return (
    <a href={routeToPath("post", { postSlug: p.slug })} onClick={(e) => { e.preventDefault(); onOpen(); }} className="mr-lift"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column" }}>
      <ImageSlot src={p.coverUrl} name={p.title} sizes="(max-width: 640px) 92vw, 340px" style={{ width: "100%", height }} />
      <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ fontSize: 11, fontFamily: "var(--font-condensed)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          {p.published || "Journal"}{p.tags && p.tags.length ? ` · ${p.tags[0]}` : ""}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text-strong)", lineHeight: 1.3 }}>{p.title}</div>
        {p.excerpt && <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{p.excerpt}</p>}
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--mr-orchid-600)", marginTop: "auto", paddingTop: 8 }}>Read it —</span>
      </div>
    </a>
  );
}

export function BlogPage({ ctx }) {
  const { blog, settings } = ctx;
  const tag = ctx.blogTag;
  const posts = tag ? blog.posts.filter((p) => p.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) : blog.posts;
  const chip = (on, onClick, text, key) => (
    <button key={key} onClick={onClick} style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "8px 16px", borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : "var(--mr-purple-800)" }}>{text}</button>
  );
  return (
    <main style={shellStyle}>
      <PageHead
        eyebrow="From the house"
        title={settings.blogHeadline || "The journal"}
        sub={settings.blogIntro || "How to wear it, how to layer it, how to make it last — and what we're blending next."}
      />
      {blog.tags.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {chip(!tag, () => ctx.setBlogTag(""), "Everything", "all")}
          {blog.tags.map((t) => chip(tag === t, () => ctx.setBlogTag(t), t, t))}
        </div>
      )}
      {!blog.loaded ? (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Opening the journal…</p>
      ) : !posts.length ? (
        <Empty title={tag ? `Nothing filed under “${tag}” yet.` : "The first story is being written."}>
          <Button variant="primary" onClick={() => (tag ? ctx.setBlogTag("") : ctx.nav("shop"))}>{tag ? "Show everything" : "Browse the collection"}</Button>
        </Empty>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 20 }}>
          {posts.map((p) => <PostCard key={p.slug} p={p} onOpen={() => ctx.nav("post", { postSlug: p.slug })} />)}
        </div>
      )}
    </main>
  );
}

export function BlogPostPage({ ctx }) {
  const wrapper = ctx.post;
  if (!wrapper) return <main style={shellStyle}><p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Fetching the story…</p></main>;
  if (wrapper.error || !wrapper.post) {
    return (
      <main style={shellStyle}>
        <Empty title="That story isn't here.">
          <Button variant="primary" onClick={() => ctx.nav("blog")}>Back to the journal</Button>
        </Empty>
      </main>
    );
  }
  const p = wrapper.post;
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: `clamp(28px, 4vw, 48px) ${PAD}` }}>
      <button onClick={() => ctx.nav("blog")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-orchid-600)", fontWeight: 500, padding: 0, marginBottom: 18 }}>← The journal</button>
      <Eyebrow>{p.published || "Journal"}</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4.4vw, 46px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", lineHeight: 1.15, margin: "14px 0 10px" }}>{p.title}</h1>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 22 }}>
        {p.author}{p.tags.length ? ` · ${p.tags.join(" · ")}` : ""}
      </div>
      {p.coverUrl && <img src={p.coverUrl} alt="" style={{ width: "100%", borderRadius: "var(--radius-lg)", display: "block", marginBottom: 26 }} />}
      <PostBody body={p.body} />
      <GildedRule width="180px" style={{ margin: "40px 0 26px" }} />
      {wrapper.more && wrapper.more.length > 0 && (
        <>
          <Eyebrow>Keep reading</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 18, marginTop: 16 }}>
            {wrapper.more.map((m) => <PostCard key={m.slug} p={m} height={140} onOpen={() => ctx.nav("post", { postSlug: m.slug })} />)}
          </div>
        </>
      )}
    </main>
  );
}
