// The About page as content rather than as JSX.
//
// Everything on /about used to be typed into `pages.jsx`: the headline, the
// four lines that say what the house is, the founder's story in full, and the
// band at the foot of it. Changing a word meant a deploy. None of it is code —
// it is the client's own writing — so it lives in settings now, and this file
// holds the copy the store *opens* with plus the one function that merges the
// house's edits over it.
//
// The defaults are not a placeholder: an empty field in Admin → Settings falls
// back to the paragraph below it, so clearing a box restores the shipped copy
// rather than leaving a hole in the page. The home page's story band reads the
// same title, the same opening paragraph and the same name, so the two can
// never drift apart.

// The founder's portrait ships with the build, so the story is never wordless
// while someone finds a photograph. `founderImage` (Admin → Settings) replaces
// it without a deploy, the same way the logo works.
export const FOUNDER_PHOTO = "/founder.jpg";

// The founder's story, exactly as the client wrote it. The About page runs it
// in full; the home page's story band shows the opening paragraph and links
// through.
const STORY = [
  "My name is Peace Ijeoma Jonathan, founder of Majesticroobee. Most people assume this story began with perfume. It didn't. It began with a woman waiting to become a mother. There was a season in my life when I was trusting God for a child. It was a quiet season filled with prayers, hope, questions and waiting. Someone once told me that if I was to believe in God for children, I should spend more time around children. I held on to those words and moved straight to get a job in a school. At the time, I thought I was simply giving my heart something meaningful to do while I waited on God. I had no idea that the place I entered because I was waiting would become the place where He was quietly preparing me for work I never imagined I would one day do.",
  "The children quickly became part of my heart, but so did their mothers. Every conversation, every school run and every interaction reminded me that every woman was carrying something, even when she smiled. Somewhere in the middle of that season, one of my colleagues introduced me to someone who brought attars into Nigeria. At the time, hardly anyone knew what they were. I was fascinated. I had always loved beautiful scents, but this was different. It opened a world I couldn't stop exploring. I learnt, I practised, I asked questions, and I kept learning. What started as curiosity slowly became purpose, and over the years that journey led me to become an internationally certified natural perfumer. Looking back now, I realise that what felt like an ordinary introduction was one of the quiet miracles hidden inside my season of waiting.",
  "Life continued to unfold, and I became a mother. Motherhood changed me in ways I never expected. It introduced me to depths of love I had never known, but it also introduced me to a kind of grief that words still struggle to hold. Long before people came to know the name Majesticroobee, there was a little girl named Ruby. She lived for only twenty days, but she changed me forever. Losing her broke something in me, but it also awakened something in me. It made me pay closer attention to women, to our bodies, to our emotions and to the battles we carry without anyone noticing. I had lived through the waiting, the pregnancy, the birth, the joy, the loss, the hormonal changes, the exhaustion, the isolation and the quiet search for myself again. As I spoke with more women, I realised I wasn't alone. Different homes, different stories, but the same questions. The same desire to feel whole again. The same longing to understand our bodies deeply, to feel like ourselves again. The same hope that somewhere beneath everything life had placed on us, we could still find ourselves.",
  "As I searched for answers for myself, I found myself searching for answers for other women too. I enrolled in schools, studied relentlessly and refused to stop asking questions. The more I learnt, the more I understood that what a woman puts on her body is never just about appearance. It touches her emotions, her confidence, her memories, her routines and sometimes even the way she sees herself. Around the same time, I found myself thinking often about my own mother. I grew up in a very Nigerian home with a very Nigerian mother who believed that cleanliness, good character and intentional living mattered. She read labels, questioned ingredients and paid close attention to what entered our home. She loved looking beautiful and smelling beautiful, but she never believed beauty should come at the expense of her health. She also never allowed motherhood to erase the woman she was. She continued to care for herself with grace and intention, and although I didn't know it then, she was quietly planting seeds that would later shape everything I believed about women's wellness and self-care.",
  "As the years passed, every part of my journey slowly came together. The waiting. The classroom. The mothers I had met. My own experiences of womanhood. The lessons my mother had quietly lived before me. The years of studying natural perfumery and understanding the connection between scent, emotion and wellbeing. Then life carried me to Bonny Island. It was there that everything I had been learning finally found people. For the first time, women were not just hearing me talk about fragrance; they were experiencing it for themselves. They wore the products, shared their honest experiences, came back for more and introduced them to other women. Watching those conversations happen made something very clear to me. This was no longer just something I loved. It had become something that genuinely served women. It was also in Bonny Island that the vision became clear enough to give it a name. I called it Majesticroobee. It is a name that carries love, but it also carries strength, courage and resilience. More importantly, it carries a responsibility. Today, we are building for the women who are here, for the little girls who are quietly becoming tomorrow's women and for the generations still waiting to arrive. Every decision we make is guided by one belief: every woman deserves to feel safe in her body, confident in herself and deeply connected to who she is, no matter what season of life she is walking through.",
  "Today, when people ask me how I built a fragrance brand, I smile because I know the answer has very little to do with perfume. This brand was built in classrooms, in hospital rooms, in seasons of waiting, in motherhood, in grief, in healing and in years of learning how to care for women well. Every bottle we make carries a small piece of that journey. Majesticroobee is more than the name of a company. It is the story of where God met me, where He restored me and where He gave purpose to every season I once struggled to understand. ",
];

