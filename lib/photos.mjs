// Photos for the home page strip and /photography/. Each one is a file in
// photos/ named "<YYYY-MM-DD> <caption>.<jpg|png|webp>", for example
// "2026-09-12 Big Sur.jpg". Every photo is built in two sizes: a large one
// that clicking opens, and a small one for the strip and the grid. Several
// photos with one caption are told apart by a number the site doesn't show:
// "2026-09-12 Big Sur (2).jpg".
//
// The repo is public, so the originals in photos/ are too. `npm run photos`
// (scripts/photos.mjs) strips their camera data, location included, and the
// build refuses any photo that still has it.

import { readdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { optimizeImage } from './images.mjs';
import { slugify } from './posts.mjs';

export const DIR = 'photos';
export const NAME = /^(\d{4}-\d{2}-\d{2}) (.+)\.(jpe?g|png|webp)$/i;
// The grid is three columns of a 600px page, the strip four: 600px covers
// both at 2x and then some.
const SMALL_WIDTH = 600;

// The files in photos/, minus hidden ones. No folder means no photos.
export async function photoFiles() {
  try {
    return (await readdir(DIR)).filter((f) => !f.startsWith('.'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// EXIF, XMP and IPTC are where cameras and phones record where and when a
// photo was taken.
export const hasCameraData = (meta) => Boolean(meta.exif || meta.xmp || meta.iptc);

// Newest first.
export async function loadPhotos() {
  const files = await photoFiles();
  const photos = [];
  for (const file of files) {
    const m = file.match(NAME);
    if (!m) throw new Error(`${DIR}/${file}: run npm run photos, or name it "YYYY-MM-DD Caption.jpg" (or .png, .webp)`);
    const [, date, name, rawExt] = m;
    const ext = rawExt.toLowerCase().replace('jpeg', 'jpg');
    const data = await readFile(`${DIR}/${file}`);
    const where = `${DIR}/${file}`;
    if (hasCameraData(await sharp(data).metadata())) {
      throw new Error(`${where} still has camera data, which can include where it was taken. Run npm run photos.`);
    }
    photos.push({
      slug: `${date}-${slugify(name)}`,
      name,
      caption: name.replace(/\s+\(\d+\)$/, ''),
      date: new Date(`${date}T00:00:00Z`),
      ext,
      large: await optimizeImage(data, ext, where),
      small: await optimizeImage(data, ext, where, SMALL_WIDTH),
    });
  }
  const slugs = photos.map((p) => p.slug);
  const dupe = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dupe) throw new Error(`two photos in ${DIR}/ make the same file name, "${dupe}"`);
  return photos.sort((a, b) => b.date - a.date || a.name.localeCompare(b.name, 'en', { numeric: true }));
}
