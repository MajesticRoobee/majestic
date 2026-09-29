// What a shared link shows, exercised directly.
//
// The storefront is a single-page app, and link previews (WhatsApp, iMessage,
// Facebook, X) never run its JavaScript — so every product in the shop used to
// preview as the same generic title, with no picture and no price. The Worker
// now writes each page's own head into the HTML (worker/seo.js) from the same
// builder the browser uses (src/lib/seo-head.js). This file pins both halves:
// what the head says, and how the server finds the page an address names.
import { headFor, metaTags, clip, absUrl, jsonLdText } from "../src/lib/seo-head.js";
import { isShellPath, headHtml, resolveHead } from "../worker/seo.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

const ORIGIN = "https://majesticroobee.shop";
const settings = { siteName: "Majestic Roobee", igUrl: "https://instagram.com/majesticroobee", contactPhone: "0809 202 0525" };
const categories = [
  { id: "perfumes", label: "Perfumes", desc: "Non-toxic perfumes for men and women.", parentId: null },
  { id: "perfume-oils", label: "Perfume Oils", desc: "", parentId: null },
  { id: "designer", label: "Designer Oils", desc: "", parentId: "perfume-oils" },
];
const product = {
  id: "velvet-reign", name: "Velvet Reign", cat: "designer", brand: "", gender: "Female", notes: "Oud, rose",
  desc: "A deep rose and oud extrait.", imageUrl: "/images/abc", live: true,
  images: [{ url: "/images/abc" }, { url: "/images/def" }],
  variants: [
    { id: 1, sku: "VR-30", size: "30ml", ngn: 25000, stock: { abuja: 3 }, imageUrl: "/images/v30" },
    { id: 2, sku: "VR-50", size: "50ml", ngn: 40000, stock: { abuja: 0 }, imageUrl: null },
  ],
};

// ---- 1. A product link ----------------------------------------------------
console.log("\nA product link");

const h = headFor({ origin: ORIGIN, page: "product", product, variant: product.variants[1], variantInUrl: true, settings, categories });
check("the title names the product and the size that was shared",
  h.title, "Velvet Reign 50ml | Majestic Roobee");
check("the preview leads with the price and size",
  h.description.startsWith("₦40,000 · 50ml — A deep rose"), true);
check("the canonical address keeps the shared size",
  h.canonical, `${ORIGIN}/product/velvet-reign?variant=VR-50`);
check("...but a bare product address canonicalises to itself, whatever size a browser picks",
  headFor({ origin: ORIGIN, page: "product", product, variant: product.variants[1], settings, categories }).canonical,
  `${ORIGIN}/product/velvet-reign`);
check("a product with one size never grows a ?variant= on its address",
  headFor({ origin: ORIGIN, page: "product", product: { ...product, variants: [product.variants[0]] }, variantInUrl: true, settings, categories }).canonical,
  `${ORIGIN}/product/velvet-reign`);
check("the picture is absolute — a preview can't load a relative path",
  h.image, `${ORIGIN}/images/abc`);
check("...and it is the selected size's own photo when it has one",
  headFor({ origin: ORIGIN, page: "product", product, variant: product.variants[0], settings, categories }).image, `${ORIGIN}/images/v30`);
check("price and availability ride along for the product tags",
  h.product, { price: 40000, currency: "NGN", inStock: false, brand: "Majestic Roobee" });

const nodes = h.jsonLd["@graph"];
const ld = nodes.find((n) => n["@type"] === "Product");
check("structured data is a Product with a range of offers",
  [ld.offers["@type"], ld.offers.lowPrice, ld.offers.highPrice, ld.offers.offerCount], ["AggregateOffer", 25000, 40000, 2]);
check("each offer says whether it is in stock",
  ld.offers.offers.map((o) => o.availability.split("/").pop()), ["InStock", "OutOfStock"]);
check("each offer is new, in naira",
  ld.offers.offers.every((o) => o.itemCondition.endsWith("NewCondition") && o.priceCurrency === "NGN"), true);
check("the breadcrumb walks the category tree",
  nodes.find((n) => n["@type"] === "BreadcrumbList").itemListElement.map((i) => i.name),
  ["Home", "Shop", "Perfume Oils", "Designer Oils", "Velvet Reign"]);
check("the brand falls back to the house's own name",
  ld.brand.name, "Majestic Roobee");

// ---- 2. The rest of the shop ----------------------------------------------
console.log("\nThe rest of the shop");

const home = headFor({ origin: ORIGIN, page: "home", settings, categories });
check("the home page carries the organisation and the site search",
  home.jsonLd["@graph"].map((n) => n["@type"]), ["Organization", "WebSite"]);
check("site search points at a real address the shop understands",
  home.jsonLd["@graph"][1].potentialAction.target.urlTemplate, `${ORIGIN}/shop?q={search_term_string}`);
check("every page has a share picture, even with none set",
  home.image, `${ORIGIN}/og-image.jpg`);
check("a picture the house set in the admin wins",
  headFor({ origin: ORIGIN, page: "home", settings: { ...settings, ogImage: "/images/share" } }).image, `${ORIGIN}/images/share`);
check("a category uses the house's own title",
  headFor({ origin: ORIGIN, page: "shop", category: "perfumes", settings, categories }).title,
  "Perfumes for Men and Women in Nigeria | Majestic Roobee");
