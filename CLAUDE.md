# KHS Website — Project Context for Claude

## Project Overview

Personal consulting portfolio site for KHS Consulting. Desktop-first Windows 98 OS-metaphor design (draggable windows, desktop icons, taskbar with Start menu) with a separate mobile layout. No build step — pure HTML + CSS + inline React/Babel.

The visual language is [98.css](https://jdan.github.io/98.css/), vendored and tokenised so it can carry the three KHS themes. **Read the header comment in `vendor/98.css` before touching any chrome** — it documents the fork, the 14 tokens, and the traps.

## Stack

- **React 18.3.1** via CDN (no build toolchain)
- **Babel Standalone** for inline JSX transpilation (`<script type="text/babel">`)
- **98.css v0.1.21**, vendored to `vendor/98.css` and tokenised (see below)
- **CSS custom properties** for theming (3 Win98 colour schemes)
- **Fonts**: Pixelated MS Sans Serif (self-hosted, from 98.css) for all UI chrome; IBM Plex Mono and Source Sans 3 from Google Fonts for body copy. Playfair Display was dropped.

## File Structure

```
index.html          — entire app: inline styles, React components, mobile HTML section
vendor/98.css       — VENDORED FORK of 98.css. Read its header before editing.
vendor/98.css.LICENSE
colors_and_type.css — theme tokens: 14 Win98 tokens per theme + legacy KHS tokens
mobile.css          — mobile-only styles inside @media (max-width: 768px)
assets/
  fonts/            — ms_sans_serif{,_bold}.{woff,woff2} (referenced by vendor/98.css)
  khs-logo-transparent.png
  khs-logo-light-transparent.png
style-guide.html    — standalone design-system page. NOT linked from the site and
                      NOT updated in the Win98 redesign; it documents retired tokens.
CNAME               — kareemshirazi.com
```

## Desktop Architecture (index.html)

All React code is inline in a single `<script type="text/babel">` block.

### Key Components

| Component | Description |
|-----------|-------------|
| `WindowMenuBar` | Per-window File/Edit/View/Help strip. Win98 put menus inside each window, not in a global bar. `View` cycles the theme. |
| `TickerBar` | Animated marquee strip pinned to the top of the desktop |
| `OSWindow` | Draggable window: 98.css `.window` + `.title-bar` + `.window-body` + `.status-bar`, with real `.title-bar-controls` |
| `ProjectContent` | Content rendered inside a project window |
| `AboutContent` | Content rendered inside the About (about me) window |
| `AboutSiteContent` | Content rendered inside the "About This Site" window (stack, hosting, repo) |
| `Taskbar` | Bottom taskbar: Start button + menu, one button per open window, tray clock |
| `TweaksPanel` | Hidden settings panel (toggled via postMessage from parent frame) |
| `App` | Root: manages window state, folder positions, dragging |

### Data

- `PROJECTS` array — 9 projects: 7 work history (bond, infatuation, trade, jetcom, pawp, buzzfeed, button) + 2 AI side projects (chrome-extension, fpl-analyzer)
  - **AI projects** (`chrome-extension`, `fpl-analyzer`) are a distinct classification from work history. When the user says "my AI projects" or "add another AI project", treat these as the reference group. More AI projects may be added over time.
- `DEFAULT_POS` — default x/y desktop coordinates for each desktop icon; keys must match `PROJECTS` IDs **plus** the special `aboutsite` key. AI project folders are fixed at `y:560` to the right of the `aboutsite` gear icon (`x:30`). New AI projects should continue extending rightward along that row.
- `aboutsite` — a special non-project desktop icon (gear icon, rendered separately from `PROJECTS` in `App`). Double-clicking opens an `AboutSiteContent` window (type `'aboutsite'`) describing the site's stack and deployment. It has a `DEFAULT_POS` entry (`x:30, y:560`) but is **not** in the `PROJECTS` array.
- `SKILLS` array — single source of truth for skill pills. Defined in a plain `<script>` block before the React/Babel block so it's available synchronously to both the desktop `AboutContent` component and the mobile JS that populates `.mob-skills`. **Only edit this one array** — both layouts update automatically.
- `TOOLBAR_ICONS` — 7 icons with inline SVG strings and action names (Home, Portfolio, Philosophies, Contact, Services, Resume, About). These now populate the **Start menu**; the name is retained from the retired dock.
- `TWEAK_DEFAULTS` — default values for the tweaks panel controls (theme, dotGrid, tickerSpeed, ghostOpacity, folderDensity). Controls tied to retired chrome were removed; the comment above the object records which and why.

> **Sync rule:** The `PROJECTS` array (React) and the `.mob-cards` block (static HTML) are **not linked** — they must be updated together manually. Any time a project is added, removed, or renamed in `PROJECTS`, make the equivalent change to the corresponding `.mob-card` in the mobile section. The two sources of truth are:
> 1. `PROJECTS` array → drives desktop icon labels and `OSWindow` content
> 2. `.mob-cards` HTML block → drives mobile project cards
>
> Work history projects go in `#mob-projects-section`; AI side projects go in `#mob-ai-projects`. The `aboutsite` section (`#mob-aboutsite`) is static and does not correspond to a `PROJECTS` entry — no sync needed for it.

### Desktop Interaction Model

- Desktop icons are draggable (mouse only); positions saved to `localStorage('khs-folder-pos')`
- Double-clicking an icon opens an `OSWindow` for that project
- Windows are draggable by their title bar; z-index managed via `winCounter`
- `focusedWin` drives 98.css's `.title-bar.inactive` on every other window
- **Minimize keeps the window object alive.** Close sets `animState:'closing'` so
  `finishWindowAnimation` can drop it; minimize only sets `minimized: true`, and the
  taskbar holds the only handle back. `focusWindow` clears the flag, so reopening a
  project from an icon or the Start menu restores a minimized window.
- Taskbar window buttons are a **pure projection** of the `windows` array — there is no
  separate taskbar state. Clicking the focused window's button minimizes it; any other
  button focuses (and restores) it.
- Start menu items call the same `handleToolbarAction` the old dock used
- Tweaks panel: theme, dot grid, ticker speed, ghost opacity, folder density

### Theming

Controlled via `data-theme` on `<html>`. The three themes are modelled on real Windows 98
Appearance schemes, keeping each theme's existing accent hue:

| Theme | Win98 scheme | Reads as |
|-------|--------------|----------|
| `terminal` (default) | Spruce | green |
| `amber` | Desert | tan / olive |
| `blueprint` | Rainy Day | blue-grey |

Each theme defines **14 tokens** that `vendor/98.css` consumes (`--surface`,
`--button-face`, `--button-highlight`, `--button-shadow`, `--window-frame`, `--field-bg`,
`--text-color`, `--disabled-text`, `--dialog-blue`, `--dialog-blue-light`,
`--dialog-gray`, `--dialog-gray-light`, `--dialog-title-text`, `--link-blue`) plus
`--desktop-bg` for the wallpaper. Every `var()` in the vendored file carries its upstream
value as a fallback, so the file still renders as authentic Win98 grey standalone.

**Traps, all documented in the two file headers:**

- The bevel lightness ladder (98% / 89% / 80% / 56% / 14%) is what makes every control
  look 3D. Collapsing those gaps flattens the whole UI at once.
- The same literal means different things upstream: `#fff` is a bevel highlight, a field
  background *and* title-bar text; `grey` is both a bevel shadow and disabled text. They
  are separate tokens. A global find-and-replace on `vendor/98.css` reintroduces the bug.
- Colours inside 98.css's inline SVG data URIs (checkbox ticks, scrollbar arrows, slider
  thumbs) **cannot be tokenised** — `var()` does not resolve inside a `data:` URI. They
  stay at upstream Win98 values and do not follow the theme.

