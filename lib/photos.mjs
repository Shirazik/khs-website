// Photos for the home page strip and /photography/. Each one is a file in
// photos/ named "<YYYY-MM-DD> <caption>.<jpg|png|webp>", for example
// "2026-09-12 Big Sur.jpg". Every photo is built in two sizes: a large one
// that clicking opens, and a small one for the strip and the grid.

import { readdir, readFile } from 'node:fs/promises';
import { optimizeImage } from './images.mjs';
import { slugify } from './posts.mjs';

const DIR = 'photos';
const NAME = /^(\d{4}-\d{2}-\d{2}) (.+)\.(jpe?g|png|webp)$/i;
// The grid is three columns of a 600px page, the strip four: 600px covers
// both at 2x and then some.
const SMALL_WIDTH = 600;

// Newest first. No photos/ folder means no photos, not an error.
export async function loadPhotos() {
  let files;
  try {
    files = (await readdir(DIR)).filter((f) => !f.startsWith('.'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const photos = [];
  for (const file of files) {
    const m = file.match(NAME);
    if (!m) throw new Error(`${DIR}/${file}: name it "YYYY-MM-DD Caption.jpg" (or .png, .webp)`);
    const [, date, caption, rawExt] = m;
    const ext = rawExt.toLowerCase().replace('jpeg', 'jpg');
    const data = await readFile(`${DIR}/${file}`);
    const where = `${DIR}/${file}`;
    photos.push({
      slug: `${date}-${slugify(caption)}`,
      caption,
      date: new Date(`${date}T00:00:00Z`),
      ext,
      large: await optimizeImage(data, ext, where),
      small: await optimizeImage(data, ext, where, SMALL_WIDTH),
    });
  }
  const slugs = photos.map((p) => p.slug);
  const dupe = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dupe) throw new Error(`two photos in ${DIR}/ make the same file name, "${dupe}"`);
  return photos.sort((a, b) => b.date - a.date || a.caption.localeCompare(b.caption));
}
