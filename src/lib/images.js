// Responsive image widths, shared by the admin (which generates them) and the
// storefront (which asks for them).
//
// The resizing happens here, in the browser that is doing the uploading,
// rather than on the Worker. Workers have no canvas and no image library, and
// Cloudflare's own image resizing is a paid zone feature this account doesn't
// have — but the admin uploading a photo is already sitting in a browser with
// a perfectly good image decoder. So the set is built at the one moment the
// full-resolution file is in memory anyway, and the Worker only ever stores
// bytes it was handed.

export const WIDTHS = [200, 400, 800, 1600];

// WebP is roughly a third smaller than JPEG at the same quality and is
// supported everywhere that matters now. The original is kept in its own
// format so nothing is lost; only the derivatives are re-encoded.
const DERIVATIVE_MIME = "image/webp";
const QUALITY = 0.82;

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode that image."))), mime, quality);
  });
}

/**
 * Decode `file` and render it at each width narrower than the original.
 * Returns [{ width, blob, mime }], smallest first. Never upscales — asking a
 * 300px photo for a 1600px copy just wastes bytes to no visible end.
 *
 * A failure here is not fatal to the upload: the caller still sends the
 * original, and the storefront falls back to it for every width.
 */
export async function resizeToWidths(file, widths = WIDTHS) {
  const bitmap = await createImageBitmap(file);
  const out = [];
  try {
    for (const w of widths) {
      if (w >= bitmap.width) continue;
      const h = Math.round((bitmap.height * w) / bitmap.width);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      // Browsers default to a fast, visibly rough downscale; these two lines
      // are the difference between a crisp thumbnail and a shimmering one.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, w, h);
      out.push({ width: w, blob: await canvasToBlob(canvas, DERIVATIVE_MIME, QUALITY), mime: DERIVATIVE_MIME });
    }
  } finally {
    bitmap.close();
  }
  return out;
}

/**
 * The srcset for an image served by this Worker. Returns "" for anything else
 * — a pasted external URL has no derivatives to offer and must be left alone.
 */
export function srcSetFor(url, widths = WIDTHS) {
  if (!url || !/^\/images\/[^?]+$/.test(url)) return "";
  return widths.map((w) => `${url}?w=${w} ${w}w`).join(", ");
}
