// Builds the site into _site/.
//
//   node build.mjs                   published posts only
//   node build.mjs --drafts          local preview that also includes drafts
//   node build.mjs --require-linear  what GitHub Actions deploys: fails rather
//                                    than build without Linear's posts
//
// index.html stays the hand-written home page and the layout for every post
// page: the build swaps its <main> and head metadata, and fills the
// <!-- writing --> marker with the Writing section and the <!-- photography -->
// marker with a strip of the newest photos (see lib/photos.mjs), which also
// get a page of their own at /photography/. Posts come from two
// places, both returned in the same shape by loadPosts(): Markdown files in
// posts/, and Linear documents (see lib/linear.mjs), which need
// LINEAR_API_KEY in the environment or in a gitignored .env file.

import { readFile, readdir, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { marked } from 'marked';
import { parseFrontMatter, linearMeta, SLUG, DATE } from './lib/posts.mjs';
import { loadPhotos } from './lib/photos.mjs';
import { hasKey, findProject, projectDocuments, rehostFiles, PUBLISHED_PROJECT, DRAFTS_PROJECT } from './lib/linear.mjs';

try { process.loadEnvFile('.env'); } catch {}

const SITE = 'https://kareemshirazi.com';
const AUTHOR = 'Kareem Shirazi';
const OUT = '_site';
const STATIC = ['style.css', 'assets', 'CNAME'];
const includeDrafts = process.argv.includes('--drafts');
const requireLinear = process.argv.includes('--require-linear');

const escape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt = (date, opts) => date.toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });

async function loadFilePosts() {
  const files = (await readdir('posts')).filter((f) => f.endsWith('.md'));
  const posts = [];
  for (const file of files) {
    const { data, body } = parseFrontMatter(file, await readFile(`posts/${file}`, 'utf8'));
    const slug = data.slug || file.replace(/\.md$/, '');
    if (!data.title) throw new Error(`${file}: title is required`);
    if (!DATE.test(data.date || '')) throw new Error(`${file}: date must be YYYY-MM-DD`);
    if (!SLUG.test(slug)) throw new Error(`${file}: slug must be lowercase-with-dashes`);
    posts.push({
      slug,
      title: data.title,
      date: new Date(`${data.date}T00:00:00Z`),
      description: data.description || '',
      draft: data.draft === 'true',
      html: marked.parse(body),
      files: [],
    });
  }
  return posts;
}

// Gives each rehosted image its width and height, so the page doesn't jump
// as images load. style.css scales them down to the column.
function sizeImages(html, files) {
  const sizes = new Map(files.filter((f) => f.width).map((f) => [f.name, f]));
  return html.replace(/<img src="(files\/[^"]+)"([^>]*)>/g, (tag, src, rest) => {
    const file = sizes.get(src);
    return file ? `<img src="${src}"${rest} width="${file.width}" height="${file.height}">` : tag;
  });
}

async function loadLinearPosts() {
  if (!hasKey()) {
    // A deploy without the key would quietly take every Linear post offline.
    if (requireLinear) throw new Error('LINEAR_API_KEY is not set, so Linear posts can\'t be built');
    console.warn('LINEAR_API_KEY is not set: building without Linear posts.');
    return [];
  }
  const sources = [{ project: PUBLISHED_PROJECT, draft: false }];
  if (includeDrafts) sources.push({ project: DRAFTS_PROJECT, draft: true });
  const posts = [];
  for (const { project, draft } of sources) {
    await findProject(project); // a renamed or missing project is an error, not "no posts"
    for (const doc of await projectDocuments(project)) {
      const meta = linearMeta(doc);
      const { markdown, files } = await rehostFiles(meta.body, `Linear document "${doc.title}"`);
      posts.push({
        slug: meta.slug,
        title: doc.title,
        date: new Date(`${meta.date}T00:00:00Z`),
        description: meta.description,
        draft,
        html: sizeImages(marked.parse(markdown), files),
        files,
      });
    }
  }
  return posts;
}