**Theme is owned by `localStorage('khs-theme')` alone.** `TweaksPanel` seeds its selection
from the live `data-theme` attribute and deliberately skips `theme` in its restore-on-mount
loop; replaying it there would clobber the page-load restore on every load (this was a real
bug — the site only ever rendered amber). If you add a theme entry point, write `khs-theme`.

## Mobile Architecture

### Strategy

Two-layer swap via CSS media query at `≤ 768px`:
- `#root` is hidden (`display: none !important`)
- `.mobile-layout` static HTML section is shown

The mobile layout is **static HTML** outside React's `#root`, so it's always in the DOM and requires no JS to reveal content.

### Mobile Layout Sections

```
.mob-header          — sticky top bar styled as a Win98 title bar
.mob-ticker          — CSS-animated marquee strip (sunken)
.mob-hero#mob-hero   — hero rendered as a window panel on the wallpaper
.mob-skills          — skill chips with raised button bevels
.mob-section#mob-projects-section — 7 work history project cards (.mob-card)
.mob-section#mob-ai-projects      — AI side project cards
  .mob-card          — a Win98 window: .mob-card-titlebar + real .title-bar-controls
                       (98.css markup; the buttons are decorative here) + body
.mob-section#mob-aboutsite        — "About This Site" section
placeholder anchors  — #mob-writing, #mob-contact, #mob-services, #mob-resume
.mob-footer          — copyright line
.mob-taskbar         — fixed bottom taskbar: Start button + #mob-clock tray
  .mob-fab           — the Start button (id kept for the existing JS)
.mob-menu-overlay    — full-screen overlay with the Start menu sheet
  .mob-menu-panel    — slides up from the taskbar
  .mob-menu-grid     — 4-column grid of destinations
```

