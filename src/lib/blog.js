// What a blog post promises before you open it, and how the story reads once
// you have.
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
//
// The second half of this file is the story itself. Posts are pasted in from
// Google Docs, Word and WhatsApp far more often than they are typed, and those
// paste with a *single* line break between paragraphs and headings that are
// just short lines. Read strictly as "a blank line separates paragraphs", that
// arrives as one wall of text with the headings run into it — which is what
// the house was looking at when it said the blog "still shows full". So the
// reader here is forgiving: it accepts both conventions, spots a heading that
// was never marked as one, and understands the handful of marks a writer
// actually uses (bold, italic, a list, a link).

/**
 * The preview is a sentence or two — a promise, not a summary. Past this it
 * stops being a preview and the card starts reading as the article.
 */
export const PREVIEW_MAX = 160;

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
 * Text with the writer's marks taken off — for a preview, a search snippet or
 * anywhere else the marks would show as literal asterisks.
 */
export function plain(text) {
  return String(text || "")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)\s]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/^#{1,4}\s+/gm, "");
}

const IMAGE_LINE = /^(https?:\/\/|\/images\/)\S+$/;
const HEADING_MARK = /^#{1,4}\s+/;
const BULLET = /^\s*(?:[-•*]|–)\s+/;
const NUMBERED = /^\s*\d{1,2}[.)]\s+/;

// A line nobody marked as a heading but everybody reads as one: short, no
// sentence-ending punctuation, and followed by something longer. Pasted
// documents lose their heading styles and keep exactly this shape.
function looksLikeHeading(line, next) {
  const s = line.trim();
  if (!s || !next) return false;
  if (s.length > 70 || words(s) > 10) return false;
  if (/[.,;!?…"'”’)]$/.test(s)) return false;
  if (!/^[A-Z0-9“"‘']/.test(s)) return false;
  if (BULLET.test(s) || NUMBERED.test(s) || IMAGE_LINE.test(s)) return false;
  return next.trim().length > s.length;
}

/**
 * A story, read into blocks: `{ type: "h" | "p" | "quote" | "img" | "ul" | "ol", text?, src?, items? }`.
 *
 * Accepts both conventions a writer brings: a blank line between paragraphs,
 * or a single line break (the Google Docs / WhatsApp paste). Headings may be
 * marked "## " or left as a short standalone line; lists are "- " or "1. ".
 * Nothing here produces HTML — the page renders these as elements, so nothing
 * a writer types is ever handed to the browser as markup.
 */
export function paragraphs(body) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
  // Lines grouped into runs separated by blank lines…
  const runs = [];
  let cur = [];
  for (const raw of lines) {
    if (raw.trim()) cur.push(raw.trim());
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);

  // …and each run split again on its single line breaks, except where those
  // breaks are holding a list or a quote together.
  const flat = [];
  for (const run of runs) {
    let i = 0;
    while (i < run.length) {
      const line = run[i];
      if (BULLET.test(line) || NUMBERED.test(line)) {
        const ordered = NUMBERED.test(line) && !BULLET.test(line);
        const re = ordered ? NUMBERED : BULLET;
        const items = [];
        while (i < run.length && re.test(run[i])) { items.push(run[i].replace(re, "").trim()); i++; }
        flat.push({ type: ordered ? "ol" : "ul", items });
        continue;
      }
      if (line.startsWith("> ")) {
        const q = [];
        while (i < run.length && run[i].startsWith("> ")) { q.push(run[i].slice(2).trim()); i++; }
        flat.push({ type: "quote", text: q.join(" ") });
        continue;
      }
      if (HEADING_MARK.test(line)) flat.push({ type: "h", text: line.replace(HEADING_MARK, "").trim() });
      else if (IMAGE_LINE.test(line)) flat.push({ type: "img", src: line });
      else flat.push({ type: "p", text: line });
      i++;
    }
  }

  // A short unmarked line that introduces a paragraph is a heading.
  return flat.map((b, i) => {
    if (b.type !== "p") return b;
    const next = flat[i + 1];
    if (next && next.type === "p" && looksLikeHeading(b.text, next.text)) return { type: "h", text: b.text };
    return b;
  });
}

/** Minutes to read, at an unhurried 220 words a minute. Never less than one. */
export function readingMinutes(body) {
  return Math.max(1, Math.round(words(plain(body)) / 220));
}

/**
 * The preview for a post: what the writer wrote, clamped — and if they wrote
 * nothing, the opening of the story, clamped the same way.
 *
 * The fallback skips anything that isn't prose. A post that opens on a heading
 * or a photograph would otherwise preview as "How to layer a scent" or as a
 * bare image address, which is worse than no preview at all.
 */
export function previewOf(excerpt, body = "") {
  const written = plain(excerpt).trim();
  if (written) return clamp(written);
  const first = paragraphs(body).find((b) => b.type === "p");
  return first ? clamp(plain(first.text)) : "";
}
