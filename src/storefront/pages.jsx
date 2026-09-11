// Storefront pages — ported from "Majestic Roobee Storefront.dc.html".
import React, { useState } from "react";
import { Eyebrow, GildedRule, Badge, Button, Input, Textarea, ImageSlot } from "../ds/components.jsx";
import { ProductCard } from "./product-card.jsx";
import { routeToPath } from "./router.js";
import { EmbedCard, TestimonialCarousel } from "./pages-content.jsx";
import { DailyDealCard } from "./daily-deal.jsx";
import { catFamily, catPath, countIn } from "../lib/categories.js";

export { ProductCard };
export { WishlistPage, LocationsPage, ReviewsPage, BlogPage, BlogPostPage, PostBody, FaqPage } from "./pages-content.jsx";
export { EmbedCard, TestimonialCarousel };

const PAD = "clamp(16px, 4vw, 40px)";

// The three banners under the homepage hero. Fixed shelves rather than editable
// blocks: what changes is the photograph behind each (Settings → Homepage), not
// which three the store leads with.
const PROMO_TILES = [
  { id: "deals", setting: "promoTileDeals", kicker: "On sale now", title: "Deals", href: "/deals", extra: { fSeg: "deals", fCat: "all" }, veil: "linear-gradient(0deg, rgba(37,20,50,0.9), rgba(37,20,50,0.12))" },
  { id: "new", setting: "promoTileNew", kicker: "Just in", title: "New Arrivals", href: "/new-arrivals", extra: { fSeg: "new-arrivals", fCat: "all" }, veil: "linear-gradient(0deg, rgba(61,35,80,0.9), rgba(61,35,80,0.12))" },
  { id: "sets", setting: "promoTileSets", kicker: "Ready to give", title: "Gift Sets", href: "/gift-sets", extra: { fSeg: "gift-sets", fCat: "all" }, veil: "linear-gradient(0deg, rgba(90,45,110,0.9), rgba(90,45,110,0.12))" },
];

// The founder's story, exactly as the client wrote it. The About page runs it
// in full; the homepage shows the opening paragraph and links through.
const STORY_TITLE = "How I never set out to build a fragrance brand";
const STORY = [
  "My name is Peace Ijeoma Jonathan, founder of Majesticroobee. Most people assume this story began with perfume. It didn't. It began with a woman waiting to become a mother. There was a season in my life when I was trusting God for a child. It was a quiet season filled with prayers, hope, questions and waiting. Someone once told me that if I was to believe in God for children, I should spend more time around children. I held on to those words and moved straight to get a job in a school. At the time, I thought I was simply giving my heart something meaningful to do while I waited on God. I had no idea that the place I entered because I was waiting would become the place where He was quietly preparing me for work I never imagined I would one day do.",
  "The children quickly became part of my heart, but so did their mothers. Every conversation, every school run and every interaction reminded me that every woman was carrying something, even when she smiled. Somewhere in the middle of that season, one of my colleagues introduced me to someone who brought attars into Nigeria. At the time, hardly anyone knew what they were. I was fascinated. I had always loved beautiful scents, but this was different. It opened a world I couldn't stop exploring. I learnt, I practised, I asked questions, and I kept learning. What started as curiosity slowly became purpose, and over the years that journey led me to become an internationally certified natural perfumer. Looking back now, I realise that what felt like an ordinary introduction was one of the quiet miracles hidden inside my season of waiting.",
  "Life continued to unfold, and I became a mother. Motherhood changed me in ways I never expected. It introduced me to depths of love I had never known, but it also introduced me to a kind of grief that words still struggle to hold. Long before people came to know the name Majesticroobee, there was a little girl named Ruby. She lived for only twenty days, but she changed me forever. Losing her broke something in me, but it also awakened something in me. It made me pay closer attention to women, to our bodies, to our emotions and to the battles we carry without anyone noticing. I had lived through the waiting, the pregnancy, the birth, the joy, the loss, the hormonal changes, the exhaustion, the isolation and the quiet search for myself again. As I spoke with more women, I realised I wasn't alone. Different homes, different stories, but the same questions. The same desire to feel whole again. The same longing to understand our bodies deeply, to feel like ourselves again. The same hope that somewhere beneath everything life had placed on us, we could still find ourselves.",
  "As I searched for answers for myself, I found myself searching for answers for other women too. I enrolled in schools, studied relentlessly and refused to stop asking questions. The more I learnt, the more I understood that what a woman puts on her body is never just about appearance. It touches her emotions, her confidence, her memories, her routines and sometimes even the way she sees herself. Around the same time, I found myself thinking often about my own mother. I grew up in a very Nigerian home with a very Nigerian mother who believed that cleanliness, good character and intentional living mattered. She read labels, questioned ingredients and paid close attention to what entered our home. She loved looking beautiful and smelling beautiful, but she never believed beauty should come at the expense of her health. She also never allowed motherhood to erase the woman she was. She continued to care for herself with grace and intention, and although I didn't know it then, she was quietly planting seeds that would later shape everything I believed about women's wellness and self-care.",
  "As the years passed, every part of my journey slowly came together. The waiting. The classroom. The mothers I had met. My own experiences of womanhood. The lessons my mother had quietly lived before me. The years of studying natural perfumery and understanding the connection between scent, emotion and wellbeing. Then life carried me to Bonny Island. It was there that everything I had been learning finally found people. For the first time, women were not just hearing me talk about fragrance; they were experiencing it for themselves. They wore the products, shared their honest experiences, came back for more and introduced them to other women. Watching those conversations happen made something very clear to me. This was no longer just something I loved. It had become something that genuinely served women. It was also in Bonny Island that the vision became clear enough to give it a name. I called it Majesticroobee. It is a name that carries love, but it also carries strength, courage and resilience. More importantly, it carries a responsibility. Today, we are building for the women who are here, for the little girls who are quietly becoming tomorrow's women and for the generations still waiting to arrive. Every decision we make is guided by one belief: every woman deserves to feel safe in her body, confident in herself and deeply connected to who she is, no matter what season of life she is walking through.",
  "Today, when people ask me how I built a fragrance brand, I smile because I know the answer has very little to do with perfume. This brand was built in classrooms, in hospital rooms, in seasons of waiting, in motherhood, in grief, in healing and in years of learning how to care for women well. Every bottle we make carries a small piece of that journey. Majesticroobee is more than the name of a company. It is the story of where God met me, where He restored me and where He gave purpose to every season I once struggled to understand. ",
];