### Start Button + Menu Sheet

- The Start button is `#mob-fab` (id retained so the existing JS keeps working)
- Tapping it toggles `.open` on `#mob-menu-overlay` and `.pressed` on the button.
  The pressed state **must** be set in JS: the overlay is a later sibling than the
  taskbar, so no CSS sibling selector can reach the button.
- Backdrop or close button dismisses the sheet
- Each cell calls `mobNavigate(action)` → closes sheet + smooth-scrolls to its anchor

### Important CSS Notes

- `overflow: hidden` on `html, body` in the inline `<style>` block overrides linked
  stylesheets (inline `<style>` is parsed later in document order)
- Mobile scroll unlock therefore requires `!important`:
  `html, body { overflow-y: auto !important; height: auto !important; }`
- `overflow-x` is pinned to `hidden !important` so the marquee cannot sideways-scroll
  the page
- All theme variables work on mobile automatically — same `<html data-theme>` document

### Mobile JS (`<script>` before `</body>`)

Four blocks outside React:
- IIFE populates `.mob-skills` from the global `SKILLS` array
- IIFE sets up the Start toggle + backdrop/close listeners (and the `.pressed` class)
- IIFE drives the `#mob-clock` taskbar tray clock
- `mobNavigate(action)` — global function called by `onclick` on grid cells

## Known Limitations / Future Work

- Placeholder sections needed for: Writing, Contact, Services, Resume (anchors exist)
- Touch drag not implemented on desktop (mouse-only)
- Maximize is deliberately `disabled` — only minimize/close are implemented
- Colours in 98.css's SVG data URIs don't follow the theme (see Theming above)
- `style-guide.html` documents the retired pre-Win98 tokens and is now stale. It is not
  linked from the site; update or delete it deliberately.
- The tweaks panel is only reachable via postMessage (parent frame integration)

## Verifying changes

No test suite and no build step. Babel transpiles in the browser, so **a JSX syntax error
produces a blank page rather than a build failure** — always load the page after editing
the `<script type="text/babel">` block. Check the console, confirm `#root` has content,
and confirm `assets/fonts/*` return 200 (a 404 silently falls back to Arial, which looks
almost right).

## Deployment

- GitHub: `https://github.com/Shirazik/khs-website`
- Branch: `main`
- Custom domain: `kareemshirazi.com` (via CNAME)
- No CI/CD — push to main deploys via GitHub Pages
