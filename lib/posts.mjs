// Post helpers shared by build.mjs (Markdown files and Linear documents) and
// scripts/publish.mjs (which prints the URL a post will live at).

// Front matter is a small YAML subset: one `key: value` per line between ---.
// Blank lines inside are allowed, because Linear's editor tends to add them.
export function parseFrontMatter(file, text) {
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

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const slugify = (title) =>
  title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// A Linear document's metadata: its title, plus optional front matter at the
// very top of the body to pin a date, slug or description. Without it the
// slug comes from the title and the date is when the document was created.
export function linearMeta(doc) {
  const content = doc.content || '';
  const { data, body } = /^---\r?\n/.test(content)
    ? parseFrontMatter(`Linear document "${doc.title}"`, content)
    : { data: {}, body: content };
  const where = `Linear document "${doc.title}"`;
  const slug = data.slug || slugify(doc.title);
  const date = data.date || doc.createdAt.slice(0, 10);
  if (!SLUG.test(slug)) throw new Error(`${where}: slug "${slug}" must be lowercase-with-dashes`);
  if (!DATE.test(date)) throw new Error(`${where}: date must be YYYY-MM-DD`);
  return { slug, date, description: data.description || '', body };
}
