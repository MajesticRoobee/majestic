// What a blog post promises before you open it.
//
// A card in the grid, the strip on the home page and the line under a title in
// search results all show the same thing: a *preview*. The field behind it was
// called "excerpt", was optional, had no limit, and nothing derived one when it
// was left empty — so the natural thing happened. Somebody pasted the whole
// article into it, and the blog index became three full essays stacked on top
// of each other with no way to tell them apart.
//
// So: one definition of a preview, shared by the screen that writes it, the
// server that stores and serves it, and the page that draws it. A limit the
// writer can see while typing, enforced again on the way in, and enforced once
// more on the way out so the posts already written come back short without
// anybody having to re-edit them.

/** The preview is two or three sentences. Past this it stops being a preview. */
export const PREVIEW_MAX = 220;

/**
 * A heading has to sit on one or two lines on a card. Past this it wraps to
 * four and the grid goes ragged — which is the "messy" the house is pointing
 * at. Both counts are shown while typing; the character one is what is
 * enforced, because a heading of six long words breaks the layout that twelve
 * short ones survive.
 */
export const TITLE_MAX = 70;
export const TITLE_MAX_WORDS = 12;

export const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;

/**
 * Cut `text` to at most `max` characters without cutting a word in half.
 *
 * Prefers to end on a sentence: if one closes in the back half of what fits,
 * the preview ends there and reads as a finished thought rather than a
 * truncation. Otherwise it stops at the last whole word and says so with an
 * ellipsis. Text already inside the limit is returned untouched — no ellipsis
 * on a preview that isn't hiding anything.
 *
 * Two rules that look like details and are not:
 *
 *   · the ellipsis is paid for out of the budget, so the result is never
 *     *longer* than `max`. That is what makes this idempotent — the API
 *     clamps on the way in and the storefront clamps again on the way out, and
 *     a post saved four times must not lose a word and gain a dot each time.
 *   · a cut point in the first half of the budget is no cut point at all. A
 *     story opening "Yes." would otherwise preview as the word "Yes", and a
 *     long unbroken run with one early space would preview as nothing.
 */
export function clamp(text, max = PREVIEW_MAX) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const room = max - 1; // the ellipsis takes the last character
  const head = s.slice(0, room + 1);
  const floor = max * 0.5;
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (sentence >= floor) return head.slice(0, sentence + 1);
  const space = head.lastIndexOf(" ");
  const cut = space >= floor ? head.slice(0, space) : head.slice(0, room);
  return `${cut.replace(/[,;:\-–—\s]+$/, "")}…`;
}

/**
 * The preview for a post: what the writer wrote, clamped — and if they wrote
 * nothing, the opening of the story, clamped the same way.
 *
 * The fallback skips anything that isn't prose. A post that opens on a heading
 * or a photograph would otherwise preview as "## How to layer a scent" or as a
 * bare image address, which is worse than no preview at all.
 */
export function previewOf(excerpt, body = "") {
  const written = String(excerpt || "").trim();
  if (written) return clamp(written);
  const first = String(body || "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .find((b) => b && !b.startsWith("## ") && !b.startsWith("> ") && !/^(https?:\/\/|\/images\/)\S+$/.test(b));
  return first ? clamp(first) : "";
}