async function loadPosts() {
  const posts = [...(await loadFilePosts()), ...(await loadLinearPosts())];
  const slugs = posts.map((p) => p.slug);
  const dupe = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dupe) throw new Error(`two posts use the slug "${dupe}"`);
  return posts
    .filter((p) => includeDrafts || !p.draft)
    .sort((a, b) => b.date - a.date || a.title.localeCompare(b.title));
}

// Throws instead of silently doing nothing when index.html changes shape.
function replaceOnce(html, pattern, replacement) {
  if (!pattern.test(html)) throw new Error(`index.html: no match for ${pattern}`);
  return html.replace(pattern, () => replacement);
}

const draftTag = (post) => (post.draft ? ' <em class="muted">(draft)</em>' : '');

function writingSection(posts) {
  if (!posts.length) return '';
  const years = new Map();
  for (const post of posts) {
    const year = post.date.getUTCFullYear();
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(post);
  }
  const groups = [...years].map(([year, list]) => `  <div class="year">
  <h3>${year}</h3>
  <ul class="posts">
${list.map((p) => `    <li><a href="posts/${p.slug}/">${escape(p.title)}</a>${draftTag(p)}<time datetime="${p.date.toISOString().slice(0, 10)}">${fmt(p.date, { month: 'long', day: 'numeric' })}</time></li>`).join('\n')}
  </ul>
  </div>`);
  return `<section class="writing">
  <h2>Writing</h2>
${groups.join('\n')}
</section>

`;
}

const STRIP = 4;
const photoFile = (photo, size) => `${photo.slug}${size === 'small' ? '-sm' : ''}.${photo.ext}`;
const photoImg = (photo, dir) =>
  `<img src="${dir}${photoFile(photo, 'small')}" alt="${escape(photo.caption)}" width="${photo.small.width}" height="${photo.small.height}" loading="lazy">`;

function photographySection(photos) {
  if (!photos.length) return '';
  const shown = photos.slice(0, STRIP);
  return `<section class="photography">
  <h2>Photography</h2>
  <ul class="strip">
${shown.map((p) => `    <li><a href="photography/${photoFile(p, 'large')}">${photoImg(p, 'photography/')}</a></li>`).join('\n')}
  </ul>
  <p class="muted"><span>${shown.map((p) => escape(p.caption)).join(' · ')}</span> <a href="photography/">See all ${photos.length}</a></p>
</section>

`;
}

function homePage(layout, posts, photos) {
  const html = replaceOnce(layout, /<!-- writing:.*-->\n\n/, writingSection(posts));
  return replaceOnce(html, /<!-- photography:.*-->\n\n/, photographySection(photos));
}

