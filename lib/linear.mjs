// The only code that talks to Linear. Used by build.mjs to read posts and by
// scripts/publish.mjs to move a document between the two projects.
//
// A post is a Linear document. Where it lives is its status:
//   PUBLISHED_PROJECT — built into the live site
//   DRAFTS_PROJECT    — shown only by `node build.mjs --drafts`

import { optimizeImage } from './images.mjs';

export const PUBLISHED_PROJECT = process.env.LINEAR_PUBLISHED_PROJECT || 'Website: Published';
export const DRAFTS_PROJECT = process.env.LINEAR_DRAFTS_PROJECT || 'Website: Drafts';

// Overridable so the build can be tested against a local stand-in.
const API_URL = process.env.LINEAR_API_URL || 'https://api.linear.app/graphql';
export const UPLOADS_URL = process.env.LINEAR_UPLOADS_URL || 'https://uploads.linear.app/';

export const hasKey = () => Boolean(process.env.LINEAR_API_KEY);

export async function linear(query, variables = {}) {
  if (!hasKey()) throw new Error('LINEAR_API_KEY is not set');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Personal API keys go in bare, without "Bearer".
      Authorization: process.env.LINEAR_API_KEY,
      // Makes file links in `content` signed for 10 minutes, so the build can
      // download images without sending the key to the uploads host.
      'public-file-urls-expire-in': '600',
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.errors) {
    const why = body?.errors?.map((e) => e.message).join('; ') || `${res.status} ${res.statusText}`;
    throw new Error(`Linear API: ${why}`);
  }
  return body.data;
}

export async function findProject(name) {
  const data = await linear(
    `query ($name: String!) { projects(filter: { name: { eq: $name } }) { nodes { id name } } }`,
    { name },
  );
  const [project, another] = data.projects.nodes;
  if (!project) throw new Error(`Linear: no project named "${name}"`);
  if (another) throw new Error(`Linear: more than one project is named "${name}"`);
  return project;
}

const DOC_FIELDS = 'id slugId title content createdAt url project { name }';

export async function projectDocuments(projectName) {
  const docs = [];
  let after = null;
  do {
    const data = await linear(
      `query ($name: String!, $after: String) {
        documents(first: 50, after: $after, filter: { project: { name: { eq: $name } } }) {
          nodes { ${DOC_FIELDS} }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { name: projectName, after },
    );
    docs.push(...data.documents.nodes);
    after = data.documents.pageInfo.hasNextPage ? data.documents.pageInfo.endCursor : null;
  } while (after);
  return docs;
}

// Accepts a document URL, its slug ID, or its exact title (case-insensitive).
export async function findDocument(ref) {
  const slugId = ref.match(/^https:\/\/linear\.app\/.+\/document\/(?:.*-)?([a-z0-9]+)\/?$/i)?.[1]
    ?? (/^[a-f0-9]{8,16}$/.test(ref) ? ref : null);
  if (slugId) return (await linear(`query ($id: String!) { document(id: $id) { ${DOC_FIELDS} } }`, { id: slugId })).document;
  const data = await linear(
    `query ($title: String!) { documents(first: 2, filter: { title: { eqIgnoreCase: $title } }) { nodes { ${DOC_FIELDS} } } }`,
    { title: ref },
  );
  const [doc, another] = data.documents.nodes;
  if (!doc) throw new Error(`Linear: no document titled "${ref}"`);
  if (another) throw new Error(`Linear: more than one document is titled "${ref}"; pass its URL instead`);
  return doc;
}

export async function moveDocument(doc, projectName) {
  const project = await findProject(projectName);
  const data = await linear(
    `mutation ($id: String!, $projectId: String!) {
      documentUpdate(id: $id, input: { projectId: $projectId }) { success }
    }`,
    { id: doc.id, projectId: project.id },
  );
  if (!data.documentUpdate.success) throw new Error(`Linear: couldn't move "${doc.title}" to ${projectName}`);
}

const EXTENSIONS = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/svg+xml': 'svg', 'image/avif': 'avif', 'application/pdf': 'pdf',
};

// Linear-hosted files aren't public, so every link or image pointing at the
// uploads host is downloaded and served from the post's own folder instead,
// with images shrunk on the way (lib/images.mjs). Returns the rewritten
// Markdown and the files to write next to the page, images with their size.
export async function rehostFiles(markdown, where) {
  const files = [];
  const seen = new Map();
  const pattern = new RegExp(`\\]\\((${UPLOADS_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)\\s]+)\\)`, 'g');
  for (const [, url] of markdown.matchAll(pattern)) {
    if (seen.has(url)) continue;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${where}: couldn't download ${url.split('?')[0]} (${res.status})`);
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    const ext = EXTENSIONS[type] || new URL(url).pathname.match(/\.(\w{2,5})$/)?.[1] || 'bin';
    const name = `files/${files.length + 1}.${ext}`;
    files.push({ name, ...(await optimizeImage(Buffer.from(await res.arrayBuffer()), ext, where)) });
    seen.set(url, name);
  }
  const rewritten = markdown.replace(pattern, (whole, url) => `](${seen.get(url)})`);
  return { markdown: rewritten, files };
}
