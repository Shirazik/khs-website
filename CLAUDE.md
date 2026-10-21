# KHS Website — Project Context for Claude

## Project Overview

Personal site for Kareem Shirazi / KHS Consulting. A single page of plain text in the
style of karrisaarinen.com: about, philosophies, work history, AI projects,
contact, plus a Writing section of posts. No framework, no separate mobile layout; one
small build script (`build.mjs`; dependencies: `marked`, and `sharp` for images) turns
posts into pages. Posts are written as Linear documents and published by asking an agent
(see Publishing).

## Files

```
index.html   — the home page and the layout for post pages. All home copy lives here.
style.css    — the only stylesheet: light + dark colour tokens, one column.
posts/*.md   — optional Markdown posts, with front matter (see Writing below).
build.mjs    — builds the site into _site/ (gitignored). Nothing else is generated.
lib/linear.mjs — the only code that talks to Linear (read posts, move documents).
lib/posts.mjs  — front matter, slugs, and Linear document metadata.
lib/images.mjs — shrinks images pulled from Linear (sharp).
scripts/publish.mjs — publish / unpublish / redeploy; what an agent runs.
scripts/edit.mjs     — local editor for the home copy (`npm run edit`).
scripts/editor/      — the editor's in-page script and styles.
.claude/skills/publish/ — tells Claude how to publish on request.
.github/workflows/deploy.yml — builds and deploys to GitHub Pages.
assets/
  khs-logo.png        — og:image only
  KHS_favicon.jpg
CNAME        — kareemshirazi.com
```

## Conventions

- **Edit home copy in `index.html`.** There is one copy of every string. The build only
  fills the `<!-- writing: ... -->` marker with the Writing section; leave that line in
  place (move it to move the section).
- Work and AI projects use the same row pattern: a `<details>` whose
  `<summary>` holds `<span>Name <em>role</em></span><time>years</time>`, followed by a
  paragraph and a bullet list. Copy an existing row to add one.
- AI projects are their own section ("AI projects"), separate from work history. When the
  user says "my AI projects" or "add another AI project", that section is the reference group.
- Escape `&` as `&amp;` in the HTML — the copy is full of them.
- Theme: the OS preference is the default; the moon/sun button sets `data-theme` on `<html>`
  and saves it to `localStorage('theme')`. Dark colours are defined twice in `style.css`
  (media query and `[data-theme="dark"]`) — change both.

## Editing home copy in the browser

`npm run edit` serves the home page at http://localhost:4321 with every heading,
paragraph, philosophy, row title and bullet editable in place. Click an item for
↑ / ↓ / Duplicate / Delete (duplicate an item to add a new one); select words and press
Link (⌘K) to add or change a link. **Save** (⌘S) writes the edited `<main>` back into
`index.html` and touches nothing else; a save with no edits leaves the file byte-identical.
**Publish** commits `index.html` and pushes the current branch, which deploys only when
that branch is `main`. Adding a whole new section is still a hand edit to `index.html`.
The server only listens on 127.0.0.1 and refuses cross-site posts.

## Writing in Linear

Each post is a Linear document. Which project it sits in is its status:

- **Website: Drafts** — not on the site; shown by `node build.mjs --drafts` only.
- **Website: Published** — built into the live site.

The document title is the post title. The slug comes from the title (`Café & Taste` →
`cafe-and-taste`) and the date from when the document was created. Renaming a published
post changes its URL, so to pin either one, start the document with front matter:

```
---
date: 2026-10-20
slug: my-post
description: One line for search and link previews.
---
```

Images and files uploaded into a document are private to Linear, so the build downloads
each one into `posts/<slug>/files/` and links to that copy. On the way, JPEG, PNG and
WebP images are resized to at most 1600px wide (2x the column) and re-encoded: JPEG and
WebP at quality 80, PNG losslessly. Re-encoding also strips EXIF, including a photo's
location. GIFs and animated WebPs are copied as they are; SVG, PDF and other files too.
Every `<img>` of a JPEG, PNG, WebP or GIF gets `width` and `height`, so the page doesn't
jump while images load. Upload images at full size; the build does the shrinking.