// One section heading: the small line above, the heading, the line under it,
// and — on a row of products — the link to the rest.
function SectionHead({ eyebrow, title, sub, centred = false, action = null }) {
  const head = (
    <div style={{ maxWidth: "62ch", ...(centred ? { margin: "0 auto" } : null) }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 3vw, 36px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "10px 0 0" }}>{title}</h2>
      {sub && <p style={{ fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.7, margin: "8px 0 0" }}>{sub}</p>}
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22, textAlign: centred ? "center" : "left" }}>
      {head}
      {action}
    </div>
  );
}

// A heading, a line or two, and one button — the shape every "go and look at
// this part of the shop" block on the homepage takes.
function CtaBand({ title, lines, cta, onClick, dark = false }) {
  return (
    <section style={{ maxWidth: 1280, margin: "clamp(40px, 7vw, 72px) auto 0", padding: `0 ${PAD}` }}>
      <div style={{ background: dark ? "var(--royal-wash)" : "var(--surface-card)", border: dark ? "none" : "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "clamp(26px, 4vw, 44px)", display: "flex", flexWrap: "wrap", gap: 22, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ maxWidth: "54ch" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.6vw, 30px)", color: dark ? "var(--mr-cream)" : "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: 0 }}>{title}</h2>
          {lines.map((l) => (
            <p key={l} style={{ fontSize: 14.5, lineHeight: 1.7, color: dark ? "var(--text-on-dark-muted)" : "var(--text-muted)", margin: "10px 0 0" }}>{l}</p>
          ))}
        </div>
        <Button variant={dark ? "gold" : "primary"} size="lg" onClick={onClick}>{cta}</Button>
      </div>
    </section>
  );
}

// How the rewards work, in the four steps the client wrote.
const REWARD_STEPS = [
  { step: "Shop", copy: "Purchase your favourite Majestic Roobee products." },
  { step: "Earn", copy: "Collect points with every qualifying purchase." },
  { step: "Redeem", copy: "Turn your points into rewards." },
  { step: "Enjoy", copy: "Come back for more of the scents you love." },
];

// The newsletter block. It feeds the same list as the first-order pop-up, so
// an address left here reaches the store the same way.
function NewsletterSignup({ ctx }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const join = () => { if (ctx.joinList(email, "newsletter")) setDone(true); };
  return (
    <section style={{ maxWidth: 1280, margin: "clamp(40px, 7vw, 72px) auto 0", padding: `0 ${PAD}` }}>
      <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-lg)", padding: "clamp(28px, 4vw, 48px)", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.6vw, 30px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: 0 }}>Join the list</h2>
        <p style={{ fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.7, margin: "10px auto 20px", maxWidth: "54ch" }}>
          Be the first to know about new scents, restocks, special offers and everything happening at Majestic Roobee.
        </p>
        {done ? (
          <p style={{ fontSize: 14, color: "var(--mr-purple-900)", fontWeight: 500, margin: 0 }}>You&apos;re on the list. Watch your inbox.</p>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 460, margin: "0 auto" }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join()}
              type="email" aria-label="Your email address" placeholder="Enter your email address"
              style={{ flex: "1 1 220px", minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 14, padding: "12px 14px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", color: "var(--text-strong)", background: "var(--surface-card)" }} />
            <Button variant="primary" onClick={join}>Join the list</Button>
          </div>
        )}
      </div>
    </section>
  );
}

