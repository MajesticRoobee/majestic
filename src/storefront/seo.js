// Per-page SEO: document head (title, meta, Open Graph, canonical, robots) plus
// JSON-LD structured data. Client-managed; Googlebot renders JS so this is indexed.

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

// Build the head payload for a given page from live data.
export function headFor({ page, product, settings, categories = [] }) {
  const siteName = settings.siteName || "Majestic Roobee";
  const baseDesc = settings.metaDescription
    || "Seductive extrait perfumes, body mists and organic feminine care — blended in Nigeria, worn everywhere. Stores in Abuja, Lagos & Ibadan.";
  const ogImage = settings.ogImage || "";
  const org = {
    "@type": "Organization",
    name: siteName,
    url: origin(),
    ...(settings.igUrl ? { sameAs: [settings.igUrl] } : {}),
    ...(settings.contactPhone ? { contactPoint: { "@type": "ContactPoint", telephone: settings.contactPhone, contactType: "customer service", email: settings.contactEmail } } : {}),
  };

  if (page === "product" && product) {
    const v0 = product.variants[0];
    const inStock = product.variants.some((v) => Object.values(v.stock).some((n) => n > 0));
    return {
      title: `${product.name} — ${siteName}`,
      description: product.desc || `${product.name}: ${product.notes}. ${baseDesc}`,
      canonical: `${origin()}/product/${product.id}`,
      image: product.imageUrl || ogImage,
      type: "product",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.desc,
        category: (categories.find((c) => c.id === product.cat) || {}).label,
        brand: { "@type": "Brand", name: siteName },
        ...(product.imageUrl ? { image: product.imageUrl } : {}),
        offers: {
          "@type": "Offer",
          priceCurrency: "NGN",
          price: v0.ngn,
          availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: `${origin()}/product/${product.id}`,
        },
      },
    };
  }

  const pageMeta = {
    home: { title: `${siteName} — Leave a trail, not just an impression`, path: "/", desc: baseDesc,
      jsonLd: { "@context": "https://schema.org", "@graph": [
        { ...org, "@context": "https://schema.org" },
        { "@type": "WebSite", name: siteName, url: origin(), potentialAction: { "@type": "SearchAction", target: `${origin()}/shop?category={search_term_string}`, "query-input": "required name=search_term_string" } },
      ] } },
    shop: { title: `Shop all fragrances — ${siteName}`, path: "/shop", desc: `Browse every extrait, mist and gift set. ${baseDesc}` },
    about: { title: `Our house — ${siteName}`, path: "/about", desc: "A ruby you carry, a mark you leave. The story of Majestic Roobee — Abuja, Lagos and Ibadan." },
    track: { title: `Track your order — ${siteName}`, path: "/track", desc: "Follow your Majestic Roobee order with your order number and contact." },
    contact: { title: `Contact & support — ${siteName}`, path: "/contact", desc: "Speak with the house — live chat, WhatsApp, phone and our three stores." },
    privacy: { title: `Privacy & cookies — ${siteName}`, path: "/privacy", desc: "How Majestic Roobee collects, uses and protects your information." },
    checkout: { title: `Checkout — ${siteName}`, path: "/checkout", desc: "", noindex: true },
    confirm: { title: `Order confirmed — ${siteName}`, path: "/confirm", desc: "", noindex: true },
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