Override the project names with `LINEAR_PUBLISHED_PROJECT` / `LINEAR_DRAFTS_PROJECT` if
they're ever renamed.

## Publishing (agent on request)

Say "publish <post>" to an agent with this repo. It runs `scripts/publish.mjs`, which
moves the document into Website: Published and starts the Deploy workflow; the site is
rebuilt from Linear in a minute or two. See `.claude/skills/publish/SKILL.md`.

```
node scripts/publish.mjs "<Linear document URL or title>"
node scripts/publish.mjs --unpublish "<Linear document URL or title>"
node scripts/publish.mjs --deploy        # after editing a post that is already live
```

- Credentials: `LINEAR_API_KEY` (a personal API key from Linear's settings)
  in the environment or a gitignored `.env`; deploying uses the signed-in `gh` CLI
  or `GH_TOKEN`. The same `LINEAR_API_KEY` must be a repository secret for the workflow.
- Linear's own agent can do this too: give it this repo through Linear's GitHub
  integration, and add `LINEAR_API_KEY` and `GH_TOKEN` (fine-grained, Actions: write on
  this repo) to its environment secrets.
- Edits to a live post appear on the next deploy: any push to `main`, or `--deploy`.
- Deploys fail if the secret is missing or a project is renamed, rather than silently
  taking Linear posts offline.

## Markdown posts

Posts can also be Markdown files in the repo. Each is `posts/<anything>.md`:

```
---
title: Post title
date: 2026-10-19
slug: post-title          # optional; defaults to the file name; becomes /posts/<slug>/
draft: true               # optional; drafts are never built for the live site
description: One line.    # optional; used for meta description
---

Markdown body.
```

- `node build.mjs` builds what goes live (drafts skipped). `node build.mjs --drafts`
  (or `npm run preview`) includes drafts, tagged "(draft)", for local checking only.
- The home page gets a "Writing" section, newest first under year headings, only when
  there is at least one post to show. Post pages reuse `index.html`'s header, footer and
  theme script, with `<main>` swapped for the article.
- The build also writes `rss.xml` (full post HTML) and `sitemap.xml`.
- The build fails on bad front matter (missing title, date not `YYYY-MM-DD`, bad or
  duplicate slug), so a broken post fails CI instead of shipping.
- The repo is public, so draft posts are readable on GitHub even though they're not on
  the site. Keep anonymising rules (client names, figures as XX) in drafts too.
- Markdown and Linear posts are merged by `loadPosts()`; a slug used by both fails the
  build.

## Fallback

The previous Windows 98 desktop site is preserved at tag `win98-site` and branch
`archive/win98-site`. To restore it: `git checkout win98-site -- .` on a branch, or
reset `main` to that tag.

## Roadmap

1. ✅ Phase 1 — strip to a single static page.
2. ✅ Phase 2 — add writing: `build.mjs` turns Markdown posts into pages, a year-grouped
   index, `rss.xml` and `sitemap.xml`; GitHub Pages deploys from a GitHub Actions workflow.
3. ✅ Phase 3 — write in Linear: each post is a Linear document; the build pulls
   Website: Published through Linear's API and an agent publishes on request.

## Verifying changes

Run `npm install` once, then `node build.mjs --drafts` and serve `_site/` over HTTP
(e.g. `npx serve _site`). Check it at desktop and phone widths, in light and dark mode.
Opening `index.html` directly still works for home-copy edits, minus the Writing section.

## Deployment

- GitHub: `https://github.com/Shirazik/khs-website`, branch `main`
- Custom domain: `kareemshirazi.com` (set in Settings → Pages; `CNAME` is also copied
  into the build)
- Pages source must be **GitHub Actions** (Settings → Pages → Build and deployment).
  Push to `main` runs `.github/workflows/deploy.yml`: `npm ci`, `node build.mjs`, deploy
  `_site/`. Pull requests run the build only, as a check.
- Repository secret `LINEAR_API_KEY` is required for deploys (`--require-linear`).
