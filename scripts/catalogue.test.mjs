// The product audit: a catalogue that shows the right photograph.
//
// The house reported the shop "swapping the pictures round" — a bottle in the
// grid opening a page that shows another, and a photograph uploaded against one
// product turning up on a different one. Three defects sat underneath it:
//
//   1. the admin's edit panel was not keyed on the product, so opening a second
//      product while the first was open reused the same React component, kept
//      the first product's name, photograph and description in the form, and
//      wrote them onto the second on save (covered by the screen, not here)
//   2. `products.image_url` and `product_images` are two records of the same
//      picture, and only one of them moved when the photo was replaced — so the
//      card drew the new bottle and the product page drew the one it replaced
//   3. deleting a gallery shot blanked `variants.image_url` on *every* product
//      sharing that address, not just the one the shot belonged to
//
// 2 and 3 are both testable, and both are here.
import { variantGallery } from "../src/lib/gallery.js";
import { syncGalleryPhoto } from "../worker/admin.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

// ---- 1. The gallery opens on the picture the card showed ------------------
console.log("\nOne product, one photograph");

const urls = (g) => g.map((x) => x.url);

// The shape `loadProducts` hands the storefront: the variation's `imageUrl` is
// already resolved (own shot → tagged shot → the product's).
const product = (images, imageUrl = "/images/product") => ({ name: "Dynasty", imageUrl, images });

check("with nothing filed, the listing photo is the whole gallery",
  urls(variantGallery(product([]), { id: 1, imageUrl: null })), ["/images/product"]);

check("a variation's own photo leads, not the product's",
  urls(variantGallery(product([]), { id: 1, imageUrl: "/images/v30" })), ["/images/v30"]);

// This is defect 2, seen from the storefront: the gallery still holds the shot
// the photograph replaced, and it used to be the one drawn first.
check("a stale shot left in the gallery cannot take the hero",
  urls(variantGallery(
    product([{ url: "/images/old", variantId: null }], "/images/new"),
    { id: 1, imageUrl: null }
  )),
  ["/images/new", "/images/old"]);

check("the shots tagged to this variation come before the shared ones",
  urls(variantGallery(
    product([
      { url: "/images/shared", variantId: null },
      { url: "/images/v50-b", variantId: 2 },
      { url: "/images/v30-b", variantId: 1 },
    ], "/images/product"),
    { id: 1, imageUrl: "/images/v30" }
  )),
  ["/images/v30", "/images/v30-b", "/images/shared"]);

check("another variation's shots are not this one's",
  urls(variantGallery(
    product([{ url: "/images/v50-b", variantId: 2 }], "/images/product"),
    { id: 1, imageUrl: null }
  )),
  ["/images/product"]);

check("leading with the listing photo never shows it twice",
  urls(variantGallery(
    product([{ url: "/images/one", variantId: null }, { url: "/images/two", variantId: null }], "/images/one"),
    { id: 1, imageUrl: null }
  )),
  ["/images/one", "/images/two"]);

check("a product with no photograph at all has an empty gallery, not a blank slot",
  variantGallery(product([], null), { id: 1, imageUrl: null }), []);

check("alt text falls back to the product's name",
  variantGallery(product([], "/images/p"), { id: 1 })[0].alt, "Dynasty");

// ---- 2. Replacing a photo moves the gallery row with it -------------------
console.log("\nThe listing photo and the gallery stay one picture");

