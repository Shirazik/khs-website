// Shrinks the images posts pull from Linear, which arrive straight off a
// phone or a retina screenshot. Used by rehostFiles() in lib/linear.mjs and
// by lib/photos.mjs.

import sharp from 'sharp';

// 2x the 600px column, plus room.
const MAX_WIDTH = 1600;

const ENCODE = {
  jpg: (img) => img.jpeg({ quality: 80, mozjpeg: true }),
  webp: (img) => img.webp({ quality: 80 }),
  png: (img) => img.png({ compressionLevel: 9, adaptiveFiltering: true }), // lossless
};

// Returns { data, width, height } for the file to serve. JPEG, PNG and WebP
// are resized to at most maxWidth and re-encoded; GIFs are only measured.
// Anything else (SVG, PDF, ...) comes back as it was, without a size.
export async function optimizeImage(data, ext, where, maxWidth = MAX_WIDTH) {
  if (!ENCODE[ext] && ext !== 'gif') return { data };
  try {
    const meta = await sharp(data).metadata();
    // Re-encoding would keep only the first frame of an animated WebP.
    if (!ENCODE[ext] || meta.pages > 1) return { data, ...meta.autoOrient };
    // Always re-encoded, even when that saves nothing: it also strips EXIF,
    // which on a phone photo includes where it was taken.
    const { data: out, info } = await ENCODE[ext](
      sharp(data).autoOrient().resize({ width: maxWidth, withoutEnlargement: true }),
    ).toBuffer({ resolveWithObject: true });
    return { data: out, width: info.width, height: info.height };
  } catch (err) {
    throw new Error(`${where}: couldn't read image (${err.message})`);
  }
}
