# KHS Website — Project Context for Codex

## Project Overview

Personal consulting portfolio site for KHS Consulting. Desktop-first OS-metaphor design (draggable windows, folder system, toolbar dock) with a separate flat mobile layout. No build step — pure HTML + CSS + inline React/Babel.

## Stack

- **React 18.3.1** via CDN (no build toolchain)
- **Babel Standalone** for inline JSX transpilation (`<script type="text/babel">`)
- **CSS custom properties** for theming (3 themes: terminal green, amber, blueprint navy)
- **Google Fonts**: Playfair Display, IBM Plex Mono, Source Sans 3

## File Structure

```
index.html          — entire app: inline styles, React components, mobile HTML section
colors_and_type.css — design tokens (colors, typography, spacing scale) for all 3 themes
mobile.css          — mobile-only styles inside @media (max-width: 768px)
assets/
  KHS_favicon.jpg
  khs-logo.png
  khs-logo-transparent.png
  resume.pdf
CNAME               — kareemshirazi.com
```

## Desktop Architecture (index.html)

All React code is inline in a single `<script type="text/babel">` block.

### Key Components

| Component | Description |
|-----------|-------------|
| `MenuBar` | Top bar: logo, File/View/Go/Help items, live clock |
| `TickerBar` | Animated scrolling text strip below menu bar |
| `OSWindow` | Draggable modal window with traffic-light controls |
| `ProjectContent` | Content rendered inside a project window |
| `AboutContent` | Content rendered inside the About window |
| `ResumeContent` | Resume window with a download link to `assets/resume.pdf` |
| `ContactContent` | Contact window with email, Instagram, and LinkedIn links |
| `AboutSiteContent` | Meta/about-site window explaining the static site and deployment |
| `DockToolbar` | Bottom dock with 7 pixel-art icon buttons |
| `TweaksPanel` | Hidden settings panel (toggled via postMessage from parent frame) |
| `App` | Root: manages window state, folder positions, dragging |

### Data

- `PROJECTS` array — 9 projects: 7 work history (bond, infatuation, trade, jetcom, pawp, buzzfeed, button) + 2 AI side projects (chrome-extension, fpl-analyzer)
  - **AI projects** (`chrome-extension`, `fpl-analyzer`) are a distinct classification from work history. When the user says "my AI projects" or "add another AI project", treat these as the reference group. More AI projects may be added over time.
- `DEFAULT_POS` — default x/y desktop coordinates for each folder; keys must match `PROJECTS` IDs. AI project folders are fixed at `y:560` to the right of the `aboutsite` gear icon (`x:30`). New AI projects should continue extending rightward along that row.
- `SKILLS` array — single source of truth for skill pills. Defined in a plain `<script>` block before the React/Babel block so it's available synchronously to both the desktop `AboutContent` component and the mobile JS that populates `.mob-skills`. **Only edit this one array** — both layouts update automatically.
- `TOOLBAR_ICONS` — 7 icons with inline SVG strings and action names (Home, Portfolio, Philosophies, Contact, Services, Resume, About)
- `TWEAK_DEFAULTS` — default values for the tweaks panel controls

> **Sync rule:** The `PROJECTS` array (React) and the `.mob-cards` block (static HTML, ~line 344) are **not linked** — they must be updated together manually. Any time a project is added, removed, or renamed in `PROJECTS`, make the equivalent change to the corresponding `.mob-card` in the mobile section. The two sources of truth are:
> 1. `PROJECTS` array → drives desktop folder labels and `OSWindow` content
> 2. `.mob-cards` HTML block → drives mobile project cards
>
> Work history projects go in `#mob-projects-section`; AI side projects go in `#mob-ai-projects`. Keep the mobile ordering intentional: current mobile work history order is Bond Holdings, The Infatuation, Pawp, Buzzfeed, Trade Coffee, Button, Jet.com.

### Desktop Interaction Model

