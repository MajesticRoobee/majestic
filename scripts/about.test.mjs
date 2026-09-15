// The About page as content, exercised directly.
//
// The page used to be typed into `pages.jsx`, so changing a word was a deploy.
// It reads settings now, and three rules make that safe rather than fragile:
//
//   · an empty box is not an instruction to publish a blank heading — it falls
//     back to the words the store shipped with
//   · the home page's story band and the About page read *one* story, so the
//     opening paragraph a shopper sees on the home page is the one the page
//     itself opens with
//   · a setting nobody allowed through `PUT /api/admin/settings` is a box that
//     silently forgets what was typed into it, so every key this page reads is
//     checked against that list
import { readFileSync } from "node:fs";
import { aboutContent, paragraphs, ABOUT_DEFAULTS, FOUNDER_PHOTO } from "../src/lib/about.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

// ---- 1. The store before anybody edits it ---------------------------------
console.log("\nThe shipped copy");

const shipped = aboutContent({});
check("the heading is the one the page shipped with", shipped.headline, ABOUT_DEFAULTS.headline);
check("...and the line above it", shipped.eyebrow, ABOUT_DEFAULTS.eyebrow);
check("what the house says about itself is four paragraphs", shipped.intro.length, 4);
check("the founder's story is six", shipped.story.length, 6);
check("it opens in her own voice", shipped.story[0].startsWith("My name is Peace Ijeoma Jonathan"), true);
check("the portrait falls back to the one in the build", shipped.founderPhoto, FOUNDER_PHOTO);
check("the stores are shown", shipped.storesOn, true);
check("the band at the foot is the shipped one", [shipped.cta.title, shipped.cta.label], [ABOUT_DEFAULTS.ctaTitle, ABOUT_DEFAULTS.ctaLabel]);
check("and so is the search result", shipped.seoTitle, ABOUT_DEFAULTS.seoTitle);
check("nothing about it depends on being handed a settings object at all",
  aboutContent().headline, ABOUT_DEFAULTS.headline);

// ---- 2. The house's own words win -----------------------------------------
console.log("\nWhat the house writes");

const edited = aboutContent({
  aboutEyebrow: "The house",
  aboutHeadline: "Who we are",
  aboutIntro: "We make perfume.\n\nWe make it here.",
  storyTitle: "How it started",
  storyBody: "One.\n\nTwo.\n\nThree.",
  founderName: "Ada Obi",
  founderRole: "Perfumer",
  founderImage: "/images/42",
  aboutCtaTitle: "Come and smell",
  aboutCtaSub: "Everything we make.",
  aboutCtaLabel: "Shop",
  aboutSeoTitle: "About us | The house",
  aboutSeoDesc: "Who we are.",
});
check("the heading is theirs", [edited.eyebrow, edited.headline], ["The house", "Who we are"]);
check("a blank line starts a new paragraph", edited.intro, ["We make perfume.", "We make it here."]);
check("the story is theirs, in their order", edited.story, ["One.", "Two.", "Three."]);
check("so is the name under the photograph", [edited.founderName, edited.founderRole], ["Ada Obi", "Perfumer"]);
check("an uploaded portrait replaces the shipped one", edited.founderPhoto, "/images/42");
check("the band at the foot is theirs", [edited.cta.title, edited.cta.sub, edited.cta.label],
  ["Come and smell", "Everything we make.", "Shop"]);
check("and the search result", [edited.seoTitle, edited.seoDesc], ["About us | The house", "Who we are."]);

// ---- 3. An emptied box is not a blank page --------------------------------
console.log("\nEmptied, not blanked");

const cleared = aboutContent({ aboutHeadline: "", aboutIntro: "   \n\n  ", storyBody: "\n", founderName: "  ", aboutSeoDesc: "" });
check("clearing the heading restores the shipped one", cleared.headline, ABOUT_DEFAULTS.headline);
check("...and the paragraphs under it", cleared.intro.length, 4);
check("...and the story", cleared.story.length, 6);
check("...and the name under the photograph", cleared.founderName, ABOUT_DEFAULTS.founderName);
check("...and the search description", cleared.seoDesc, ABOUT_DEFAULTS.seoDesc);
check("the page can never open with an empty story, which the home band reads the first line of",
  typeof aboutContent({ storyBody: "" }).story[0], "string");

// ---- 4. How prose is written ----------------------------------------------
console.log("\nThe writing convention");

check("blank lines separate blocks; a single newline does not",
  paragraphs("One line\nstill the same paragraph\n\nA second one"),
  ["One line\nstill the same paragraph", "A second one"]);
check("runs of blank lines are one break, not several empty paragraphs",
  paragraphs("A\n\n\n\nB"), ["A", "B"]);
check("trailing whitespace is not a paragraph", paragraphs("A\n\n   \n\n"), ["A"]);
check("a heading is carried through for the page to draw",
  paragraphs("## Our promise\n\nWe mean it")[0], "## Our promise");
check("nothing at all is no blocks, not one empty one", paragraphs(""), []);

// ---- 5. The stores grid ----------------------------------------------------
console.log("\nThe stores grid");

check("it shows unless it is switched off", aboutContent({}).storesOn, true);
check("off means off", aboutContent({ aboutStoresOn: false }).storesOn, false);
check("a setting that was never saved is not 'off'", aboutContent({ aboutStoresOn: undefined }).storesOn, true);

// ---- 6. Every key can actually be saved ------------------------------------
//
// `PUT /api/admin/settings` copies an allow-list of keys and drops the rest, so
// a field added to the screen but not to that list is a box that forgets what
// was typed into it the moment the page reloads — and nothing else would fail.
console.log("\nThe screen and the server agree");

const workerSrc = readFileSync(new URL("../worker/admin.js", import.meta.url), "utf8");
const adminSrc = readFileSync(new URL("../src/admin/pages-growth.jsx", import.meta.url), "utf8");
const keys = [
  "aboutEyebrow", "aboutHeadline", "aboutIntro", "storyTitle", "storyBody",
  "founderName", "founderRole", "founderImage", "aboutStoresOn",
  "aboutCtaTitle", "aboutCtaSub", "aboutCtaLabel", "aboutSeoTitle", "aboutSeoDesc",
];
check("the server accepts every key the About page reads",
  keys.filter((k) => !workerSrc.includes(`"${k}"`)), []);
check("...and the Settings screen saves every one of them",
  keys.filter((k) => !adminSrc.includes(`"${k}"`)), []);

console.log(failures ? `\n${failures} failing\n` : "\nAll good\n");
process.exit(failures ? 1 : 0);
