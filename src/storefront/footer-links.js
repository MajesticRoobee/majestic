// The footer's columns, as the website copy brief lays them out — Shop, About,
// Rewards, Help and Follow us — shared by the desktop footer and the phone's
// so the two list the same links in the same order.
//
// Every link goes somewhere real. A category the shop has since removed, a
// social account with no address set in Admin → Settings → Footer, or an
// information page that isn't published is left out rather than shown as a
// link to nothing.
import { routeToPath } from "./router.js";

// The shop column, in the brief's order. Labels come from the categories
// themselves, so a rename in the admin reaches the footer too.
const SHOP_CATS = ["perfumes", "perfume-oils", "mist", "care", "home", "wellness"];

export const FOOTER_SOCIALS = [
  { id: "instagram", name: "Instagram", setting: "igUrl" },
  { id: "tiktok", name: "TikTok", setting: "tiktokUrl" },
  { id: "facebook", name: "Facebook", setting: "facebookUrl" },
];

// Open a page, then bring one part of it into view — the FAQ's shipping answer,
// the home page's rewards section. If the part isn't there, the shopper is
// still on the right page.
const scrollTo = (id) => setTimeout(() => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}, 120);

export function footerColumns(ctx) {
  const page = (label, name, extra) => ({
    label, href: routeToPath(name, extra), go: () => ctx.nav(name, extra),
  });
  const anchor = (label, name, id, href) => ({
    label, href, go: () => { ctx.nav(name); scrollTo(id); },
  });
  const published = new Set((ctx.pages || []).map((p) => p.slug));
  const info = (label, slug) => ({
    label, href: `/${slug}`, go: () => ctx.nav("info", { pageSlug: slug }),
  });
  const byId = new Map((ctx.categories || []).map((c) => [c.id, c]));
  const settings = ctx.settings || {};

  return [
    {
      title: "Shop",
      links: [
        ...SHOP_CATS.filter((id) => byId.has(id)).map((id) => page(byId.get(id).label, "shop", { fCat: id, fSeg: null, fBrand: "", fCol: null })),
        page("Best sellers", "shop", { fCat: "all", fSeg: "best-sellers", fBrand: "", fCol: null }),
      ],
    },
    {
      title: "About",
      links: [page("Our story", "about"), page("Contact us", "contact"), page("FAQs", "faq")],
    },
    // The rewards section on the home page is the programme's explanation;
    // there is no page of its own to send anyone to.
    ...(settings.rewardsOn === false ? [] : [{
      title: "Rewards",
      links: [anchor("Majestic Roobee Rewards", "home", "rewards", "/#rewards")],
    }]),
    {
      title: "Help",
      links: [
        // A published information page wins; until then the FAQ answers it.
        published.has("shipping") ? info("Shipping & delivery", "shipping") : anchor("Shipping & delivery", "faq", "shipping", "/faq#shipping"),
        published.has("returns") ? info("Returns & exchanges", "returns") : anchor("Returns & exchanges", "faq", "returns", "/faq#returns"),
        ...(published.has("privacy") ? [info("Privacy policy", "privacy")] : []),
        ...(published.has("terms") ? [info("Terms & conditions", "terms")] : []),
      ],
    },
    {
      title: "Follow us",
      links: FOOTER_SOCIALS.filter((so) => settings[so.setting])
        .map((so) => ({ id: so.id, label: so.name, href: settings[so.setting], external: true })),
    },
  ].filter((col) => col.links.length);
}
