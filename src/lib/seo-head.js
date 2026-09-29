// What each page of the storefront says about itself to a search engine and to
// a link preview: title, description, canonical address, share image, and
// structured data.
//
// Pure — no window, no document — because two callers need the same answer:
// the browser, which rewrites the head as a shopper moves around the shop, and
// the Worker, which writes it into the HTML before it leaves the server. The
// second is the one that matters for a shared link: WhatsApp, iMessage,
// Facebook, X and most crawlers read the HTML as sent and never run a line of
// JavaScript, so a head filled in only by the browser is a head they never see.

import { aboutContent } from "./about.js";
import { consultationContent } from "./consultation.js";

const SITE = "Majestic Roobee";

// The house's own words per category. Anything not named here gets a title and
// description built from the category's own label and line, so a category added
// in the admin still arrives with a sensible head.
export const CATEGORY_HEADS = {
  perfumes: {
    title: "Perfumes for Men and Women in Nigeria",
    desc: "Shop men's and women's perfumes from Majestic Roobee — long-lasting, non-toxic fragrances. Delivery across Nigeria.",
  },
  "perfume-oils": {
    title: "Perfume Oils in Nigeria",
    desc: "Shop concentrated perfume oils from Majestic Roobee, including designer-inspired and custom blends. Delivery across Nigeria.",
  },
  home: {
    title: "Home Fragrance in Nigeria — Candles, Diffusers & Room Sprays",
    desc: "Candles, diffusers and room sprays from Majestic Roobee. Delivery across Nigeria.",
  },
  mist: {
    title: "Body Mists in Nigeria",
    desc: "Shop long-lasting body mists from Majestic Roobee. Delivery across Nigeria.",
  },
  care: {
    title: "Feminine Care in Nigeria — Plant-Based & Non-Toxic",
    desc: "Plant-based, non-toxic feminine care from Majestic Roobee. Delivery across Nigeria.",
  },
  wellness: {
    title: "Wellness Products in Nigeria — Health Drinks & Massage Oils",
    desc: "Health drinks and massage oils from Majestic Roobee. Delivery across Nigeria.",
  },
};

const DEFAULT_DESC = "Shop perfumes, perfume oils, body mists, feminine care, wellness and home fragrance from Majestic Roobee. Stores in Abuja, Lagos and Ibadan, with delivery across Nigeria.";

/** Plain text, one line, cut at a word near `max` — what a description meta can hold. */
export function clip(text, max = 158) {
  const s = String(text || "").replace(/[#>*_`]+/g, " ").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}

/** An address the whole web can load: relative paths become absolute on `origin`. */
export function absUrl(origin, url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

const ngn = (n) => "₦" + Number(n || 0).toLocaleString("en-US");

/** The brand, as every page's structured data names it. */
function organization(origin, settings, siteName) {
  const sameAs = [settings.igUrl, settings.tiktokUrl, settings.facebookUrl].filter(Boolean);
  return {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: siteName,
    url: `${origin}/`,
    logo: absUrl(origin, settings.logoUrl || "/logo.png"),
    ...(sameAs.length ? { sameAs } : {}),
    ...(settings.contactPhone || settings.contactEmail ? {
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        areaServed: "NG",
        ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
        ...(settings.contactEmail ? { email: settings.contactEmail } : {}),
      },
    } : {}),
  };
}

function breadcrumbs(origin, trail) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, path], i) => ({
      "@type": "ListItem", position: i + 1, name, item: `${origin}${path}`,
    })),
  };
}

// The categories from a product's own shelf up to the top, for its breadcrumb.
function catTrail(categories, id) {
  const out = [];
  let c = categories.find((x) => x.id === id);
  for (let guard = 0; c && guard < 4; guard++) {
    out.unshift(c);
    c = c.parentId ? categories.find((x) => x.id === c.parentId) : null;
  }
  return out;
}

const graph = (...nodes) => ({ "@context": "https://schema.org", "@graph": nodes.filter(Boolean) });

/**
 * The head for one page.
 *
 * Returns { title, description, canonical, image, imageAlt, type, noindex,
 * jsonLd, product } where `product` (product pages only) carries the price and
 * availability for the Open Graph product tags.
 */
