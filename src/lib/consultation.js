// The Perfume Studio's consultation booking — its copy, and its calendar.
//
// Two things live here because two places need to agree about them: the page
// the shopper reads, and the settings panel the house edits it from. Same
// arrangement as `src/lib/about.js` — an empty box is not an instruction to
// publish a blank page, it means "use the words the store shipped with", and
// the panel has a button that loads those words into the box for someone who
// only wants to change a sentence.
//
// The calendar is Calendly, embedded rather than linked: the client asked that
// a customer finish the booking without leaving the site. It goes in as a plain
// iframe pointed at Calendly's own page. No Calendly script is loaded, for the
// same reason the testimonial embeds load none — nothing third-party then runs
// on the store, so nothing third-party can slow it down or watch the shopper.

export const CONSULT_DEFAULTS = {
  eyebrow: "The Perfume Studio",
  headline: "Book a perfume consultation",
  intro: "Sit down with us and find the scent that is actually yours — not the one that was on the shelf.",
  body: [
    "A consultation is an hour in the studio with someone who does this every day. We talk through what you already wear and what you have never got on with, work out which families your nose keeps returning to, and put a shortlist in front of you to try properly — on skin, over time, rather than on a paper strip in a hurry.",
    "## What happens",
    "You tell us who it is for and what it is for: every day, the office, an evening, a wedding, a gift for somebody you know well. We take you through the house's blends and the designer pieces we carry, and narrow it down together.",
    "Nothing is bought on the day unless you want it to be. If a piece needs living with, we will say so.",
    "## Bring",
    "Whatever you are wearing now, if you have it — a half-empty bottle tells us more than a description does. Come with bare skin on at least one wrist.",
  ].join("\n\n"),
  ctaLabel: "Book a consultation",
  fallbackTitle: "The calendar isn't open yet",
  seoTitle: "Book a perfume consultation — the Perfume Studio",
  seoDesc: "Book a one-to-one perfume consultation at the Majestic Roobee Perfume Studio. Pick a date and time that suits you.",
};

/** Paragraphs and headings, in the same plain-text convention as the blog. */
export const blocks = (text) =>
  String(text || "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

/**
 * A Calendly link turned into one that can be framed.
 *
 * Only calendly.com is accepted, and deliberately: the Content-Security-Policy
 * names that origin and nothing else, so a link to anywhere else would frame a
 * blank rectangle with an error in the console. Refusing it here means the
 * house is told "that isn't a Calendly link" in the admin instead.
 *
 * `embed_domain` is what tells Calendly it is inside someone else's page — it
 * sizes itself to the frame and posts its height back. `embed_type=Inline`
 * picks the flat calendar rather than the pop-up.
 */
export function calendlyEmbedUrl(raw, host = "") {
  const value = String(raw || "").trim();
  if (!value) return "";
  let u;
  try {
    u = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch { return ""; }
  if (u.protocol !== "https:") return "";
  if (u.hostname !== "calendly.com" && !u.hostname.endsWith(".calendly.com")) return "";
  // Keep whatever the house put on the link — a prefilled name, a UTM — and
  // set the embed parameters over the top of it.
  u.searchParams.set("embed_domain", host || "majesticroobee");
  u.searchParams.set("embed_type", "Inline");
  u.searchParams.set("hide_gdpr_banner", "1");
  return u.toString();
}

/** True for a string the house could plausibly have meant as a Calendly link. */
export const isCalendlyUrl = (raw) => calendlyEmbedUrl(raw, "x") !== "";

/** Open unless the house has switched it off. See `consultationContent`. */
export const isConsultOn = (settings = {}) => {
  const v = (settings || {}).consultOn;
  return !(v === "0" || v === 0 || v === false);
};

/**
 * The page, resolved: the house's words where it has written them, the
 * shipped ones where it hasn't.
 *
 * `on` follows the studio's switch. It ships *on*: the house asked for the
 * booking button in the header, and a switch that defaulted to off meant it
 * went live invisible — the button, the tab and the page were all hidden until
 * somebody found the setting. Only an explicit "0" (the switch turned off in
 * Admin → Settings) closes it. Open with no Calendly link yet is still never a
 * dead end: the page offers the phone and the contact form instead.
 */
export function consultationContent(settings = {}, host = "") {
  const s = settings || {};
  const pick = (key, fallback) => (String(s[key] ?? "").trim() || fallback);
  return {
    on: isConsultOn(s),
    eyebrow: pick("consultEyebrow", CONSULT_DEFAULTS.eyebrow),
    headline: pick("consultHeadline", CONSULT_DEFAULTS.headline),
    intro: pick("consultIntro", CONSULT_DEFAULTS.intro),
    blocks: blocks(pick("consultBody", CONSULT_DEFAULTS.body)),
    ctaLabel: pick("consultCtaLabel", CONSULT_DEFAULTS.ctaLabel),
    imageUrl: String(s.consultImage || "").trim(),
    calendarUrl: calendlyEmbedUrl(s.consultCalendlyUrl, host),
    // What the page says when the studio is open for bookings but the calendar
    // has not been connected yet. It must never be a dead end: the shopper is
    // handed the studio's own phone and the contact form instead.
    hasCalendar: calendlyEmbedUrl(s.consultCalendlyUrl, host) !== "",
    seoTitle: pick("consultSeoTitle", CONSULT_DEFAULTS.seoTitle),
    seoDesc: pick("consultSeoDesc", CONSULT_DEFAULTS.seoDesc),
  };
}
