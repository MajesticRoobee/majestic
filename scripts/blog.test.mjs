// The blog's preview, exercised directly.
//
// The reported fault was a blog index that rendered three whole articles
// stacked on top of each other. The field behind the card was called "excerpt",
// was optional, had no limit, and nothing derived one when it was left empty —
// so somebody pasted the story into it and the index became unreadable.
//
// The fix is one definition of a preview, enforced in three places: the editor
// counts it as you type, the API clamps what it stores, and the storefront
// clamps again on the way out so the posts written before any of this existed
// come back short without anybody re-editing them. This file is that
// definition.
import { clamp, previewOf, words, paragraphs, plain, readingMinutes, PREVIEW_MAX, TITLE_MAX, TITLE_MAX_WORDS } from "../src/lib/blog.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

// ---- 1. A preview is short ------------------------------------------------
console.log("\nThe cut");

check("something already short comes back untouched, with no ellipsis",
  clamp("Three notes, one bottle."), "Three notes, one bottle.");

check("a preview is never longer than the limit",
  clamp("word ".repeat(200)).length <= PREVIEW_MAX, true);

check("no word is cut in half",
  /\S$/.test(clamp("antediluvian ".repeat(40)).replace(/…$/, "")) &&
  !clamp("antediluvian ".repeat(40)).replace(/…$/, "").endsWith("antediluvia"), true);

// This is the difference between a preview and a truncation: if a sentence
// closes in the back half of what fits, the preview ends on it and reads as a
// finished thought.
const twoSentences = `${"a".repeat(140)}. ${"b".repeat(200)}`;
check("it prefers to end on a sentence", clamp(twoSentences).endsWith("."), true);
check("...and drops the ellipsis when it does", clamp(twoSentences).endsWith("…"), false);

// ...but only if the sentence ends late enough to still be a preview. A story
// opening "Yes." must not preview as the word "Yes."
check("a sentence ending too early is not the whole preview",
  clamp(`Yes. ${"c".repeat(400)}`).length > 100, true);

check("a trailing comma does not survive the cut",
  /[,;:\-–—]…$/.test(clamp(`${"word ".repeat(40)}something, ${"more ".repeat(40)}`)), false);

check("runs of whitespace and newlines collapse to single spaces",
  clamp("One\n\n  two   three"), "One two three");

check("nothing in is nothing out", [clamp(""), clamp(null), clamp(undefined)], ["", "", ""]);

// ---- 2. An empty box is not an empty card --------------------------------
console.log("\nWhen the writer left it blank");

const body = "The first thing worth knowing about oud.\n\n## A heading\n\nAnd then more.";
check("the preview falls back to the story's opening",
  previewOf("", body), "The first thing worth knowing about oud.");

check("what the writer wrote always wins", previewOf("Their own line.", body), "Their own line.");

check("a story opening on a heading previews its first paragraph, not the heading",
  previewOf("", "## How to layer a scent\n\nStart with the heaviest."), "Start with the heaviest.");

check("...nor a pull quote",
  previewOf("", "> Scent is memory.\n\nWhich is why it works."), "Which is why it works.");

check("...nor a photograph",
  previewOf("", "/images/img_abc\n\nThe bottle arrived on Tuesday."), "The bottle arrived on Tuesday.");

check("a story that is only a picture has no preview rather than a broken one",
  previewOf("", "https://example.com/a.jpg"), "");

check("a post with neither previews as nothing", previewOf("", ""), "");

// The reported post: the whole article in the preview box.
const essay = "Discover three crazy fragrances no man can resist on you. ".repeat(20);
check("an article pasted into the preview box is cut to a preview on the way out",
  previewOf(essay).length <= PREVIEW_MAX, true);
check("...and still ends on a whole sentence", previewOf(essay).endsWith("."), true);

// The clamp has to be idempotent, or a post re-saved twice loses a word each
// time and the ellipsis stacks.
const once = clamp(essay);
check("clamping an already-clamped preview changes nothing", clamp(once), once);
check("...including one that had to end in an ellipsis",
  clamp(clamp("antediluvian ".repeat(40))), clamp("antediluvian ".repeat(40)));

// ---- 3. The heading ------------------------------------------------------
console.log("\nThe heading the writer is counted on");

check("words are counted, not characters", words("How to make an extrait last all day"), 8);
check("...and whitespace is not a word", words("  one   two  "), 2);
check("nothing is no words", [words(""), words(null)], [0, 0]);
check("a heading that fits a card is inside both lines",
  ["How to make an extrait last all day".length <= TITLE_MAX, words("How to make an extrait last all day") <= TITLE_MAX_WORDS],
  [true, true]);
// The limits have to be in the order the editor assumes: the character limit is
// the one enforced, and the word count is advisory beneath it.
check("the character limit is the tighter of the two for long words",
  TITLE_MAX < TITLE_MAX_WORDS * 12, true);

// ---- 4. The story, as pasted --------------------------------------------
console.log("\nA story pasted from a document");

// The reported "still shows full": a post pasted from Google Docs arrives with
// one line break between paragraphs and its headings as plain short lines, and
// used to render as a single wall of text.
const pasted = "Layering is an art that takes a little patience and practice.\nWhy oils first\nFragrance clings to moisturised skin far longer than it does to dry skin.\nThe mist last\nA mist over the hair carries the scent around you as you move.";
const kinds = paragraphs(pasted).map((b) => b.type);
check("single line breaks separate paragraphs", kinds.length, 5);
check("a short unmarked line before a paragraph is read as a heading",
  kinds, ["p", "h", "p", "h", "p"]);
check("the preview of a pasted story is its first paragraph, not the whole thing",
  previewOf("", pasted), "Layering is an art that takes a little patience and practice.");

check("a sentence is never mistaken for a heading",
  paragraphs("It lasts.\nAnd then it lasts some more, well into the evening.").map((b) => b.type), ["p", "p"]);
check("the last line is never a heading — nothing follows it",
  paragraphs("A longer opening paragraph about scent.\nWith love").map((b) => b.type), ["p", "p"]);
check("marked headings still work", paragraphs("## Notes\n\nText here.")[0], { type: "h", text: "Notes" });
check("a bulleted list is one block",
  paragraphs("Bring:\n- your bottle\n- bare wrists")[1], { type: "ul", items: ["your bottle", "bare wrists"] });
check("a numbered list is an ordered block",
  paragraphs("1. Oil\n2. Extrait\n3. Mist")[0], { type: "ol", items: ["Oil", "Extrait", "Mist"] });
check("Windows line endings read the same",
  paragraphs("One para.\r\n\r\nTwo para.").length, 2);

check("the writer's marks never reach a preview",
  plain("A **bold** claim, an *aside* and [a link](https://x.com)."), "A bold claim, an aside and a link.");
check("...including in the preview box itself", previewOf("**Big** news"), "Big news");
check("arithmetic is not italic", plain("5 * 3 * 2"), "5 * 3 * 2");

check("reading time is at least a minute", readingMinutes("Short."), 1);
check("...and counts a long story honestly", readingMinutes("word ".repeat(1100)), 5);

console.log(failures ? `\n${failures} failing` : "\nAll good");
process.exit(failures ? 1 : 0);
