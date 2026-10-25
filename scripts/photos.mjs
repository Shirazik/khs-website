// Gets the photos in photos/ ready to commit: npm run photos
//
// The repo is public, so a photo straight off a phone would publish where it
// was taken. Each photo that still has camera data, or is larger than it needs
// to be, is rewritten in place: turned upright, shrunk to at most LONG_EDGE
// on its long side, and re-encoded without its EXIF. Photos already done are
// left alone, so running this twice changes nothing.

import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { DIR, NAME, photoFiles, hasCameraData } from '../lib/photos.mjs';

// Room above the 1600px the site serves, without a phone's 4000+.
const LONG_EDGE = 2400;

const ENCODE = {
  jpg: (img) => img.jpeg({ quality: 90, mozjpeg: true }),
  webp: (img) => img.webp({ quality: 90 }),
  png: (img) => img.png({ compressionLevel: 9 }),
};

const files = await photoFiles();
if (!files.length) console.log(`No photos in ${DIR}/.`);
let changed = 0;
for (const file of files) {
  const m = file.match(NAME);
  if (!m) {
    console.log(`skipped  ${file}: name it "YYYY-MM-DD Caption.jpg" (or .png, .webp)`);
    continue;
  }
  const ext = m[3].toLowerCase().replace('jpeg', 'jpg');
  const path = `${DIR}/${file}`;
  const before = await readFile(path);
  const meta = await sharp(before).metadata();
  const { width, height } = meta.autoOrient;
  if (!hasCameraData(meta) && Math.max(width, height) <= LONG_EDGE) continue;
  const after = await ENCODE[ext](
    sharp(before).autoOrient().resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true }),
  ).toBuffer();
  await writeFile(path, after);
  changed++;
  console.log(`cleaned  ${file}  ${(before.length / 1e6).toFixed(1)} MB → ${(after.length / 1e6).toFixed(1)} MB`);
}
if (files.length) console.log(`${changed} cleaned, ${files.length - changed} already ready.`);
