// Product imagery: where the bytes live, and which size gets served.
//
// Two problems, one module.
//
// **Where.** Images were BLOBs in D1. D1 is a database, not a blob store: every
// photo inflates the nightly export and any restore, and the whole catalogue
// shares one row-size ceiling. The bytes want to be in R2. R2 is not enabled on
// this Cloudflare account yet (it needs a dashboard action — see the README),
// so this module reads and writes *either*: the R2 bucket when the `MEDIA`
// binding exists, D1 when it doesn't. Each row records which. That means the
// switch is a config change, not a migration: bind the bucket and new uploads
// land in R2 while every existing image keeps serving from D1, and no stored
// product URL ever changes.
//
// **Which size.** A phone was downloading the same full-size photo as a
// desktop. Uploads are now resized in the admin's browser before they are sent
// (see `resizeToWidths` in the admin) and arrive as a set: one original plus
// narrower derivatives, all linked by `parent_id`. `/images/<id>?w=640` picks
// the smallest derivative that still covers 640px. An image uploaded before
// this existed has no derivatives, so every width resolves to the original —
// bigger than ideal, but never broken.

// The widths the admin generates and the storefront asks for. Chosen for the
// places images actually appear: a cart thumbnail, a listing card on a phone,
// a listing card on a desktop grid, and a product hero on a retina display.
export const WIDTHS = [200, 400, 800, 1600];

const idFor = (base, width) => `${base}@${width}`;

/**
 * Store one image. `parentId` is null for an original, or the original's id
 * for a derivative — in which case the row's own id is derived from the two,
 * so a re-upload overwrites rather than accumulating orphans.
 */
export async function putMedia(env, { id, mime, bytes, width = 0, parentId = null, alt = "" }) {
  const key = parentId ? idFor(parentId, width) : id;
  const size = bytes.byteLength;
  if (env.MEDIA) {
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000, immutable" } });
    await env.DB.prepare(
      `INSERT INTO media (id, mime, bytes, size, alt, width, parent_id, storage) VALUES (?, ?, X'', ?, ?, ?, ?, 'r2')
       ON CONFLICT(id) DO UPDATE SET mime=excluded.mime, size=excluded.size, width=excluded.width, parent_id=excluded.parent_id, storage='r2'`
    ).bind(key, mime, size, alt, width, parentId).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO media (id, mime, bytes, size, alt, width, parent_id, storage) VALUES (?, ?, ?, ?, ?, ?, ?, 'd1')
       ON CONFLICT(id) DO UPDATE SET mime=excluded.mime, bytes=excluded.bytes, size=excluded.size, width=excluded.width, parent_id=excluded.parent_id, storage='d1'`
    ).bind(key, mime, bytes, size, alt, width, parentId).run();
  }
  return { id: key, size };
}

/**
 * Resolve a request for `id` at an optional width to the row that should serve
 * it: the narrowest derivative at least as wide as asked for, else the widest
 * available, else the original itself.
 */
export async function resolveMedia(env, id, wanted) {
  const want = parseInt(wanted, 10);
  if (want > 0) {
    const rows = (await env.DB.prepare(
      "SELECT id, mime, storage, width FROM media WHERE parent_id=? AND width > 0 ORDER BY width"
    ).bind(id).all()).results;
    if (rows.length) {
      // Retina and awkward viewport widths land between the sizes we hold, so
      // round *up* — a slightly larger image is a sharp one, a smaller one is
      // visibly soft.
      const hit = rows.find((r) => r.width >= want) || rows[rows.length - 1];
      return hit;
    }
  }
  return env.DB.prepare("SELECT id, mime, storage, width FROM media WHERE id=?").bind(id).first();
}

/** Fetch the bytes for a resolved row, from wherever that row lives. */
export async function readMedia(env, row) {
  if (row.storage === "r2") {
    if (!env.MEDIA) return null; // bucket unbound but rows reference it
    const obj = await env.MEDIA.get(row.id);
    return obj ? await obj.arrayBuffer() : null;
  }
  const full = await env.DB.prepare("SELECT bytes FROM media WHERE id=?").bind(row.id).first();
  if (!full || !full.bytes) return null;
  // D1 hands a BLOB back as a plain number array; Response() would stringify
  // that, which is how images once served corrupt.
  return full.bytes instanceof ArrayBuffer ? full.bytes : new Uint8Array(full.bytes);
}

/**
 * Copy images already sitting in D1 across to R2, a batch at a time.
 *
 * Deliberately incremental and re-runnable: it copies the bytes, flips the
 * row's `storage` to 'r2' and only then blanks the BLOB, so an interrupted run
 * leaves every image readable from one backend or the other. Call it until
 * `remaining` reaches zero.
 */
export async function migrateToR2(env, batch = 20) {
  if (!env.MEDIA) return { moved: 0, remaining: 0, error: "No R2 bucket is bound." };
  const rows = (await env.DB.prepare(
    "SELECT id, mime, bytes FROM media WHERE storage='d1' AND length(bytes) > 0 LIMIT ?"
  ).bind(batch).all()).results;

  let moved = 0;
  for (const row of rows) {
    const bytes = row.bytes instanceof ArrayBuffer ? row.bytes : new Uint8Array(row.bytes);
    await env.MEDIA.put(row.id, bytes, {
      httpMetadata: { contentType: row.mime, cacheControl: "public, max-age=31536000, immutable" },
    });
    await env.DB.prepare("UPDATE media SET storage='r2', bytes=X'' WHERE id=?").bind(row.id).run();
    moved++;
  }

  const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE storage='d1' AND length(bytes) > 0").first();
  return { moved, remaining: left ? left.n : 0 };
}

/** Delete an original and every derivative of it, from both backends. */
export async function deleteMedia(env, id) {
  const rows = (await env.DB.prepare("SELECT id, storage FROM media WHERE id=? OR parent_id=?").bind(id, id).all()).results;
  if (env.MEDIA) {
    const keys = rows.filter((r) => r.storage === "r2").map((r) => r.id);
    if (keys.length) await env.MEDIA.delete(keys);
  }
  await env.DB.prepare("DELETE FROM media WHERE id=? OR parent_id=?").bind(id, id).run();
  return rows.length;
}
