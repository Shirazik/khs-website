# KHS Website — Project Context for Claude

## Project Overview

Personal site for Kareem Shirazi / KHS Consulting. A single page of plain text in the
style of karrisaarinen.com: about, notes on building, work history, AI projects,
contact. No framework, no build step, no separate mobile layout.

## Files

```
index.html   — the whole site. All copy lives here, written directly in the HTML.
style.css    — the only stylesheet: light + dark colour tokens, one column.
assets/
  resume.pdf          — linked from the header
  khs-logo.png        — og:image only
  KHS_favicon.jpg
  resume-site.html    — old standalone résumé page; not linked, kept because its URL may be shared
CNAME        — kareemshirazi.com
```

## Conventions

- **Edit copy in `index.html`.** There is one copy of every string; nothing is generated.
- Work and AI projects use the same row pattern: a `<details>` whose
  `<summary>` holds `<span>Name <em>role</em></span><time>years</time>`, followed by a
  paragraph and a bullet list. Copy an existing row to add one.
- AI projects are their own section ("AI projects"), separate from work history. When the
  user says "my AI projects" or "add another AI project", that section is the reference group.
- Escape `&` as `&amp;` in the HTML — the copy is full of them.
- Theme: the OS preference is the default; the moon/sun button sets `data-theme` on `<html>`
  and saves it to `localStorage('theme')`. Dark colours are defined twice in `style.css`
  (media query and `[data-theme="dark"]`) — change both.

## Fallback

The previous Windows 98 desktop site is preserved at tag `win98-site` and branch
`archive/win98-site`. To restore it: `git checkout win98-site -- .` on a branch, or
reset `main` to that tag.

## Roadmap

1. ✅ Phase 1 — strip to a single static page.
2. Phase 2 — add writing: `build.mjs` turns Markdown posts into pages, a year-grouped
   index, `rss.xml` and `sitemap.xml`; GitHub Pages deploys from a GitHub Actions workflow.
3. Phase 3 — write in Linear: each post is a Linear document; the build pulls published
   documents through Linear's API and an agent publishes on request.

## Verifying changes

Open `index.html` in a browser at desktop and phone widths, in light and dark mode.

## Deployment

- GitHub: `https://github.com/Shirazik/khs-website`, branch `main`
- Custom domain: `kareemshirazi.com` (via CNAME)
- Push to `main` deploys via GitHub Pages