// index.html with its <main> swapped and its head metadata pointed at a page
// `depth` folders down.
function page(layout, { depth, title, description, url, type, main }) {
  let html = layout.replace(/(href|src)="(?![a-z]+:|\/|#)/g, `$1="${'../'.repeat(depth)}`);
  html = replaceOnce(html, /<title>.*<\/title>/, `<title>${escape(title)} · ${AUTHOR}</title>`);
  html = replaceOnce(html, /<meta name="description" content=".*">/, `<meta name="description" content="${description}">`);
  html = replaceOnce(html, /<meta property="og:title" content=".*">/, `<meta property="og:title" content="${escape(title)}">`);
  html = replaceOnce(html, /<meta property="og:description" content=".*">/, `<meta property="og:description" content="${description}">`);
  html = replaceOnce(html, /<meta property="og:url" content=".*">/, `<meta property="og:url" content="${url}">`);
  html = replaceOnce(html, /<meta property="og:type" content=".*">/, `<meta property="og:type" content="${type}">`);
  return replaceOnce(html, /<main>[\s\S]*<\/main>/, `<main>\n${main}</main>`);
}

function postPage(layout, post) {
  return page(layout, {
    depth: 2,
    title: post.title,
    description: escape(post.description || `${post.title}, by ${AUTHOR}.`),
    url: `${SITE}/posts/${post.slug}/`,
    type: 'article',
    main: `<article class="post">
  <h1 class="title">${escape(post.title)}${draftTag(post)}</h1>
  <p class="muted"><time datetime="${post.date.toISOString().slice(0, 10)}">${fmt(post.date, { month: 'long', day: 'numeric', year: 'numeric' })}</time></p>
${post.html}</article>
`,
  });
}

function photographyPage(layout, photos) {
  return page(layout, {
    depth: 1,
    title: 'Photography',
    description: `Photographs by ${AUTHOR}.`,
    url: `${SITE}/photography/`,
    type: 'website',
    main: `<section>
  <h2>Photography</h2>
  <ul class="grid">
${photos.map((p) => `    <li style="--r: ${(p.small.width / p.small.height).toFixed(3)}"><a href="${photoFile(p, 'large')}">${photoImg(p, '')}</a><p class="muted">${escape(p.caption)} · <time datetime="${p.date.toISOString().slice(0, 10)}">${fmt(p.date, { month: 'short', year: 'numeric' })}</time></p></li>`).join('\n')}
  </ul>
</section>
`,
  });
}

// Feed readers don't resolve links against the post's URL, so a post's own
// files (rehosted Linear uploads) need absolute links in the feed.
const absolute = (post) =>
  post.html.replace(/(href|src)="(files\/[^"]+)"/g, `$1="${SITE}/posts/${post.slug}/$2"`);

function rss(posts) {
  const items = posts.map((p) => `    <item>
      <title>${escape(p.title)}</title>
      <link>${SITE}/posts/${p.slug}/</link>
      <guid>${SITE}/posts/${p.slug}/</guid>
      <pubDate>${p.date.toUTCString()}</pubDate>
      <description>${escape(absolute(p))}</description>
    </item>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${AUTHOR}</title>
    <link>${SITE}/</link>
    <description>Writing by ${AUTHOR}.</description>
    <language>en</language>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>
${items.map((item) => `${item}\n`).join('')}  </channel>
</rss>
`;
}

function sitemap(posts, photos) {
  const urls = [
    { loc: `${SITE}/` },
    ...(photos.length ? [{ loc: `${SITE}/photography/`, date: photos[0].date }] : []),
    ...posts.map((p) => ({ loc: `${SITE}/posts/${p.slug}/`, date: p.date })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.date ? `<lastmod>${u.date.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

const layout = await readFile('index.html', 'utf8');
const posts = await loadPosts();
const photos = await loadPhotos();

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);
for (const path of STATIC) await cp(path, `${OUT}/${path}`, { recursive: true });
await writeFile(`${OUT}/index.html`, homePage(layout, posts, photos));
for (const post of posts) {
  await mkdir(`${OUT}/posts/${post.slug}`, { recursive: true });
  await writeFile(`${OUT}/posts/${post.slug}/index.html`, postPage(layout, post));
  for (const file of post.files) {
    await mkdir(`${OUT}/posts/${post.slug}/files`, { recursive: true });
    await writeFile(`${OUT}/posts/${post.slug}/${file.name}`, file.data);
  }
}
if (photos.length) {
  await mkdir(`${OUT}/photography`);
  await writeFile(`${OUT}/photography/index.html`, photographyPage(layout, photos));
  for (const photo of photos) {
    for (const size of ['large', 'small']) await writeFile(`${OUT}/photography/${photoFile(photo, size)}`, photo[size].data);
  }
}
await writeFile(`${OUT}/rss.xml`, rss(posts));
await writeFile(`${OUT}/sitemap.xml`, sitemap(posts, photos));

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
console.log(`Built ${OUT}/ with ${count(posts.length, 'post')} and ${count(photos.length, 'photo')}${includeDrafts ? ' (drafts included)' : ''}.`);