check("a category nobody wrote a title for still gets one",
  headFor({ origin: ORIGIN, page: "shop", category: "designer", settings, categories }).title,
  "Designer Oils in Nigeria | Majestic Roobee");
check("the cart is kept out of search",
  headFor({ origin: ORIGIN, page: "cart", settings }).noindex, true);
check("the booking page leaves search while bookings are closed",
  headFor({ origin: ORIGIN, page: "consultation", settings: { ...settings, consultOn: "0" } }).noindex, true);

// ---- 3. The tags themselves ----------------------------------------------
console.log("\nThe tags");

const tags = Object.fromEntries(metaTags(h, settings).map(([, k, v]) => [k, v]));
check("Open Graph: product type, title, picture, address",
  [tags["og:type"], tags["og:title"], tags["og:image"], tags["og:url"]],
  ["product", h.title, h.image, h.canonical]);
check("a large card on X", tags["twitter:card"], "summary_large_image");
check("the price as a preview reads it", [tags["product:price:amount"], tags["product:price:currency"]], ["40000", "NGN"]);
check("no product tags on a page that isn't one",
  metaTags(home, settings).some(([, k]) => k.startsWith("product:")), false);

const html = headHtml({ ...home, title: 'A "quoted" <title>', description: 'Tom & Jerry <b>' }, settings);
check("attribute values are escaped", html.includes('content="Tom &amp; Jerry &lt;b&gt;"'), true);
check("structured data cannot close its own script tag",
  jsonLdText({ a: "</script><script>alert(1)</script>" }).includes("</script>"), false);

// ---- 4. Small helpers -----------------------------------------------------
console.log("\nHelpers");

check("a description is cut at a word, under the limit",
  clip("word ".repeat(80)).length <= 158 && clip("word ".repeat(80)).endsWith("…"), true);
check("markdown marks don't leak into a description", clip("## A heading\n\n**bold** text"), "A heading bold text");
check("absolute addresses stay as they are", absUrl(ORIGIN, "https://cdn.example.com/a.jpg"), "https://cdn.example.com/a.jpg");
check("storefront addresses get the shell", ["/", "/product/x", "/shop", "/blog/a-post", "/privacy"].every(isShellPath), true);
check("files, the API and the admin don't",
  ["/assets/app-1.js", "/logo.png", "/api/store", "/admin/", "/images/abc", "/robots.txt", "/sitemap.xml"].some(isShellPath), false);

// ---- 5. The server finds the page an address names ------------------------
console.log("\nResolving an address");

// Just enough of D1 for the queries worker/seo.js makes.
function fakeDb() {
  const rows = {
    settings: { value: JSON.stringify(settings) },
    categories: categories.map((c) => ({ id: c.id, label: c.label, descr: c.desc, parent_id: c.parentId, image_url: null })),
    product: { id: "velvet-reign", name: "Velvet Reign", cat: "designer", brand: "", gender: "Female", notes: "Oud", descr: "A deep rose and oud extrait.", image_url: "/images/abc", live: 1 },
    variants: [{ id: 1, sku: "VR-30", size: "30ml", price_ngn: 25000, image_url: null }, { id: 2, sku: "VR-50", size: "50ml", price_ngn: 40000, image_url: null }],
  };
  return {
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...a) { args = a; return stmt; },
        async first() {
          if (/FROM settings/.test(sql)) return rows.settings;
          if (/FROM products WHERE id=/.test(sql)) return args[0] === "velvet-reign" ? rows.product : null;
          if (/FROM blog_posts/.test(sql)) return null;
          if (/FROM content_pages/.test(sql)) return args[0] === "privacy" ? { slug: "privacy", title: "Privacy & cookies", seo_title: "", seo_desc: "" } : null;
          return null;
        },
        async all() {
          if (/FROM categories/.test(sql)) return { results: rows.categories };
          if (/FROM variants/.test(sql)) return { results: rows.variants };
          if (/FROM product_images/.test(sql)) return { results: [] };
          if (/FROM stock/.test(sql)) return { results: [{ variant_id: 1, location_id: "abuja", qty: 4 }] };
          if (/DISTINCT brand/.test(sql)) return { results: [{ brand: "Maison Alhambra" }] };
          return { results: [] };
        },
      };
      return stmt;
    },
  };
}
const env = { DB: fakeDb() };
const at = (path) => resolveHead(env, new URL(ORIGIN + path));

const r1 = await at("/product/velvet-reign?variant=VR-30");
check("a product address resolves to that product and size", [r1.status, r1.head.title], [200, "Velvet Reign 30ml | Majestic Roobee"]);
const r2 = await at("/product/nothing-here");
check("a product that doesn't exist is a 404, kept out of search", [r2.status, r2.head.noindex], [404, true]);
const r3 = await at("/privacy");
check("a published information page resolves", [r3.status, r3.head.title], [200, "Privacy & cookies | Majestic Roobee"]);
const r4 = await at("/never-written");
check("a page nobody published is a 404", r4.status, 404);
const r5 = await at("/some/deep/path");
check("an address the router doesn't know is a 404, not the home page", r5.status, 404);
const r6 = await at("/brand/maison-alhambra");
check("a brand address names the brand properly", r6.head.title, "Maison Alhambra | Majestic Roobee");
const r7 = await at("/shop?q=oud");
check("a search result page is kept out of search", r7.head.noindex, true);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
