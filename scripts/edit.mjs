// A local editor for the home page copy. Opens index.html in the browser with
// every heading, paragraph and list item editable in place.
//
//   npm run edit            then open http://localhost:4321
//
// Save writes the edited <main> back into index.html; nothing else in the file
// changes. Publish commits index.html and pushes the current branch (a push to
// main deploys the site). Only listens on this machine.

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const EDITOR = new URL('editor/', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 4321;
const git = (...args) => promisify(execFile)('git', args, { cwd: ROOT });

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml',
};

const MAIN = /(<main>)[\s\S]*(<\/main>)/;

async function page() {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  return html.replace('</head>', '<link rel="stylesheet" href="/__editor/editor.css">\n</head>')
    .replace('</body>', '<script src="/__editor/editor.js"></script>\n</body>');
}

async function save(main) {
  if (typeof main !== 'string' || !main.trim()) throw new Error('Nothing to save.');
  // Keep the file as hand-written as it was: the non-breaking hyphen stays an
  // entity, and the non-breaking spaces contenteditable inserts become spaces.
  main = main.replaceAll('‑', '&#8209;').replaceAll(' ', ' ').replaceAll('&nbsp;', ' ');
  const file = join(ROOT, 'index.html');
  const html = await readFile(file, 'utf8');
  if (!MAIN.test(html)) throw new Error('index.html has no <main> to replace.');
  await writeFile(file, html.replace(MAIN, (_, open, close) => open + main + close));
}

async function publish() {
  const { stdout: status } = await git('status', '--porcelain', '--', 'index.html');
  if (status.trim()) {
    await git('add', 'index.html');
    await git('commit', '-m', 'Edit home page copy');
  }
  const { stdout: branch } = await git('rev-parse', '--abbrev-ref', 'HEAD');
  await git('push', 'origin', 'HEAD');
  return branch.trim();
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 5e6) reject(new Error('Too large.')); });
    req.on('end', () => resolve(data));
  });
}

const server = createServer(async (req, res) => {
  const send = (code, type, data) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(data); };
  const json = (code, data) => send(code, 'application/json', JSON.stringify(data));
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST') {
      // Another site open in the browser could post here; it can't send JSON
      // to another origin without a preflight, and the Host check stops DNS rebinding.
      const host = (req.headers.host || '').split(':')[0];
      if (!['localhost', '127.0.0.1'].includes(host) || req.headers['content-type'] !== 'application/json') {
        return json(403, { error: 'Forbidden.' });
      }
      if (url.pathname === '/__editor/save') {
        await save(JSON.parse(await body(req)).main);
        return json(200, { ok: true });
      }
      if (url.pathname === '/__editor/publish') {
        const branch = await publish();
        return json(200, { ok: true, branch });
      }
      return json(404, { error: 'Not found.' });
    }
    if (url.pathname === '/' || url.pathname === '/index.html') return send(200, TYPES['.html'], await page());
    if (url.pathname === '/__editor/branch') {
      const { stdout } = await git('rev-parse', '--abbrev-ref', 'HEAD');
      return json(200, { branch: stdout.trim() });
    }
    // Static files for the page itself; never dotfiles such as .env.
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '');
    if (rel.split('/').some((part) => part.startsWith('.') || part === 'node_modules')) return send(404, 'text/plain', 'Not found');
    const file = rel.startsWith('__editor/') ? join(EDITOR, rel.slice(9)) : join(ROOT, rel);
    send(200, TYPES[extname(file)] || 'application/octet-stream', await readFile(file));
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') return send(404, 'text/plain', 'Not found');
    json(500, { error: (err.stderr || err.message || String(err)).trim() });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`Editing index.html at http://localhost:${PORT}  (Ctrl+C to stop)`));
