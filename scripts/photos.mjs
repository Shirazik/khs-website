// Gets the photos in photos/ ready to commit: npm run photos
//
// The repo is public, so a photo straight off a phone would publish where it
// was taken. Each photo that still has camera data, or is larger than it needs
// to be, is rewritten: turned upright, shrunk to at most LONG_EDGE on its long
// side, and re-encoded without its EXIF. Photos already done are left alone,
// so running this twice changes nothing.
//
// A photo named only with its caption ("Big Sur.jpg") is first given the date
// it was taken, read from its EXIF before that is stripped: "2026-09-12 Big
// Sur.jpg". If that name is taken, it becomes "2026-09-12 Big Sur (2).jpg";
// the number keeps file names apart and never shows on the site.
//
// For a batch from one place, put the photos in a folder named for it,
// "photos/Big Sur/", with any file names: each one is dated, captioned with
// the folder's name, and moved up into photos/. The folder goes once empty.

import { readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { DIR, NAME, photoFiles, hasCameraData } from '../lib/photos.mjs';

// Room above the 1600px the site serves, without a phone's 4000+.
const LONG_EDGE = 2400;

const ENCODE = {
  jpg: (img) => img.jpeg({ quality: 90, mozjpeg: true }),
  webp: (img) => img.webp({ quality: 90 }),
  png: (img) => img.png({ compressionLevel: 9 }),
};

const UNDATED = /^(.+)\.(jpe?g|png|webp)$/i;
// Names straight off a camera or phone, which would make poor captions.
const CAMERA_NAME = /^(IMG|DSC|DSCF|DJI|PXL|GOPR|P\d{3})[_-]?\d+/i;

// When the photo was taken, as YYYY-MM-DD, from the EXIF block sharp hands
// back: DateTimeOriginal (in the Exif IFD) if it's there, else DateTime.
// Returns null when there's no date or the EXIF can't be read.
function takenOn(exif) {
  try {
    const base = exif.toString('latin1', 0, 4) === 'Exif' ? 6 : 0; // "Exif\0\0", then TIFF
    const le = exif.toString('latin1', base, base + 2) === 'II';
    const u16 = (at) => (le ? exif.readUInt16LE(base + at) : exif.readUInt16BE(base + at));
    const u32 = (at) => (le ? exif.readUInt32LE(base + at) : exif.readUInt32BE(base + at));
    // Tag number → offset of its 12-byte entry, for one IFD.
    const entries = (ifd) => new Map(Array.from({ length: u16(ifd) }, (_, i) => [u16(ifd + 2 + i * 12), ifd + 2 + i * 12]));
    const text = (entry) => {
      const length = u32(entry + 4);
      const at = length > 4 ? u32(entry + 8) : entry + 8;
      return exif.toString('latin1', base + at, base + at + length - 1);
    };
    const ifd0 = entries(u32(4));
    const exifIfd = ifd0.has(0x8769) ? entries(u32(ifd0.get(0x8769) + 8)) : new Map();
    const value = exifIfd.has(0x9003) ? text(exifIfd.get(0x9003)) : ifd0.has(0x0132) ? text(ifd0.get(0x0132)) : '';
    const m = value.match(/^(\d{4}):(\d{2}):(\d{2})/);
    return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null;
  } catch {
    return null;
  }
}

// Everything to look at: files in photos/, and files in its folders, which
// take their caption from the folder.
const entries = await photoFiles();
const files = [];
const folders = [];
for (const entry of entries) {
  if ((await stat(`${DIR}/${entry}`)).isDirectory()) {
    folders.push(entry);
    for (const f of (await readdir(`${DIR}/${entry}`)).filter((f) => !f.startsWith('.'))) {
      files.push({ path: `${entry}/${f}`, folder: entry });
    }
  } else {
    files.push({ path: entry });
  }
}
if (!files.length) console.log(`No photos in ${DIR}/.`);
// Lower-cased, because macOS treats "Big Sur.jpg" and "big sur.jpg" as one file.
const taken = new Set(entries.map((f) => f.toLowerCase()));
function freeName(date, caption, ext) {
  for (let n = 1; ; n++) {
    const name = `${date} ${caption}${n > 1 ? ` (${n})` : ''}.${ext}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

let changed = 0;
for (const { path: file, folder } of files) {
  const base = file.split('/').pop();
  const named = !folder && base.match(NAME);
  const undated = !named && base.match(UNDATED);
  if (!named && !undated) {
    console.log(`skipped  ${file}: use a .jpg, .png or .webp (export HEIC photos as JPEG)`);
    continue;
  }
  const ext = (named ? named[3] : undated[2]).toLowerCase().replace('jpeg', 'jpg');
  const before = await readFile(`${DIR}/${file}`);
  const meta = await sharp(before).metadata();

  let name = file;
  if (undated) {
    const caption = folder || undated[1];
    const date = (folder && base.match(NAME)?.[1]) || (meta.exif && takenOn(meta.exif));
    if (!date) {
      console.log(`skipped  ${file}: no date in the photo, so name it "YYYY-MM-DD ${caption}.${ext}" in ${DIR}/`);
      continue;
    }
    name = freeName(date, caption, ext);
    taken.add(name.toLowerCase());
  }
  const caption = name.match(NAME)[2];
  if (CAMERA_NAME.test(caption)) console.log(`note     ${name}: "${caption}" will be its caption; rename it if that's not what you want`);

  const { width, height } = meta.autoOrient;
  const clean = !hasCameraData(meta) && Math.max(width, height) <= LONG_EDGE;
  if (clean && name === file) continue;
  const after = clean
    ? before
    : await ENCODE[ext](
        sharp(before).autoOrient().resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true }),
      ).toBuffer();
  await writeFile(`${DIR}/${name}`, after);
  if (name !== file) await rm(`${DIR}/${file}`);
  changed++;
  const size = clean ? '' : `  ${(before.length / 1e6).toFixed(1)} MB → ${(after.length / 1e6).toFixed(1)} MB`;
  console.log(`${name === file ? 'cleaned ' : 'renamed '} ${name === file ? file : `${file} → ${name}`}${size}`);
}
for (const folder of folders) {
  if (!(await readdir(`${DIR}/${folder}`)).some((f) => !f.startsWith('.'))) await rm(`${DIR}/${folder}`, { recursive: true });
}
if (files.length) console.log(`${changed} changed, ${files.length - changed} already ready or skipped.`);