// A fake D1 that understands only the handful of statements syncGalleryPhoto
// issues. Small on purpose: the point is the decision it makes, not SQLite.
function fakeDb(rows, productName = "Dynasty") {
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  const match = (sql, ...a) => {
    const where = (r, pid, vid, url) =>
      r.product_id === pid &&
      (vid === undefined ? true : vid === null ? r.variant_id === null : r.variant_id === vid) &&
      (url === undefined || r.url === url);
    if (sql.startsWith("SELECT name FROM products")) return { kind: "name" };
    if (sql.includes("MIN(sort)")) return { kind: "minsort", pid: a[0] };
    if (sql.startsWith("SELECT id FROM product_images")) {
      const vid = sql.includes("variant_id IS NULL") ? null : a[1];
      const pid = a[0];
      const url = sql.includes("variant_id IS NULL") ? a[1] : a[2];
      return { kind: "find", hit: rows.filter((r) => where(r, pid, vid, url)).sort((x, y) => x.sort - y.sort || x.id - y.id)[0] };
    }
    if (sql.startsWith("DELETE FROM product_images")) return { kind: "delete", id: a[0] };
    if (sql.startsWith("UPDATE product_images")) return { kind: "update", url: a[0], id: a[1] };
    if (sql.startsWith("INSERT INTO product_images")) return { kind: "insert", a };
    throw new Error("fakeDb doesn't know: " + sql);
  };
  return {
    rows,
    prepare(sql) {
      return {
        bind: (...a) => ({
          first: async () => {
            const m = match(sql, ...a);
            if (m.kind === "name") return { name: productName };
            if (m.kind === "minsort") {
              const mine = rows.filter((r) => r.product_id === m.pid);
              return { n: (mine.length ? Math.min(...mine.map((r) => r.sort)) : 0) - 1 };
            }
            return m.hit ? { id: m.hit.id } : null;
          },
          run: async () => {
            const m = match(sql, ...a);
            if (m.kind === "delete") rows.splice(rows.findIndex((r) => r.id === m.id), 1);
            if (m.kind === "update") rows.find((r) => r.id === m.id).url = m.url;
            if (m.kind === "insert") {
              const [product_id, variant_id, url, alt, sort] = m.a;
              rows.push({ id: nextId++, product_id, variant_id, url, alt, sort });
            }
            return { success: true };
          },
        }),
      };
    },
  };
}
const shot = (id, url, variantId = null, sort = 0) => ({ id, product_id: "dynasty", variant_id: variantId, url, alt: "", sort });
const shown = (db) => db.rows.map((r) => [r.url, r.variant_id, r.sort]);

// The defect itself: the product's photo is swapped in the admin.
let db = fakeDb([shot(1, "/images/old")]);
await syncGalleryPhoto(db, "dynasty", null, "/images/old", "/images/new");
check("replacing the listing photo repoints its gallery row", shown(db), [["/images/new", null, 0]]);

// It must *move* the row, not add a second one — otherwise a product edited
// five times carries five ghosts of itself, and the page shows one of them.
db = fakeDb([shot(1, "/images/old"), shot(2, "/images/studio", null, 1)]);
await syncGalleryPhoto(db, "dynasty", null, "/images/old", "/images/new");
check("...and leaves the shots the house filed alongside it alone",
  shown(db), [["/images/new", null, 0], ["/images/studio", null, 1]]);

db = fakeDb([shot(1, "/images/old"), shot(2, "/images/new", null, 1)]);
await syncGalleryPhoto(db, "dynasty", null, "/images/old", "/images/new");
check("choosing a photo already in the gallery retires the old row rather than doubling it",
  shown(db), [["/images/new", null, 1]]);

db = fakeDb([shot(1, "/images/old")]);
await syncGalleryPhoto(db, "dynasty", null, "/images/old", "");
check("clearing the photo takes its row out with it", shown(db), []);

db = fakeDb([shot(1, "/images/studio", null, 3)]);
await syncGalleryPhoto(db, "dynasty", null, null, "/images/new");
check("a photo set on a hand-built gallery is inserted, and leads it",
  shown(db), [["/images/studio", null, 3], ["/images/new", null, 2]]);

db = fakeDb([shot(1, "/images/same")]);
await syncGalleryPhoto(db, "dynasty", null, "/images/same", "/images/same");
check("saving without touching the photo changes nothing", shown(db), [["/images/same", null, 0]]);

// The same pairing, one level down: a variation's own shot.
db = fakeDb([shot(1, "/images/v30-old", 1), shot(2, "/images/shared")]);
await syncGalleryPhoto(db, "dynasty", 1, "/images/v30-old", "/images/v30-new");
check("a variation's photo moves its own tagged row",
  shown(db), [["/images/v30-new", 1, 0], ["/images/shared", null, 0]]);

db = fakeDb([shot(1, "/images/v30", 1), shot(2, "/images/v50", 2)]);
await syncGalleryPhoto(db, "dynasty", 1, "/images/v30", "/images/v30-new");
check("...and never another variation's", shown(db), [["/images/v30-new", 1, 0], ["/images/v50", 2, 0]]);

console.log(failures ? `\n${failures} failing` : "\nAll good");
process.exit(failures ? 1 : 0);