export function HomePage({ ctx }) {
  const { settings, products, categories, cityName, L, testimonials, latestPosts } = ctx;
  // Four products from whatever is marked down right now, and the deal they sit
  // under when there is exactly one running — a strip that names its reason.
  const dealIds = (ctx.segments.deals || []).slice(0, 4);
  const dealPicks = dealIds.map((id) => ctx.listings.find((e) => e.product.id === id)).filter(Boolean).map(ctx.card).filter(Boolean);
  const runningDeal = ctx.deals.length === 1 ? ctx.deals[0] : null;
  // Four best sellers, in the order the server ranked them.
  const bestPicks = (ctx.segments["best-sellers"] || []).slice(0, 4)
    .map((id) => ctx.listings.find((e) => e.product.id === id)).filter(Boolean).map(ctx.card).filter(Boolean);
  const dir = settings.heroDirection || "storefront grid";
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
      {dir === "storefront grid" && (
        <>
          {/* Three columns, and the first is deliberately empty: it is the
              width of the header's category rail, which stands open over it on
              this page. The banner takes the middle, the daily deal the right.
              A phone gets one column and the deal card below the tiles. */}
          <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(18px, 2.6vw, 30px) ${PAD} 0`, display: "grid", gridTemplateColumns: ctx.isMobile ? "minmax(0, 1fr)" : "250px minmax(0, 1fr) 300px", gap: "clamp(16px, 1.8vw, 24px)", alignItems: "start" }}>
            {!ctx.isMobile && <div />}
            <div style={{ minWidth: 0 }}>
              <div style={{ position: "relative", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                {/* No placeholder caption on this one: the wash and the
                    headline already sit on top of it, and a second line of
                    grey type showing through them reads as a fault. */}
                <ImageSlot src={settings.heroImage} eager name="Majestic Roobee" sizes="(max-width: 860px) 92vw, 720px"
                  style={{ width: "100%", height: "clamp(320px, 34vw, 420px)" }} />
                {/* The wash is heaviest where the words are and clears to the
                    right, so the photograph still reads as a photograph. */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(61,35,80,0.86) 0%, rgba(61,35,80,0.52) 48%, rgba(61,35,80,0.06) 100%)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, padding: "clamp(24px, 4vw, 48px)", pointerEvents: "none" }}>
                  <span style={{ fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold)" }}>Perfumes · Perfume oils · Body mists · Feminine care</span>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 3.4vw, 46px)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)", color: "var(--mr-cream)", margin: 0, maxWidth: "20ch", whiteSpace: "pre-line" }}>{settings.heroHeadline}</h1>
                  <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(16px, 1.5vw, 19px)", lineHeight: 1.5, color: "var(--text-on-dark-muted)", maxWidth: "34ch", margin: 0 }}>{settings.heroSub}</p>
                  <div style={{ display: "flex", pointerEvents: "auto", marginTop: 4 }}>
                    <Button variant="gold" size="lg" onClick={() => ctx.nav("shop")}>Shop fragrances</Button>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "clamp(12px, 1.4vw, 18px)", marginTop: "clamp(12px, 1.4vw, 18px)" }}>
                {PROMO_TILES.map((t) => (
                  <a key={t.id} href={t.href} onClick={(e) => { e.preventDefault(); ctx.nav("shop", t.extra); }}
                    style={{ position: "relative", display: "block", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                    <ImageSlot src={settings[t.setting]} name={t.title} sizes="(max-width: 860px) 92vw, 240px" style={{ width: "100%", height: 150 }} />
                    <span style={{ position: "absolute", inset: 0, background: t.veil, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 4, padding: 16 }}>
                      <span style={{ fontFamily: "var(--font-condensed)", fontSize: 10, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold)" }}>{t.kicker}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--mr-cream)", lineHeight: 1.15 }}>{t.title}</span>
                    </span>
                  </a>
                ))}
              </div>
              {/* On a phone the deal follows the tiles at full width rather
                  than disappearing — most of this shop is read on a phone. */}
              {ctx.isMobile && <DailyDealCard ctx={ctx} style={{ marginTop: "clamp(12px, 1.4vw, 18px)" }} />}
            </div>
            {!ctx.isMobile && <DailyDealCard ctx={ctx} />}
          </section>
        </>
      )}
      {dir === "editorial split" && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 88px) ${PAD}`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", gap: "clamp(28px, 5vw, 64px)", alignItems: "center" }}>
          <div>
            <Eyebrow>Perfumes · Perfume oils · Body mists · Feminine care</Eyebrow>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(38px, 5.4vw, 64px)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)", color: "var(--text-strong)", margin: "18px 0 0", whiteSpace: "pre-line" }}>{settings.heroHeadline}</h1>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(19px, 2vw, 23px)", lineHeight: 1.5, color: "var(--text-body)", maxWidth: "46ch", margin: "22px 0 30px" }}>{settings.heroSub}</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="primary" size="lg" onClick={() => ctx.nav("shop")}>Shop fragrances</Button>
              <Button variant="ghost" size="lg" onClick={() => ctx.nav("about")}>Our story</Button>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 34, fontSize: 12.5, color: "var(--text-muted)" }}>
              <span style={{ width: 22, height: 1, background: "var(--mr-gold-500)" }} />
              Delivering to {cityName} from our {L ? L.store : "store"}
            </div>
          </div>
          <div style={{ position: "relative", minHeight: 380 }}>
            <div style={{ position: "absolute", inset: "24px -8px -8px 24px", border: "1px solid var(--mr-gold-400)", borderRadius: "var(--radius-lg)", pointerEvents: "none" }} />
            <ImageSlot src={settings.heroImage} eager shape="rounded" radius={16} name="Majestic Roobee" sizes="(max-width: 860px) 92vw, 600px"
              label="Warm editorial hero — bottle on silk" style={{ width: "100%", height: 460 }} />
          </div>
        </section>
      )}
      {dir === "royal statement" && (
        <section style={{ background: settings.heroImage ? `linear-gradient(rgba(36,20,48,0.72), rgba(36,20,48,0.72)), url("${settings.heroImage}") center/cover` : "var(--royal-wash)", textAlign: "center", padding: `clamp(64px, 10vw, 130px) ${PAD}` }}>
          <Eyebrow tone="light">Majestic Roobee</Eyebrow>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px, 6.4vw, 84px)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)", color: "var(--mr-cream)", margin: "22px auto 0", maxWidth: "18ch", whiteSpace: "pre-line" }}>{settings.heroHeadline}</h1>
          <GildedRule width="220px" style={{ margin: "18px auto" }} />
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(18px, 2vw, 22px)", color: "var(--text-on-dark-muted)", maxWidth: "52ch", margin: "0 auto 34px" }}>{settings.heroSub}</p>
          <Button variant="gold" size="lg" onClick={() => ctx.nav("shop")}>Shop fragrances</Button>
        </section>
      )}
      {dir === "product-led" && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 6vw, 72px) ${PAD}` }}>
          <div style={{ maxWidth: 640 }}>
            <Eyebrow>Featured</Eyebrow>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px, 4.6vw, 56px)", lineHeight: "var(--lh-tight)", letterSpacing: "var(--ls-display)", color: "var(--text-strong)", margin: "16px 0 12px" }}>This month&apos;s favourites</h1>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text-body)", margin: "0 0 30px" }}>Three fragrances our customers keep coming back for.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(250px, 100%), 1fr))", gap: 20 }}>
            {heroPicks.map((hp) => (
              <div key={hp.key} onClick={hp.open} style={{ cursor: "pointer", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                <ImageSlot src={hp.imageUrl} name={hp.name} eager sizes="(max-width: 640px) 92vw, 300px" style={{ width: "100%", height: 240 }} />
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
            "Delivered from your nearest store", "Your order ships from the store that has everything you chose."
          )}
          {perk(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
            "Secure payment", "Card, bank transfer, or order on WhatsApp."
          )}
          {perk(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>,
            "Worldwide delivery", "Naira and US Dollar pricing, delivered anywhere."
          )}
        </div>
      </section>

      {/* Shop by category. The tiles are the live category tree, so this can
          never disagree with the menu in the header. */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0` }}>
        <SectionHead centred eyebrow="Shop by category" title="Find Your Fragrance"
          sub="Whatever you're in the mood for, there's a fragrance for it." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 14 }}>
          {categories.filter((c) => !c.parentId).map((c) => {
            const n = countIn(categories, products, c.id);
            return (
              <button key={c.id} className="mr-lift" onClick={() => ctx.nav("shop", { fCat: c.id, fSeg: null, fBrand: "", fCol: null })} style={{ cursor: "pointer", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "22px 14px", textAlign: "center", fontFamily: "var(--font-sans)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--mr-purple-900)" }}>{c.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5 }}>{n} {n === 1 ? "product" : "products"}</div>
              </button>
            );
          })}
        </div>
      </section>

      <CtaBand
        title="The products your intimate area needs"
        lines={["Looking for a safe product for your intimate area?", "Shop our plant-based and non-toxic intimate care."]}
        cta="Shop feminine care"
        onClick={() => ctx.nav("shop", { fCat: "care", fSeg: null, fBrand: "", fCol: null })}
      />

      {/* Best sellers — the server decides what has actually sold, so this is
          never a hand-picked list that has quietly gone out of date. */}
      {bestPicks.length > 0 && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0` }}>
          <SectionHead
            eyebrow="Best sellers"
            title="The fragrance everyone is talking about"
            sub="Not sure where to start? Start with the fragrances our customers keep coming back for."
            action={<a href="/best-sellers" onClick={(e) => { e.preventDefault(); ctx.nav("shop", { fSeg: "best-sellers" }); }} style={{ fontSize: 13.5, fontWeight: 500 }}>Shop best sellers</a>}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
            {bestPicks.map((p) => <ProductCard key={p.key} p={p} />)}
          </div>
        </section>
      )}

      {inCity.length > 0 && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(36px, 6vw, 64px) ${PAD} 0` }}>
          <SectionHead
            eyebrow={`In ${cityName} now`}
            title="Ready at your store today"
            action={<a href="/shop" onClick={(e) => { e.preventDefault(); ctx.nav("shop"); }} style={{ fontSize: 13.5, fontWeight: 500 }}>View all products</a>}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
            {inCity.map((p) => <ProductCard key={p.key} p={p} />)}
          </div>
        </section>
      )}

      {dealPicks.length > 0 && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(36px, 6vw, 64px) ${PAD} 0` }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
            <div>
              <Eyebrow>On sale now</Eyebrow>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 3vw, 36px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "10px 0 0" }}>
                {runningDeal ? runningDeal.title : "Hot deals"}
              </h2>
              {runningDeal && runningDeal.desc && <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "6px 0 0", maxWidth: "58ch" }}>{runningDeal.desc}</p>}
            </div>
            <a href="/deals" onClick={(e) => { e.preventDefault(); ctx.nav("shop", { fSeg: "deals" }); }} style={{ fontSize: 13.5, fontWeight: 500 }}>See all deals</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
            {dealPicks.map((p) => <ProductCard key={p.key} p={p} />)}
          </div>
        </section>
      )}

      <CtaBand
        title="What's your fragrance personality?"
        lines={[
          "Are you soft and feminine? Warm and sensual? Fresh and effortless? Bold and commanding?",
          "There's a fragrance for every version of you.",
        ]}
        cta="Find your signature scent"
        onClick={() => ctx.nav("shop", { fCat: "perfumes", fSeg: null, fBrand: "", fCol: null })}
        dark
      />

      <CtaBand
        title="Your home deserves a signature scent too"
        lines={["Explore our collection of home fragrances created to make your space feel warmer, fresher and more inviting."]}
        cta="Shop home fragrance"
        onClick={() => ctx.nav("shop", { fCat: "home", fSeg: null, fBrand: "", fCol: null })}
      />

      {/* The founder's story. The opening paragraph stands here and the rest is
          on the About page, so the homepage introduces it rather than running
          two thousand words before the shopper reaches the reviews. */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0` }}>
        <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "clamp(26px, 4vw, 48px)" }}>
          <Eyebrow>Our story</Eyebrow>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 3vw, 34px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "10px 0 16px", maxWidth: "22ch" }}>{STORY_TITLE}</h2>
          <p style={{ fontFamily: "var(--font-editorial)", fontSize: 16, lineHeight: "var(--lh-relaxed)", color: "var(--text-body)", maxWidth: "72ch", margin: "0 0 20px" }}>{STORY[0]}</p>
          <Button variant="secondary" onClick={() => ctx.nav("about")}>Read our story</Button>
        </div>
      </section>

      {/* Rewards. The points themselves are not built yet — this section says
          what the programme is, and the button sends people to the shop. */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0` }}>
        <SectionHead centred eyebrow="Rewards" title="The more you shop, the more you earn"
          sub="Every qualifying purchase earns you points that you can redeem for rewards on future orders." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 14 }}>
          {REWARD_STEPS.map((r, i) => (
            <div key={r.step} style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: "22px 22px 24px" }}>
              <div style={{ fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)" }}>Step {i + 1}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-strong)", margin: "8px 0 6px" }}>{r.step}</div>
              <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65 }}>{r.copy}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
          <Button variant="primary" size="lg" onClick={() => ctx.nav("shop")}>Shop to earn your points</Button>
        </div>
      </section>

      {/* Reviews & testimonials — the customers' own posts, on a rail that moves
          on its own. They are added and removed under Reviews in the admin;
          nothing in this section is written into the page. */}
      {testimonials.length > 0 && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0` }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
            <div>
              <Eyebrow>Reviews</Eyebrow>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 3vw, 36px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "10px 0 0" }}>
                {settings.reviewsHeadline || "Don't just take our word for it"}
              </h2>
            </div>
            <a href="/reviews" onClick={(e) => { e.preventDefault(); ctx.nav("reviews"); }} style={{ fontSize: 13.5, fontWeight: 500 }}>Read all reviews</a>
          </div>
          {/* The rail has its own gutter, so it pulls back level with the grids
              above and below it. */}
          <div style={{ margin: "0 -10px" }}>
            <TestimonialCarousel items={testimonials.slice(0, 9)} />
          </div>
        </section>
      )}

      {/* The blog — three most recent stories. */}
      {latestPosts.length > 0 && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: `clamp(40px, 7vw, 72px) ${PAD} 0` }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
            <div>
              <Eyebrow>Journal</Eyebrow>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 3vw, 36px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "10px 0 0" }}>
                {settings.blogHeadline || "From the blog"}
              </h2>
            </div>
            <a href="/blog" onClick={(e) => { e.preventDefault(); ctx.nav("blog"); }} style={{ fontSize: 13.5, fontWeight: 500 }}>Read the blog</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 20 }}>
            {latestPosts.map((p) => (
              <a key={p.slug} href={`/blog/${p.slug}`} onClick={(e) => { e.preventDefault(); ctx.nav("post", { postSlug: p.slug }); }} className="mr-lift"
                style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column" }}>
                <ImageSlot src={p.coverUrl} name={p.title} sizes="(max-width: 640px) 92vw, 300px" style={{ width: "100%", height: 170 }} />
                <div style={{ padding: "16px 18px 20px" }}>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-condensed)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)" }}>{p.published || "Blog"}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18.5, color: "var(--text-strong)", marginTop: 6, lineHeight: 1.3 }}>{p.title}</div>
                  {p.excerpt && <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65, margin: "6px 0 0" }}>{p.excerpt}</p>}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <NewsletterSignup ctx={ctx} />

      {settings.igUrl && (
        <section style={{ maxWidth: 1280, margin: "clamp(40px, 7vw, 72px) auto 0", padding: `0 ${PAD}` }}>
          <div style={{ textAlign: "center" }}>
            <Eyebrow>Instagram</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 2.6vw, 30px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "10px 0 0" }}>Follow the fragrance</h2>
            <p style={{ fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.7, margin: "10px auto 6px", maxWidth: "54ch" }}>
              Come behind the scenes, discover new fragrances and see what&apos;s happening at Majestic Roobee.
            </p>
            <div style={{ fontFamily: "var(--font-condensed)", fontSize: 12, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)", marginBottom: 18 }}>
              {settings.igHandle || "@majesticroobee"}
            </div>
            <a href={settings.igUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, color: "var(--mr-purple-900)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "12px 24px" }}>
              Follow us on Instagram
            </a>
          </div>
        </section>
      )}
    </main>
  );
}