- Folders are draggable (mouse only); positions saved to `localStorage('khs-folder-pos')`
- Double-clicking a folder opens an `OSWindow` for that project
- Windows are draggable; z-index managed via `winCounter`
- Toolbar actions: `home` (animate all windows closed), `portfolio` (open all projects), `about` (open about), `resume` (open resume/download window), `contact` (open contact window), `aboutsite` (open about-site window), others open placeholder windows
- Tweaks panel: theme, dot grid, ticker speed, ghost opacity, folder density, shadow color, logo filter, menu bar style

### Theming

Controlled via `data-theme` attribute on `<html>`. Three themes defined in `colors_and_type.css`:
- `terminal` (default) — terminal green
- `amber` — amber/gold
- `blueprint` — navy blue

Theme is persisted to `localStorage('khs-theme')` and restored on load.

## Mobile Architecture

### Strategy

Two-layer swap via CSS media query at `≤ 768px`:
- `#root` is hidden (`display: none !important`)
- `.mobile-layout` static HTML section is shown

The mobile layout is **static HTML** outside React's `#root`, so it's always in the DOM and requires no JS to reveal content.

### Mobile Layout Sections

```
.mob-header          — sticky top bar: logo + wordmark + status dot
.mob-ticker          — CSS-animated marquee strip
.mob-hero#mob-hero   — hero: logo image, tagline, bio, availability
.mob-skills          — skill pill tags
.mob-section#mob-projects-section — 7 work history project cards (.mob-card)
.mob-section#mob-ai-projects      — AI side project cards (label: "Side Projects", title: "AI Projects")
  .mob-card          — retro OS-window-style card: titlebar + body
placeholder anchors/content — #mob-philosophies, #mob-contact, #mob-services, #mob-resume, #mob-aboutsite
.mob-footer          — copyright line
.mob-fab#mob-fab     — floating action button (fixed bottom-right)
.mob-menu-overlay    — full-screen overlay with bottom-sheet grid menu
  .mob-menu-panel    — slides up from bottom
  .mob-menu-grid     — 4-column grid of all 7 toolbar icons
```

### FAB + Grid Menu

- FAB: fixed bottom-right, same retro raised-button style as desktop toolbar
- Tapping FAB toggles `.open` class on `#mob-menu-overlay`
- Bottom sheet slides up with `transform: translateY` transition
- Backdrop tap closes the sheet
- Each icon calls `mobNavigate(action)` → closes sheet + smooth-scrolls to named anchor
- Navigation targets: `home`→top, `portfolio`→`#mob-projects-section`, `about`→`#mob-hero`, `philosophies`→`#mob-philosophies`, `contact`→`#mob-contact`, `services`→`#mob-services`, `resume`→`#mob-resume`, `aboutsite`→`#mob-aboutsite`

### Important CSS Notes

- `overflow: hidden` on `html, body` in the inline `<style>` block overrides linked stylesheets (inline `<style>` is parsed later in document order)
- Mobile scroll unlock requires `!important`: `html, body { overflow: auto !important; height: auto !important; }`
- All theme CSS variables work on mobile automatically — same `<html data-theme>` document

### Mobile JS (`<script>` before `</body>`)

Three functions outside React:
- IIFE populates `.mob-skills` from the global `SKILLS` array
- IIFE sets up FAB toggle + backdrop/close-button listeners
- `mobNavigate(action)` — global function called by `onclick` on grid cells

## Known Limitations / Future Work

- Placeholder/content gaps remain for: Philosophies and Services (anchors exist, content does not)
- Touch drag events not implemented on desktop (mouse-only)
- Placeholder toolbar windows on desktop show "Coming Soon"; Contact, Resume, and About This Site have real window content
- The tweaks panel is only accessible via postMessage (parent frame integration)

## Deployment

- GitHub: `https://github.com/Shirazik/khs-website`
- Branch: `main`
- Custom domain: `kareemshirazi.com` (via CNAME)
- No CI/CD — push to main deploys via GitHub Pages