export function headFor({
  origin, page, product, variant, variantInUrl = false, settings = {}, categories = [], segment = null, brand = "",
  post = null, category = "", infoPage = null,
}) {
  const siteName = settings.siteName || SITE;
  const baseDesc = settings.metaDescription || DEFAULT_DESC;
  // Every page has a picture to show when it is shared, never a blank card.
  const shareImage = absUrl(origin, settings.ogImage || "/og-image.jpg");
  const org = organization(origin, settings, siteName);
  const website = {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: siteName,
    url: `${origin}/`,
    publisher: { "@id": `${origin}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}/shop?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
  const plain = (title, path, description, extra = {}) => ({
    title, description: clip(description), canonical: `${origin}${path}`, image: shareImage, imageAlt: siteName,
    type: "website", noindex: false, jsonLd: null, ...extra,
  });

  if (page === "product" && product) {
    const variants = product.variants || [];
    const sel = variant || variants[0];
    const urlFor = (v) => `${origin}/product/${encodeURIComponent(product.id)}${v && v.sku && variants.length > 1 ? `?variant=${encodeURIComponent(v.sku)}` : ""}`;
    const stocked = (v) => Object.values(v.stock || {}).some((n) => n > 0);
    const multi = variants.length > 1;
    const cat = categories.find((c) => c.id === product.cat);
    const brandName = product.brand || siteName;
    const images = [...new Set([
      sel && sel.imageUrl, product.imageUrl, ...(product.images || []).map((im) => im.url),
    ].filter(Boolean).map((u) => absUrl(origin, u)))];
    const offer = (v) => ({
      "@type": "Offer",
      ...(v.sku ? { sku: v.sku } : {}),
      name: `${product.name} ${v.size || ""}`.trim(),
      price: v.ngn,
      priceCurrency: "NGN",
      availability: stocked(v) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: urlFor(v),
      seller: { "@id": `${origin}/#organization` },
    });
    const prices = variants.map((v) => v.ngn).filter((n) => n > 0);
    const lo = prices.length ? Math.min(...prices) : 0;
    const hi = prices.length ? Math.max(...prices) : 0;
    // A shared link's preview leads with the thing a shopper wants to know
    // first: what it costs.
    const priceText = sel ? ngn(sel.ngn) : lo ? `From ${ngn(lo)}` : "";
    const lead = [priceText, multi && sel ? sel.size : variants[0] && variants[0].size].filter(Boolean).join(" · ");
    const body = product.desc || [product.notes && `Notes: ${product.notes}.`, cat && cat.label].filter(Boolean).join(" ") || baseDesc;
    const trail = [["Home", "/"], ["Shop", "/shop"],
      ...catTrail(categories, product.cat).map((c) => [c.label, `/shop?category=${encodeURIComponent(c.id)}`]),
      [product.name, `/product/${encodeURIComponent(product.id)}`]];
    return {
      title: `${product.name}${multi && sel ? ` ${sel.size}` : ""} | ${siteName}`,
      description: clip(`${lead ? `${lead} — ` : ""}${body}`),
      // The variation the address names, so a link someone shares resolves to
      // the size they were looking at; the bare product address otherwise.
      // Read off the address alone, so the server and the browser — which may
      // pick a different default size — always agree.
      canonical: variantInUrl ? urlFor(sel) : urlFor(null),
      image: images[0] || shareImage,
      imageAlt: product.name,
      type: "product",
      noindex: product.live === false,
      product: sel ? { price: sel.ngn, currency: "NGN", inStock: stocked(sel), brand: brandName } : null,
      jsonLd: graph(
        {
          "@type": "Product",
          "@id": `${urlFor(sel)}#product`,
          name: product.name,
          description: clip(product.desc || body, 5000),
          url: urlFor(sel),
          ...(images.length ? { image: images } : {}),
          ...(sel && sel.sku ? { sku: sel.sku } : {}),
          ...(cat ? { category: cat.label } : {}),
          brand: { "@type": "Brand", name: brandName },
          ...(product.gender && product.gender !== "Unisex" ? { audience: { "@type": "PeopleAudience", suggestedGender: product.gender.toLowerCase() } } : {}),
          // One variation stays a plain Offer; a range becomes an
          // AggregateOffer so search shows the true low/high span.
          offers: variants.length > 1
            ? { "@type": "AggregateOffer", priceCurrency: "NGN", lowPrice: lo, highPrice: hi, offerCount: variants.length, offers: variants.map(offer) }
            : variants.length ? offer(variants[0]) : undefined,
        },
        breadcrumbs(origin, trail),
        org,
      ),
    };
  }

  // New arrivals, best sellers, deals and gift sets are the shop grid with one
  // filter on it, and each has its own address — so each has its own head.
  const SEGMENT_HEADS = {
    "new-arrivals": { title: `New Arrivals | ${siteName}`, path: "/new-arrivals", desc: `The newest perfumes, oils, mists and sets at ${siteName}.` },
    "best-sellers": { title: `Best Sellers | ${siteName}`, path: "/best-sellers", desc: `The best-selling fragrances at ${siteName}.` },
    deals: { title: `Deals & Offers | ${siteName}`, path: "/deals", desc: `Perfumes, mists and more on sale now at ${siteName}.` },
    "gift-sets": { title: `Gift Sets | ${siteName}`, path: "/gift-sets", desc: `Fragrance, body mist and perfume oil gift sets from ${siteName}.` },
  };
  if (page === "shop" && segment && SEGMENT_HEADS[segment]) {
    const m = SEGMENT_HEADS[segment];
    return plain(m.title, m.path, `${m.desc} ${baseDesc}`, {
      jsonLd: graph(breadcrumbs(origin, [["Home", "/"], [m.title.split(" | ")[0], m.path]]), org),
    });
  }
  // A category: the house's own title where there is one, otherwise one built
  // from the category itself.
  if (page === "shop" && category) {
    const cat = categories.find((c) => c.id === category);
    const written = CATEGORY_HEADS[category];
    if (cat || written) {
      const label = cat ? cat.label : category;
      const path = `/shop?category=${encodeURIComponent(category)}`;
      const trail = [["Home", "/"], ["Shop", "/shop"],
        ...catTrail(categories, category).map((c) => [c.label, `/shop?category=${encodeURIComponent(c.id)}`])];
      return plain(
        `${written ? written.title : `${label} in Nigeria`} | ${siteName}`,
        path,
        written ? written.desc : `${(cat && cat.desc) || `Shop ${label.toLowerCase()}.`} ${baseDesc}`,
        { image: cat && cat.imageUrl ? absUrl(origin, cat.imageUrl) : shareImage, imageAlt: label, jsonLd: graph(breadcrumbs(origin, trail), org) },
      );
    }
  }
  if (page === "shop" && brand) {
    const slug = brand.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return plain(`${brand} | ${siteName}`, `/brand/${encodeURIComponent(slug)}`, `Shop ${brand} at ${siteName}. ${baseDesc}`);
  }
  if (page === "post" && post) {
    const url = `${origin}/blog/${post.slug}`;
    return {
      title: `${post.title} | ${siteName}`,
      description: clip(post.excerpt || baseDesc),
      canonical: url,
      image: post.coverUrl ? absUrl(origin, post.coverUrl) : shareImage,
      imageAlt: post.title,
      type: "article",
      noindex: false,
      article: { publishedTime: post.publishedAt || "", author: post.author || siteName },
      jsonLd: graph(
        {
          "@type": "BlogPosting",
          headline: post.title,
          description: clip(post.excerpt),
          ...(post.coverUrl ? { image: absUrl(origin, post.coverUrl) } : {}),
          ...(post.publishedAt ? { datePublished: String(post.publishedAt).replace(" ", "T") } : {}),
          author: { "@type": post.author ? "Person" : "Organization", name: post.author || siteName },
          publisher: { "@id": `${origin}/#organization` },
          mainEntityOfPage: url,
        },
        breadcrumbs(origin, [["Home", "/"], ["Blog", "/blog"], [post.title, `/blog/${post.slug}`]]),
        org,
      ),
    };
  }
  // An information page describes itself — its own title and, where the house
  // wrote one, its own description.
  if (page === "info" && infoPage) {
    return plain(infoPage.seoTitle || `${infoPage.title} | ${siteName}`, `/${infoPage.slug}`, infoPage.seoDesc || baseDesc);
  }

  const about = aboutContent(settings);
  const consult = consultationContent(settings);
  const pageMeta = {
    home: {
      title: `${siteName} — Perfumes, Body Mists & Feminine Care in Nigeria`, path: "/", desc: baseDesc,
      jsonLd: graph(org, website),
    },
    shop: {
      title: `Shop Perfumes, Perfume Oils & Body Mists | ${siteName}`, path: "/shop",
      desc: "Shop perfumes, perfume oils, body mists, candles, diffusers, feminine care and wellness products from Majestic Roobee. Delivery across Nigeria.",
    },
    about: { title: about.seoTitle, path: "/about", desc: about.seoDesc },
    faq: { title: `FAQs | ${siteName}`, path: "/faq", desc: "Choosing a perfume, making it last, perfume oils, delivery across Nigeria and returns." },
    track: { title: `Track Your Order | ${siteName}`, path: "/track", desc: `Track your ${siteName} order.` },
    contact: { title: `Contact Us | ${siteName}`, path: "/contact", desc: `Contact ${siteName} on WhatsApp, email or live chat.` },
    wishlist: { title: `Wishlist | ${siteName}`, path: "/wishlist", desc: "", noindex: true },
    account: { title: `Your Account | ${siteName}`, path: "/account", desc: "", noindex: true },
    locations: { title: `Our Stores | ${siteName}`, path: "/locations", desc: `${siteName} stores — addresses, opening hours and phone numbers.` },
    reviews: { title: `Reviews | ${siteName}`, path: "/reviews", desc: `What customers say about ${siteName}.` },
    blog: { title: `Blog | ${siteName}`, path: "/blog", desc: `Fragrance tips, layering and care from ${siteName}.` },
    // The booking page drops out of search entirely while the studio isn't
    // taking bookings, rather than ranking for a service nobody can have.
    consultation: {
      title: consult.seoTitle.includes(siteName) ? consult.seoTitle : `${consult.seoTitle} | ${siteName}`,
      path: "/consultation",
      desc: consult.seoDesc,
      noindex: !consult.on,
      jsonLd: consult.on ? graph({
        "@type": "Service",
        name: consult.headline,
        serviceType: "Perfume consultation",
        description: clip(consult.intro),
        provider: { "@id": `${origin}/#organization` },
        areaServed: "NG",
        url: `${origin}/consultation`,
      }, org) : null,
    },
    post: { title: `Blog | ${siteName}`, path: "/blog", desc: `Fragrance tips, layering and care from ${siteName}.` },
    categories: { title: `Shop by Category | ${siteName}`, path: "/shop/categories", desc: "Perfumes, perfume oils, body mists, feminine care, home fragrance, wellness and gift sets." },
    cart: { title: `Cart | ${siteName}`, path: "/cart", desc: "", noindex: true },
    checkout: { title: `Checkout | ${siteName}`, path: "/checkout", desc: "", noindex: true },
    confirm: { title: `Order Confirmed | ${siteName}`, path: "/confirm", desc: "", noindex: true },
  }[page] || { title: siteName, path: "/", desc: baseDesc };

  return plain(pageMeta.title, pageMeta.path, pageMeta.desc || baseDesc, {
    noindex: !!pageMeta.noindex,
    jsonLd: pageMeta.jsonLd || null,
  });
}

