// Builds the site into _site/.
//
//   node build.mjs           what GitHub Actions deploys: published posts only
//   node build.mjs --drafts  local preview that includes draft posts
//
// index.html stays the hand-written home page and the layout for every post
// page: the build swaps its <main> and head metadata, and fills the
// <!-- writing --> marker with the Writing section. Posts come from
// loadPosts(); Phase 3 can replace it with a Linear fetch that returns the
// same shape.

import { readFile, readdir, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { marked } from 'marked';

const SITE = 'https://kareemshirazi.com';
const AUTHOR = 'Kareem Shirazi';
const OUT = '_site';
const STATIC = ['style.css', 'assets', 'CNAME'];
const includeDrafts = process.argv.includes('--drafts');

const escape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt = (date, opts) => date.toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });

// Front matter is a small YAML subset: one `key: value` per line between ---.
function parseFrontMatter(file, text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) throw new Error(`${file}: can't read front matter line "${line}"`);
    data[kv[1]] = kv[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return { data, body: m[2] };
}

async function loadPosts() {
  const files = (await readdir('posts')).filter((f) => f.endsWith('.md'));
  const posts = [];
  for (const file of files) {
    const { data, body } = parseFrontMatter(file, await readFile(`posts/${file}`, 'utf8'));
    const slug = data.slug || file.replace(/\.md$/, '');
    if (!data.title) throw new Error(`${file}: title is required`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || '')) throw new Error(`${file}: date must be YYYY-MM-DD`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error(`${file}: slug must be lowercase-with-dashes`);
    posts.push({
      slug,
      title: data.title,
      date: new Date(`${data.date}T00:00:00Z`),
      description: data.description || '',
      draft: data.draft === 'true',
      html: marked.parse(body),
    });
  }
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
  const groups = [...years].map(([year, list]) => `  <h3>${year}</h3>
  <ul class="posts">
${list.map((p) => `    <li><span><a href="posts/${p.slug}/">${escape(p.title)}</a>${draftTag(p)}</span><time datetime="${p.date.toISOString().slice(0, 10)}">${fmt(p.date, { month: 'short', day: 'numeric' })}</time></li>`).join('\n')}
  </ul>`);
  return `<section class="writing">
  <h2>Writing</h2>
${groups.join('\n')}
</section>

`;
}

function homePage(layout, posts) {
  return replaceOnce(layout, /<!-- writing:.*-->\n\n/, writingSection(posts));
}

function postPage(layout, post) {
  const url = `${SITE}/posts/${post.slug}/`;
  const description = escape(post.description || `${post.title}, by ${AUTHOR}.`);
  // Pages live two folders down, so the layout's relative links need ../../
  let html = layout.replace(/(href|src)="(?![a-z]+:|\/|#)/g, '$1="../../');
  html = replaceOnce(html, /<title>.*<\/title>/, `<title>${escape(post.title)} · ${AUTHOR}</title>`);
  html = replaceOnce(html, /<meta name="description" content=".*">/, `<meta name="description" content="${description}">`);
  html = replaceOnce(html, /<meta property="og:title" content=".*">/, `<meta property="og:title" content="${escape(post.title)}">`);
  html = replaceOnce(html, /<meta property="og:description" content=".*">/, `<meta property="og:description" content="${description}">`);
  html = replaceOnce(html, /<meta property="og:url" content=".*">/, `<meta property="og:url" content="${url}">`);
  html = replaceOnce(html, /<meta property="og:type" content=".*">/, `<meta property="og:type" content="article">`);
  html = replaceOnce(html, /<main>[\s\S]*<\/main>/, `<main>
<article class="post">
  <h1>${escape(post.title)}${draftTag(post)}</h1>
  <p class="muted"><time datetime="${post.date.toISOString().slice(0, 10)}">${fmt(post.date, { month: 'long', day: 'numeric', year: 'numeric' })}</time></p>
${post.html}</article>
</main>`);
  return html;
}

function rss(posts) {
  const items = posts.map((p) => `    <item>
      <title>${escape(p.title)}</title>
      <link>${SITE}/posts/${p.slug}/</link>
      <guid>${SITE}/posts/${p.slug}/</guid>
      <pubDate>${p.date.toUTCString()}</pubDate>
      <description>${escape(p.html)}</description>
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

function sitemap(posts) {
  const urls = [`${SITE}/`, ...posts.map((p) => `${SITE}/posts/${p.slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u, i) => `  <url><loc>${u}</loc>${i ? `<lastmod>${posts[i - 1].date.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

const layout = await readFile('index.html', 'utf8');
const posts = await loadPosts();

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);
for (const path of STATIC) await cp(path, `${OUT}/${path}`, { recursive: true });
await writeFile(`${OUT}/index.html`, homePage(layout, posts));
for (const post of posts) {
  await mkdir(`${OUT}/posts/${post.slug}`, { recursive: true });
  await writeFile(`${OUT}/posts/${post.slug}/index.html`, postPage(layout, post));
}
await writeFile(`${OUT}/rss.xml`, rss(posts));
await writeFile(`${OUT}/sitemap.xml`, sitemap(posts));

console.log(`Built ${OUT}/ with ${posts.length} post${posts.length === 1 ? '' : 's'}${includeDrafts ? ' (drafts included)' : ''}.`);