// The shop grid, and every page in the header that leads to it.
//
// "New arrivals", "Best sellers", "Deals" and "Gift sets" are this same grid
// with one filter already applied — which products are in each is the server's
// answer (worker/merch.js), so the browser never has to decide what counts as
// new or what has sold well. Category, sub-category, brand, collection and
// search all compose, so "gift sets in body mists" is one address.
const SEGMENT_COPY = {
  "new-arrivals": { eyebrow: "New in", title: "New arrivals", sub: "The newest products in the store, newest first." },
  "best-sellers": { eyebrow: "Best sellers", title: "Best sellers", sub: "The products our customers keep coming back for." },
  deals: { eyebrow: "On sale now", title: "Deals" },
  "gift-sets": { eyebrow: "Ready to give", title: "Gift sets", sub: "Fragrance, mist and custom-oil sets, boxed and ready to give." },
};

// The shop page with nothing narrowed down, in the client's words.
const SHOP_TITLE = "Shop Majestic Roobee products";
const SHOP_SUB = "From everyday signature fragrances to fragrances reserved for special moments, plus wellness products made with you in mind, discover our collection of perfumes, perfume oils, body mists, feminine care, and home fragrances. Find something that smells like you.";

export function ShopPage({ ctx }) {
  const { listings, categories, collections, cityName, segments } = ctx;
  const searching = !!ctx.search.trim();
  const collection = collections.find((c) => c.id === ctx.fCol) || null;
  const seg = ctx.fSeg && segments[ctx.fSeg] ? ctx.fSeg : null;
  const segIds = seg ? segments[seg] : null;
  const segRank = segIds ? new Map(segIds.map((id, i) => [id, i])) : null;
  const segCopy = seg ? SEGMENT_COPY[seg] : null;
  const brand = ctx.fBrand ? ctx.brands.find((b) => b.id === ctx.fBrand) : null;
  const brandName = brand ? brand.name : ctx.fBrand;
  const activeCat = categories.find((c) => c.id === ctx.fCat) || null;
  // A category is itself and everything under it: "Perfume Oils" is the
  // designer oils and the custom oils, not the nothing filed on the parent.
  const catIds = catFamily(categories, ctx.fCat);
  // ["Perfume Oils", "Designer Oils"] when a sub-category is open, so the page
  // says where the shopper is.
  const trail = activeCat ? catPath(categories, activeCat.id) : [];
  // The deals running right now, so the Deals page names them rather than
  // showing a wall of discounted products with no reason attached.
  const runningDeals = seg === "deals" ? ctx.deals.filter((d) => d.productIds.length) : [];
  // The line under the title. Deals carries none — the title says it all — so
  // the heading stands alone there.
  const subLine = segCopy
    ? segCopy.sub || ""
    : brand
      ? `Every ${brandName} product we carry.`
      : collection && collection.desc
        ? collection.desc
        : activeCat && activeCat.desc
          ? activeCat.desc
          : searching
            ? `Searching every store. Products in stock in ${cityName} come first.`
            : SHOP_SUB;
  // The grid iterates listing entries, not products: one entry per card. A
  // product with a picker is one entry carrying all its variations; a
  // split-listed product contributes one entry per variation.
  //
  // "In stock here" therefore means any variation the card can show is in
  // the city — which is the whole product for a picker card, and exactly one
  // variation for a split card.
  const inStockHere = (e) => e.variants.some((v) => (v.stock[ctx.city] || 0) > 0);
  const scopedOut = listings.filter((e) => !inStockHere(e)).length;
  // What is in stock nearby is the default. A search always reaches every
  // store — someone looking for a specific scent wants to know it exists in
  // Lagos, not to be told it doesn't exist.
  let list = listings.filter((e) => {
    const p = e.product;
    if (catIds && !catIds.has(p.cat)) return false;
    if (segIds && !segIds.includes(p.id)) return false;
    if (brandName && (p.brand || "").toLowerCase() !== String(brandName).toLowerCase()) return false;
    if (collection && !collection.productIds.includes(p.id)) return false;
    if (ctx.search) {
      // Sizes, SKUs and the brand are searchable too, now that they are real
      // identities on the product rather than words in its description.
      const hay = (p.name + " " + p.brand + " " + p.notes + " " + e.variants.map((v) => `${v.size} ${v.sku || ""}`).join(" ")).toLowerCase();
      if (!hay.includes(ctx.search.toLowerCase())) return false;
    }
    if (!searching && ctx.fScope === "city" && !inStockHere(e)) return false;
    return true;
  });
  // Sorting reads the cheapest variation on the card, so a card never sorts by
  // a price the shopper can't actually see on it.
  const priceOf = (e) => Math.min(...e.variants.map((v) => v.ngn));
  // "Newest" and "Best selling" reuse the rankings the New arrivals and Best
  // sellers pages are built from, so the shop sorts by what the server knows
  // actually sold rather than by anything the browser guesses at.
  const rankBy = (key) => {
    const ids = segments[key] || [];
    const rank = new Map(ids.map((id, i) => [id, i]));
    const at = (e) => (rank.has(e.product.id) ? rank.get(e.product.id) : ids.length);
    return (a, b) => at(a) - at(b);
  };
  if (ctx.fSort === "new") list = list.slice().sort(rankBy("new-arrivals"));
  else if (ctx.fSort === "best") list = list.slice().sort(rankBy("best-sellers"));
  else if (ctx.fSort === "low") list = list.slice().sort((a, b) => priceOf(a) - priceOf(b));
  else if (ctx.fSort === "high") list = list.slice().sort((a, b) => priceOf(b) - priceOf(a));
  else if (ctx.fSort === "name") list = list.slice().sort((a, b) => a.product.name.localeCompare(b.product.name));
  // On new arrivals, deals or best sellers, "featured" means the order that
  // page is already in — newest first, best-selling first — rather than city
  // stock, which would shuffle the ranking the page exists to show.
  else if (segRank) list = list.slice().sort((a, b) => segRank.get(a.product.id) - segRank.get(b.product.id));
  else list = list.slice().sort((a, b) => (inStockHere(b) ? 1 : 0) - (inStockHere(a) ? 1 : 0));
  const filtersDirty = ctx.fCat !== "all" || !!ctx.search || !!collection || !!seg || !!brand || ctx.fScope !== "city";
  const selStyle = { fontFamily: "var(--font-sans)", fontSize: 13, padding: "9px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", background: "var(--surface-card)", color: "var(--text-strong)", outline: "none", cursor: "pointer" };
  const chip = (on, onClick, label, key) => (
    <button key={key} onClick={onClick} style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "8px 16px", borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : "var(--mr-purple-800)", transition: "all var(--dur-fast) var(--ease-standard)" }}>
      {label}
    </button>
  );
  // Curated sets lead the page — but only when the shopper is browsing, not
  // when they have already narrowed to a category, a set or a search.
  const showStrips = !searching && !collection && !seg && !brand && ctx.fCat === "all" && collections.length > 0;
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
                  See all {picks.length}
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
              {picks.slice(0, 4).map((e) => <ProductCard key={e.key} p={ctx.card(e)} />)}
            </div>
          </section>
        );
      })}

      {/* Where the shopper is, and the way back up. Categories are picked in
          exactly one place — the header's menu — so this is a breadcrumb, not a
          second copy of the menu. */}
      {trail.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          <a href="/" onClick={(e) => { e.preventDefault(); ctx.nav("home"); }} style={{ color: "var(--text-muted)" }}>Home</a>
          {trail.map((c, i) => (
            <React.Fragment key={c.id}>
              <span>&#8250;</span>
              {i === trail.length - 1
                ? <span style={{ color: "var(--mr-purple-800)" }}>{c.label}</span>
                : <a href={routeToPath("shop", { fCat: c.id })} onClick={(e) => { e.preventDefault(); ctx.nav("shop", { fCat: c.id }); }} style={{ color: "var(--text-muted)" }}>{c.label}</a>}
            </React.Fragment>
          ))}
        </div>
      )}
      <Eyebrow>
        {segCopy ? segCopy.eyebrow
          : brand ? "By the label"
            : collection ? "Collection"
              // Under a sub-category the eyebrow names its parent, which is the
              // one piece of context a heading alone can't carry.
              : trail.length > 1 ? trail[0].label
                : activeCat ? "Category" : "Shop"}
      </Eyebrow>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: `12px 0 ${subLine ? 6 : 24}px` }}>
        {segCopy
          ? (activeCat ? `${segCopy.title} — ${activeCat.label}` : segCopy.title)
          : brand ? brandName
            : collection ? collection.title
              : activeCat ? activeCat.label : SHOP_TITLE}
      </h1>
      {subLine && (
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px", maxWidth: "62ch", lineHeight: 1.7 }}>{subLine}</p>
      )}

      {runningDeals.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 14, marginBottom: 26 }}>
          {runningDeals.map((d) => (
            <div key={d.id} style={{ background: "var(--surface-card)", border: "1px solid var(--mr-gold-400)", borderRadius: "var(--radius-lg)", padding: "16px 18px" }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: "var(--accent-gold)", color: "var(--mr-purple-950)" }}>{d.badge}</span>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-strong)", marginTop: 10 }}>{d.title}</div>
              {d.desc && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.6 }}>{d.desc}</div>}
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>
                {d.productIds.length} {d.productIds.length === 1 ? "product" : "products"}{d.endsAt ? ` · ends ${d.endsAt}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {(collection || brand) && (
        <button onClick={() => ctx.nav("shop", { fCat: "all" })} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-orchid-600)", fontWeight: 500, padding: 0, marginBottom: 18 }}>← Back to all products</button>
      )}
      {/* This store, or every store. Hidden mid-search, which always reaches
          every store. */}
      {!searching && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          {chip(ctx.fScope === "city", () => ctx.setFScope("city"), `In stock in ${cityName}`, "sc-city")}
          {chip(ctx.fScope === "all", () => ctx.setFScope("all"), "Every store", "sc-all")}
          {ctx.fScope === "city" && scopedOut > 0 && (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {scopedOut} more {scopedOut === 1 ? "product ships" : "products ship"} from our other stores — switch to see {scopedOut === 1 ? "it" : "them"}.
            </span>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 28 }}>
        <select value={ctx.fSort} onChange={(e) => ctx.setFSort(e.target.value)} style={selStyle}>
          <option value="featured">{seg ? `Sort — ${segCopy.title.toLowerCase()} first` : `Sort — ${cityName} first`}</option>
          <option value="best">Best sellers</option>
          <option value="new">Newest</option>
          <option value="low">Price · low to high</option>
          <option value="high">Price · high to low</option>
          <option value="name">Name A–Z</option>
        </select>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{list.length} {list.length === 1 ? "product" : "products"}</span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {list.reduce((n, e) => n + e.variants.length, 0)} sizes in total
        </span>
        {filtersDirty && (
          <button onClick={() => { ctx.setFScope("city"); ctx.setSearch(""); ctx.nav("shop", { fCat: "all" }); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-orchid-600)", fontWeight: 500 }}>Clear filters</button>
        )}
      </div>
      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 20px", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)" }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 19, color: "var(--text-body)", margin: "0 0 14px" }}>
            {searching
              ? `Nothing matches "${ctx.search}" in any of our stores.`
              : seg
                ? `Nothing here${activeCat ? ` under ${activeCat.label}` : ""} in ${cityName} today.`
                : `Nothing in stock in ${cityName} under this filter.`}
          </p>
          {!searching && ctx.fScope === "city" && scopedOut > 0 && (
            <Button variant="secondary" onClick={() => ctx.setFScope("all")}>Search every store</Button>
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
  // asked for, else the first one in stock in their city.
  const prV = variants.find((v) => v.id === ctx.prVariantId)
    || (ctx.prSku && variants.find((v) => v.sku === ctx.prSku))
    || ctx.defaultVariant(variants);
  const prA = ctx.variantAvail(prV);
  const { cityName, L } = ctx;
  const soldOut = prA.soldOut;
  const optionName = (pr.optionNames && pr.optionNames[0]) || "Size";
  // The brand grid keys on a slug of the name, so the link from here has to
  // slug it the same way the server does.
  const brandSlug = (pr.brand || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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
      <button onClick={() => ctx.nav("shop")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-purple-700)", padding: 0, marginBottom: 22 }}>← Back to shop</button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(400px, 100%), 1fr))", gap: "clamp(28px, 5vw, 56px)", alignItems: "start" }}>
        <div style={{ position: "relative" }}>
          <ImageSlot src={hero && hero.url} shape="rounded" radius={16} name={pr.name} eager
            sizes="(max-width: 820px) 96vw, 560px"
            label={`${pr.name} ${prV.size} — product photo`} style={{ width: "100%", height: 520 }} />
          {gallery.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {gallery.map((im, i) => (
                <button key={im.url + i} onClick={() => setShot(i)} aria-label={`View photo ${i + 1}`}
                  style={{ padding: 0, width: 64, height: 64, borderRadius: "var(--radius-md)", overflow: "hidden", cursor: "pointer", background: "none", border: `1px solid ${i === shot ? "var(--mr-purple-900)" : "var(--border-hairline)"}` }}>
                  <ImageSlot src={im.url} name={im.alt || ""} sizes="64px" style={{ width: "100%", height: "100%" }} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Eyebrow>{ctx.catLabel(pr.cat)}</Eyebrow>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 42px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "12px 0 6px" }}>{pr.name}</h1>
          {/* The label on the bottle, and the way to everything else under it. */}
          {pr.brand && (
            <a href={routeToPath("shop", { fBrand: brandSlug })} onClick={(e) => { e.preventDefault(); ctx.nav("shop", { fBrand: brandSlug }); }}
              style={{ display: "inline-block", fontSize: 13, fontWeight: 500, color: "var(--mr-orchid-600)", marginBottom: 10 }}>
              {pr.brand} —
            </a>
          )}
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill={ctx.wishlist.includes(pr.id) ? "var(--mr-orchid-500)" : "none"} stroke={ctx.wishlist.includes(pr.id) ? "var(--mr-orchid-500)" : "var(--mr-purple-800)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
              {ctx.wishlist.includes(pr.id) ? "Saved" : "Save"}
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
                ? "Join the waitlist and we'll email you as soon as it's back."
                : `Delivery to ${cityName}: 3–5 days (${prA.note})`}
            </div>
          </div>
        </div>
      </div>
      <section style={{ marginTop: "clamp(40px, 6vw, 64px)" }}>
        <Eyebrow>You may also like</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20, marginTop: 18 }}>
          {related.map((p) => (
            <div key={p.key} style={{ background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <div onClick={p.open} style={{ cursor: "pointer" }}>
                <ImageSlot src={p.imageUrl} name={p.name} sizes="(max-width: 640px) 92vw, 260px" style={{ width: "100%", height: 200 }} />
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
  const para = { fontFamily: "var(--font-editorial)", fontSize: 16.5, lineHeight: "var(--lh-relaxed)", color: "var(--text-body)", margin: "0 0 18px" };
  return (
    <main>
      <section style={{ background: "var(--royal-wash)", textAlign: "center", padding: `clamp(52px, 8vw, 96px) ${PAD}` }}>
        <Eyebrow tone="light">About us</Eyebrow>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 5vw, 60px)", color: "var(--mr-cream)", letterSpacing: "var(--ls-display)", margin: "18px auto 0", maxWidth: "20ch" }}>Who are we?</h1>
      </section>

      <section style={{ maxWidth: 860, margin: "0 auto", padding: `clamp(40px, 6vw, 64px) ${PAD} 0` }}>
        <p style={para}>Majestic Roobee is a Nigerian fragrance brand created for men and women who are intentional about what they put on their body.</p>
        <p style={para}>We believe fragrance is more than smelling good. It should be safe, unique and made intentionally.</p>
        <p style={para}>That is why we create perfumes, perfume oils, body mists, feminine care and home fragrances designed to make everyday moments feel a little more special.</p>
        <p style={para}>Our vision is to grow into one of Africa&apos;s leading fragrance houses while creating intentional products you can enjoy, trust and make part of your everyday routine.</p>
      </section>

      {/* The founder's story, in full and in her own words. */}
      <section style={{ maxWidth: 860, margin: "0 auto", padding: `clamp(32px, 5vw, 48px) ${PAD} 0` }}>
        <GildedRule style={{ margin: "0 0 30px" }} />
        <Eyebrow>Our story</Eyebrow>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 3.4vw, 38px)", color: "var(--text-strong)", letterSpacing: "var(--ls-heading)", margin: "12px 0 22px" }}>{STORY_TITLE}</h2>
        {STORY.map((par, i) => <p key={i} style={para}>{par}</p>)}
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: `clamp(40px, 6vw, 64px) ${PAD} 0` }}>
        <SectionHead centred eyebrow="Visit us" title="Our stores" />
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

      <CtaBand
        title="Find something that smells like you"
        lines={["Perfumes, perfume oils, body mists, feminine care and home fragrances."]}
        cta="Shop fragrances"
        onClick={() => ctx.nav("shop")}
      />
      <div style={{ height: "clamp(32px, 5vw, 48px)" }} />
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
// when it turns up, and in how many parcels.
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
              <ImageSlot src={it.imageUrl} name={it.name} sizes="46px" shape="rounded" radius={8} style={{ width: 46, height: 46 }} />
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

  // Only methods the server will accept — a card option with no gateway behind
  // it is a dead end at the last step.
  const payDefs = [
    { id: "paystack", label: "Card, transfer or USSD", note: "Pay securely with Paystack" },
    { id: "transfer", label: "Bank transfer", note: "Held for 2 hours" },
    { id: "whatsapp", label: "WhatsApp", note: "Finish with us in chat" },
  ].filter((p) => ctx.payMethods[p.id]);

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
      <Eyebrow>Contact</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 44px)", color: "var(--text-strong)", margin: "12px 0 6px", maxWidth: "24ch" }}>Have a question about an order, product or fragrance?</h1>
      <p style={{ fontSize: 15, color: "var(--text-muted)", margin: "0 0 28px" }}>We&apos;re happy to help.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 24, alignItems: "start" }}>
        <div style={{ ...card, padding: 26 }}>
          {ctx.contactSent ? (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--mr-purple-900)", marginBottom: 8 }}>Message received.</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>We&apos;ll reply within a few hours{cf.name.trim() ? `, ${cf.name.trim().split(" ")[0]}` : ""}. Watch your inbox.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Input label="Your name" value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} placeholder="Adaeze Okafor" />
              <Input label="Email" value={cf.email} onChange={(e) => setCf({ ...cf, email: e.target.value })} placeholder="you@email.com" />
              <Textarea label="How can we help?" value={cf.msg} onChange={(e) => setCf({ ...cf, msg: e.target.value })} rows={4} placeholder="An order, a gift, a fragrance question…" />
              <Button variant="primary" onClick={ctx.sendContact}>Send us a message</Button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-strong)" }}>Live chat</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 10px" }}>Open {settings.contactHours}. We usually reply within minutes.</div>
              <Button variant="secondary" size="sm" onClick={() => ctx.setChat((s) => ({ ...s, open: true }))}>Start a chat</Button>
            </div>
          </div>
          <div style={{ ...card, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-strong)" }}>Customer service</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>WhatsApp: <a href={`https://wa.me/${String(settings.contactPhone || "").replace(/[^\d]/g, "").replace(/^0/, "234")}`} target="_blank" rel="noopener noreferrer">{settings.contactPhone}</a></div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Email: <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></div>
              {settings.igUrl && (
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                  Instagram: <a href={settings.igUrl} target="_blank" rel="noopener noreferrer">{settings.igHandle || "@majesticroobee"}</a>
                </div>
              )}
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
      <Eyebrow>Legal</Eyebrow>
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