/**
 * The <meta> tags for a head, as [attribute, key, content] triples — written
 * into the HTML by the Worker and kept up to date by the browser from the same
 * list, so the two can never disagree about what a page says.
 */
export function metaTags(head, settings = {}) {
  const siteName = settings.siteName || SITE;
  const card = head.image ? "summary_large_image" : "summary";
  const tags = [
    ["name", "description", head.description],
    ["name", "robots", head.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"],
    ["property", "og:site_name", siteName],
    ["property", "og:locale", "en_NG"],
    ["property", "og:type", head.type || "website"],
    ["property", "og:title", head.title],
    ["property", "og:description", head.description],
    ["property", "og:url", head.canonical],
    ["property", "og:image", head.image],
    ["property", "og:image:alt", head.imageAlt || head.title],
    ["name", "twitter:card", card],
    ["name", "twitter:title", head.title],
    ["name", "twitter:description", head.description],
    ["name", "twitter:image", head.image],
    ["name", "twitter:image:alt", head.imageAlt || head.title],
  ];
  const handle = String(settings.twitterHandle || "").trim();
  if (handle) tags.push(["name", "twitter:site", handle.startsWith("@") ? handle : `@${handle}`]);
  if (head.product) {
    tags.push(
      ["property", "product:price:amount", String(head.product.price)],
      ["property", "product:price:currency", head.product.currency],
      ["property", "product:availability", head.product.inStock ? "in stock" : "out of stock"],
      ["property", "product:brand", head.product.brand],
      ["property", "og:price:amount", String(head.product.price)],
      ["property", "og:price:currency", head.product.currency],
    );
  }
  if (head.article) {
    if (head.article.publishedTime) tags.push(["property", "article:published_time", String(head.article.publishedTime).replace(" ", "T")]);
    if (head.article.author) tags.push(["property", "article:author", head.article.author]);
  }
  if (settings.gscVerification) tags.push(["name", "google-site-verification", settings.gscVerification]);
  return tags.filter((t) => t[2]);
}

// Every key metaTags can emit — what the browser clears on a page that no
// longer carries one (a product's price tags, once the shopper leaves it).
export const META_KEYS = [
  "description", "robots", "og:site_name", "og:locale", "og:type", "og:title", "og:description", "og:url",
  "og:image", "og:image:alt", "twitter:card", "twitter:title", "twitter:description", "twitter:image",
  "twitter:image:alt", "twitter:site", "product:price:amount", "product:price:currency", "product:availability",
  "product:brand", "og:price:amount", "og:price:currency", "article:published_time", "article:author",
];

/** JSON for a <script type="application/ld+json">, safe inside HTML. */
export function jsonLdText(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