// What the page says before anybody edits it.
export const ABOUT_DEFAULTS = {
  eyebrow: "About us",
  headline: "Who are we?",
  intro: [
    "Majestic Roobee is a Nigerian fragrance brand created for men and women who are intentional about what they put on their body.",
    "We believe fragrance is more than smelling good. It should be safe, unique and made intentionally.",
    "That is why we create perfumes, perfume oils, body mists, feminine care and home fragrances designed to make everyday moments feel a little more special.",
    "Our vision is to grow into one of Africa's leading fragrance houses while creating intentional products you can enjoy, trust and make part of your everyday routine.",
  ].join("\n\n"),
  storyTitle: "How I never set out to build a fragrance brand",
  story: STORY.join("\n\n"),
  founderName: "Peace Ijeoma Jonathan",
  founderRole: "Founder, Majestic Roobee",
  ctaTitle: "Find something that smells like you",
  ctaSub: "Perfumes, perfume oils, body mists, feminine care and home fragrances.",
  ctaLabel: "Shop fragrances",
  seoTitle: "About Majestic Roobee | Nigerian Fragrance Brand",
  seoDesc: "Discover the story behind Majestic Roobee, a Nigerian fragrance brand creating luxury, safe, non-toxic perfumes, fragrance oils, body mists, feminine care, wellness products and home fragrances for modern women.",
};

// A setting only counts when it has something in it. A box someone emptied is
// not an instruction to publish a blank heading.
const text = (v, fallback) => {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  return s || fallback;
};

/**
 * Prose written the way the blog is written: a blank line between blocks, and
 * `## ` at the head of a line for a heading. Returns the blocks in order.
 */
export function paragraphs(body) {
  return String(body || "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
}

/**
 * The About page, resolved: the house's words where it has written them, the
 * shipped copy everywhere else. Pure — it reads the settings object the
 * storefront is already given and nothing else.
 */
export function aboutContent(settings = {}) {
  const s = settings || {};
  return {
    eyebrow: text(s.aboutEyebrow, ABOUT_DEFAULTS.eyebrow),
    headline: text(s.aboutHeadline, ABOUT_DEFAULTS.headline),
    intro: paragraphs(text(s.aboutIntro, ABOUT_DEFAULTS.intro)),
    storyTitle: text(s.storyTitle, ABOUT_DEFAULTS.storyTitle),
    story: paragraphs(text(s.storyBody, ABOUT_DEFAULTS.story)),
    founderName: text(s.founderName, ABOUT_DEFAULTS.founderName),
    founderRole: text(s.founderRole, ABOUT_DEFAULTS.founderRole),
    founderPhoto: text(s.founderImage, FOUNDER_PHOTO),
    // The stores grid is the one section that can be switched off outright: a
    // house trading online only has no addresses to show.
    storesOn: s.aboutStoresOn !== false,
    cta: {
      title: text(s.aboutCtaTitle, ABOUT_DEFAULTS.ctaTitle),
      sub: text(s.aboutCtaSub, ABOUT_DEFAULTS.ctaSub),
      label: text(s.aboutCtaLabel, ABOUT_DEFAULTS.ctaLabel),
    },
    seoTitle: text(s.aboutSeoTitle, ABOUT_DEFAULTS.seoTitle),
    seoDesc: text(s.aboutSeoDesc, ABOUT_DEFAULTS.seoDesc),
  };
}
