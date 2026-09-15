// Per-page SEO: document head (title, meta, Open Graph, canonical, robots) plus
// JSON-LD structured data. Client-managed; Googlebot renders JS so this is indexed.

import { aboutContent } from "../lib/about.js";

function upsertMeta(attr, key, content) {
  if (!content) {
    const el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (el) el.remove();
    return;
  }
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function setHead({ title, description, canonical, image, type = "website", noindex = false, jsonLd = null }) {
  if (title) document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
  // Open Graph
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:image", image);
  upsertMeta("property", "og:site_name", "Majestic Roobee");
  // Twitter
  upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", image);
  upsertLink("canonical", canonical);
  setJsonLd(jsonLd);
}

export function setJsonLd(data) {
  const id = "mr-jsonld";
  let el = document.getElementById(id);
  if (!data) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

// Google Search Console — "HTML tag" verification, driven from admin settings.
export function setGscVerification(token) {
  upsertMeta("name", "google-site-verification", token || "");
}

const origin = () => window.location.origin;

// The titles and meta descriptions the client wrote, per category. Anything not
// named here gets one built from the category's own label and description, so a
// category added in the admin still arrives with a sensible title rather than
// inheriting "Shop all".
const CATEGORY_HEADS = {
  perfumes: {
    title: "Men's and Women's Perfumes in Nigeria | Luxury Fragrances",
    desc: "Explore men's and women's perfumes from Majestic Roobee. Discover feminine, sensual, floral, warm, bold, commanding and captivating fragrances for every mood and occasion.",
  },
  "perfume-oils": {
    title: "Perfume Oils in Nigeria | Luxury Fragrance Oils",
    desc: "Shop luxurious perfume oils from Majestic Roobee. Discover concentrated fragrances designed for an intimate and beautiful scent experience.",
  },
  home: {
    title: "Home Fragrance in Nigeria | Candles, Diffusers & Room Sprays",
    desc: "Make your space smell as beautiful as it looks with Majestic Roobee candles, diffusers and room sprays.",
  },
  mist: {
    title: "Body Mists in Nigeria | Long-Lasting Fragrance Mists",
    desc: "Shop body mists from Majestic Roobee — light, refreshing fragrance you can wear every day.",
  },
  care: {
    title: "Feminine Care in Nigeria | Plant-Based & Non-Toxic",
    desc: "Shop plant-based, non-toxic feminine care from Majestic Roobee — safe products for your intimate area.",
  },
  wellness: {
    title: "Wellness Products in Nigeria | Health Drinks & Massage Oils",
    desc: "Shop wellness products from Majestic Roobee — health drinks and massage oils made with you in mind.",
  },
};

// Build the head payload for a given page from live data.
export function headFor({ page, product, variant, settings, categories = [], segment = null, brand = "", post = null, category = "", infoPage = null }) {
  const siteName = settings.siteName || "Majestic Roobee";
  const baseDesc = settings.metaDescription
    || "Discover luxurious perfumes, fragrance oils, body mists, feminine care, wellness products and home fragrances from Majestic Roobee. Find your signature scent and shop online in Nigeria.";
  const ogImage = settings.ogImage || "";
  // The About page's title and description are settings with the shipped copy
  // behind them, so this reads the same resolver the page itself renders from.
  const about = aboutContent(settings);
  const org = {
    "@type": "Organization",
    name: siteName,
    url: origin(),
    ...(settings.igUrl ? { sameAs: [settings.igUrl] } : {}),
    ...(settings.contactPhone ? { contactPoint: { "@type": "ContactPoint", telephone: settings.contactPhone, contactType: "customer service", email: settings.contactEmail } } : {}),
  };

  if (page === "product" && product) {
    const variants = product.variants || [];
    const sel = variant || variants[0];
    const urlFor = (v) => `${origin()}/product/${product.id}${v && v.sku ? `?variant=${encodeURIComponent(v.sku)}` : ""}`;
    const stocked = (v) => Object.values(v.stock || {}).some((n) => n > 0);
    const multi = variants.length > 1;
    // Every variation is its own Offer with its own SKU, price, availability and
    // URL — one Product page carrying the whole range, rather than a page per
    // size competing with its own siblings in search results.
    const offers = variants.map((v) => ({
      "@type": "Offer",
      ...(v.sku ? { sku: v.sku } : {}),
      name: `${product.name} — ${v.size}`,
      priceCurrency: "NGN",
      price: v.ngn,
      availability: stocked(v) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: urlFor(v),
      ...(v.imageUrl ? { image: v.imageUrl } : {}),
    }));
    const images = (product.images || []).map((im) => im.url).filter(Boolean);
    return {
      // The title names the variation only when there is a choice to make.
      title: multi && sel ? `${product.name} ${sel.size} | ${siteName}` : `${product.name} | ${siteName}`,
      description: product.desc || `${product.name}: ${product.notes}. ${baseDesc}`,
      // Canonical points at the selected variation, so a link someone shares
      // resolves to the size they were looking at.
      canonical: urlFor(sel),
      image: (sel && sel.imageUrl) || product.imageUrl || ogImage,
      type: "product",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.desc,
        category: (categories.find((c) => c.id === product.cat) || {}).label,
        brand: { "@type": "Brand", name: siteName },
        ...(images.length ? { image: images } : product.imageUrl ? { image: product.imageUrl } : {}),
        ...(sel && sel.sku ? { sku: sel.sku } : {}),
        // A single variation stays a plain Offer; a range becomes an
        // AggregateOffer so search shows the true low/high span.
        offers: offers.length > 1
          ? {
              "@type": "AggregateOffer",
              priceCurrency: "NGN",
              lowPrice: Math.min(...variants.map((v) => v.ngn)),
              highPrice: Math.max(...variants.map((v) => v.ngn)),
              offerCount: offers.length,
              offers,
            }
          : offers[0],
      },
    };
  }

  // New arrivals, best sellers, deals and gift sets are the shop page with one
  // filter on it, and each has its own URL — so each needs its own title rather
  // than inheriting "Shop all".
  const SEGMENT_HEADS = {
    "new-arrivals": { title: `New Arrivals | ${siteName}`, path: "/new-arrivals", desc: `The newest perfumes, oils, mists and sets at Majestic Roobee. ${baseDesc}` },
    "best-sellers": { title: `Best Sellers | ${siteName}`, path: "/best-sellers", desc: `The fragrances our customers keep coming back for. ${baseDesc}` },
    deals: { title: `Deals & Offers | ${siteName}`, path: "/deals", desc: `Everything on sale at Majestic Roobee right now. ${baseDesc}` },
    "gift-sets": { title: `Gift Sets | ${siteName}`, path: "/gift-sets", desc: `Fragrance, mist and custom-oil sets, ready to give. ${baseDesc}` },
  };
  if (page === "shop" && segment && SEGMENT_HEADS[segment]) {
    const m = SEGMENT_HEADS[segment];
    return { title: m.title, description: m.desc, canonical: origin() + m.path, image: ogImage, noindex: false, jsonLd: null };
  }
  // A category page: the client's own title where there is one, otherwise one
  // built from the category itself.
  if (page === "shop" && category) {
    const cat = categories.find((c) => c.id === category);
    const written = CATEGORY_HEADS[category];
    if (cat || written) {
      const label = cat ? cat.label : category;
      return {
        title: `${written ? written.title : `${label} in Nigeria`} | ${siteName}`,
        description: written ? written.desc : (cat && cat.desc) || `Shop ${label.toLowerCase()} from Majestic Roobee. ${baseDesc}`,
        canonical: `${origin()}/shop?category=${encodeURIComponent(category)}`,
        image: ogImage, noindex: false, jsonLd: null,
      };
    }
  }
  if (page === "shop" && brand) {
    return {
      title: `${brand} | ${siteName}`,
      description: `Every ${brand} product we carry. ${baseDesc}`,
      canonical: `${origin()}/brand/${encodeURIComponent(brand.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, ""))}`,
      image: ogImage, noindex: false, jsonLd: null,
    };
  }
  if (page === "post" && post) {
    return {
      title: `${post.title} | ${siteName}`,
      description: post.excerpt || baseDesc,
      canonical: `${origin()}/blog/${post.slug}`,
      image: post.coverUrl || ogImage,
      type: "article",
      noindex: false,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt,
        ...(post.coverUrl ? { image: post.coverUrl } : {}),
        ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
        author: { "@type": "Organization", name: post.author || siteName },
        publisher: org,
        mainEntityOfPage: `${origin()}/blog/${post.slug}`,
      },
    };
  }

  // An information page describes itself: its own title and, where the house
  // wrote one, its own description — rather than a row in a table here that
  // would have to be edited every time a page is added.
  if (page === "info" && infoPage) {
    return {
      title: infoPage.seoTitle || `${infoPage.title} | ${siteName}`,
      description: infoPage.seoDesc || baseDesc,
      canonical: `${origin()}/${infoPage.slug}`,
      image: ogImage,
      noindex: false,
      jsonLd: null,
    };
  }

  const pageMeta = {
    home: { title: `Luxury Perfumes & Fragrance Oils, Feminine Care and Wellness Products in Nigeria | ${siteName}`, path: "/", desc: baseDesc,
      jsonLd: { "@context": "https://schema.org", "@graph": [
        { ...org, "@context": "https://schema.org" },
        { "@type": "WebSite", name: siteName, url: origin(), potentialAction: { "@type": "SearchAction", target: `${origin()}/shop?category={search_term_string}`, "query-input": "required name=search_term_string" } },
      ] } },
    shop: { title: `Shop Perfumes, Fragrance Oils & Body Mists, Home Fragrance And Feminine Care in Nigeria | ${siteName}`, path: "/shop",
      desc: "Shop perfumes, perfume oils, body mists, candles, diffusers, room sprays, feminine care, and wellness products from Majestic Roobee. Discover your next signature scent." },
    // The About page writes its own head, the way an information page does —
    // the house rewrote the page, so the search result should follow it.
    about: { title: about.seoTitle, path: "/about", desc: about.seoDesc },
    faq: { title: `Frequently Asked Questions | ${siteName}`, path: "/faq", desc: "Answers on choosing a perfume, making it last, perfume oils, layering, storage, delivery across Nigeria and returns." },
    track: { title: `Track Your Order | ${siteName}`, path: "/track", desc: "Follow your Majestic Roobee order with your order number and contact." },
    contact: { title: `Contact Us | ${siteName}`, path: "/contact", desc: "Questions about an order, product or fragrance? Reach Majestic Roobee on WhatsApp, email, Instagram or live chat." },
    wishlist: { title: `Your Wishlist | ${siteName}`, path: "/wishlist", desc: "The products you've saved to come back to.", noindex: true },
    locations: { title: `Our Stores | ${siteName}`, path: "/locations", desc: "Where to find Majestic Roobee — addresses, opening hours and phone numbers for every store." },
    reviews: { title: `Reviews | ${siteName}`, path: "/reviews", desc: "What customers say about Majestic Roobee, in their own posts and their own words." },
    blog: { title: `Blog | ${siteName}`, path: "/blog", desc: "Notes on fragrance, layering and care from Majestic Roobee." },
    post: { title: `Blog | ${siteName}`, path: "/blog", desc: "Notes on fragrance, layering and care from Majestic Roobee." },
    checkout: { title: `Checkout | ${siteName}`, path: "/checkout", desc: "", noindex: true },
    confirm: { title: `Order Confirmed | ${siteName}`, path: "/confirm", desc: "", noindex: true },
  }[page] || { title: siteName, path: "/", desc: baseDesc };

  return {
    title: pageMeta.title,
    description: pageMeta.desc,
    canonical: origin() + pageMeta.path,
    image: ogImage,
    noindex: !!pageMeta.noindex,
    jsonLd: pageMeta.jsonLd || null,
  };
}
