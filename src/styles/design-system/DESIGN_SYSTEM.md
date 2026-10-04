# R7 Orbit Design System

Version 0.1 · derived from the R7 Orbit desktop app · for the R7 Orbit website (news, blogs, vlogs, projects, repos)

Open `index.html` through a local static server to see all of this live (for example `python -m http.server 8000` in the folder above this one, then http://localhost:8000/design-system/index.html). It needs `http://`, not `file://`, so the fonts load.

**In one line:** warm black, warm off-white, one brass accent; hairlines and small corners; a serif for big moments, a quiet sans for everything else, a mono for code and data; motion that means something.

---

## Contents

1. [Principles](#1-principles)
2. [Logo](#2-logo)
3. [Colour](#3-colour)
4. [Typography](#4-typography)
5. [Space, shape and elevation](#5-space-shape-and-elevation)
6. [Motion](#6-motion)
7. [Layout](#7-layout)
8. [Components](#8-components)
9. [Designing the site's content types](#9-designing-the-sites-content-types)
10. [Accessibility](#10-accessibility)
11. [Using it](#11-using-it)
12. [What is from the app, what is new, what is open](#12-what-is-from-the-app-what-is-new-what-is-open)

---

## 1. Principles

1. **Depth is tone.** Surfaces step from warm black to slightly lighter warm black. Shadows are rare and only for things that float.
2. **One accent.** Brass is the only colour that isn't a neutral. If everything is highlighted, nothing is. Status colours are muted and used sparingly.
3. **Ivory, never white.** Text is a warm off-white on a warm near-black. Pure `#ffffff` and `#000000` never appear.
4. **Hairlines and small radii.** One-pixel borders and 4 to 12px corners read as precision, like an engraved dial. Pill shapes are for chips and dots only.
5. **Movement means something.** A turning arc is working. A breathing ring needs you. The orbiting dot says the thing is alive. Nothing moves just to move.

When a decision isn't written here, ask which of these it serves.

---

## 2. Logo

An **R7** mark in brass, a **ring** around it seen at an angle (tilted −24°), and a **dot** that orbits it. The dot is the idea: something is always in motion around your work. On the far side of the ring the dot goes *behind* the R7, which is why the inside of the R7 is darker than the page (`--void`), never filled with brass.

### Files (`design-system/assets/`)

| File | What it is | Use it |
|---|---|---|
| `r7-orbit-icon.svg` | App icon: dark plate, brass R7, ring and dot | Anywhere a square icon is needed: social avatar, app tiles |
| `r7-orbit-mark-transparent.svg` | R7, ring and dot, no plate | Large, quiet places on dark backgrounds |
| `r7-mark.svg` | The R7 alone, brass gradient, transparent | **The everyday logo** on dark surfaces; header; footer |
| `r7-mark-ivory.svg` | The R7 alone, flat ivory `#ece6d8` | Where brass is already doing a job nearby |
| `r7-mark-ink.svg` | The R7 alone, flat ink `#14110a` | On light/ivory backgrounds, print, one-colour use |
| `r7-favicon.svg` | Plate and R7, no ring | Favicon, tiny sizes (the ring turns to noise below ~32px) |
| `orbit.js` + `.orbit` | The live ring and dot as a drop-in script | Hero, loading, "alive" moments |

Higher-resolution masters, PNG exports, wordmark lockups and the social images are in `../brand/` (see `../brand/README.md`).

### Wordmark

The mark followed by **R7 ORBIT**: Inter Medium, uppercase, `letter-spacing: 0.34em` (`--tracking-wordmark`), 11px in the app, 14px or more on a page. Colour `--text-2`, `--text` on hover. Class `.wordmark`.

### Size and space

- **Clear space:** one quarter of the mark's height on every side.
- **Minimum size:** the mark 14px tall (about 16px wide); the favicon 16px.
- **Header size:** the mark 18px tall.

### Do and don't

- **Do** put the brass mark on obsidian (`--bg` or a surface). Use the ink mark on ivory.
- **Do** keep the hub's R7 interior `--void`.
- **Don't** recolour the mark outside the palette, add shadows or bevels, stretch or rotate it, or put the brass mark on a light background.
- **Don't** use the ring-and-dot versions smaller than ~32px.

---

## 3. Colour

All values are in `tokens.css`. Names match the app where they are shared.

A page is roughly **78% obsidian, 12% surfaces, 8% ivory text, 2% brass.** Brass should be rare enough that it always means something: the main action, the current place, a live thing.

### Surfaces: stepped tones of warm black

| Token | Value | Use |
|---|---|---|
| `--bg` | `#09090a` | The page; code wells |
| `--surface-1` | `#0f0f11` | Cards, header, panels |
| `--surface-2` | `#151518` | Hovered cards, raised panels, inputs on hover |
| `--surface-3` | `#1b1b1f` | Selected tab or segment, the highest raise |
| `--void` | `#020203` | *(web)* Inside the logo; wells that must read as holes |
| `--scrim` / `--scrim-strong` | `rgb(9 9 10 / 0.6)` / `0.78` | *(web)* Dark veil over media: the play ring, duration badges |
| `--header-veil` | `rgb(9 9 10 / 0.82)` | *(web)* The sticky header's translucent background |
| `--on-scrim` | `#ece6d8` | *(web)* Text and icons on a scrim |

### Lines: warm ivory at low opacity

| Token | Value | Use |
|---|---|---|
| `--line` | `rgb(236 228 210 / 0.08)` | Hairline: dividers, card edges |
| `--line-strong` | `rgb(236 228 210 / 0.16)` | Inputs, hovered edges |
| `--line-brass` | `rgb(201 169 106 / 0.42)` | Selected, focused, "needs you" |

### Text: ivory, then two steps down

| Token | Value | Use |
|---|---|---|
| `--text` | `#ece6d8` | Headings, body, anything to be read |
| `--text-2` | `#a39e92` | Supporting text, card summaries |
| `--text-3` | `#827e75` | Meta, captions, placeholders. *Web value* (the app uses `#6b675f`) |
| `--text-3-app` | `#6b675f` | The app's dimmest text. 3.5:1: large or decorative only |

### Brass: the single accent

| Token | Value | Use |
|---|---|---|
| `--brass` | `#c9a96a` | Primary action fill, links, active marks |
| `--brass-bright` | `#e3c98f` | Hover, emphasis, the italic word in a headline |
| `--brass-dim` | `#8c7647` | Quiet marks: bullets, tick rules, idle outline |
| `--on-brass` | `#14110a` | Text and icons on a brass fill |
| `--brass-highlight` | `#f1dca8` | *(web)* The orbiting dot; tiny points of light |
| `--brass-leaf` | `#ecd49a` | *(web)* Logo gradient, light end |
| `--brass-shadow` | `#9a7c46` | *(web)* Logo gradient, dark end |
| `--brass-deep` | `#5c4d2c` | *(web)* Brass in shadow: borders on brass-tinted areas |
| `--brass-gradient` | `linear-gradient(135deg, leaf, brass, shadow)` | The mark and, rarely, one hero word. Never a button fill |
| `--brass-wash-1 / 2 / 3` | brass at 5% / 7% / 12% | Behind callouts, banners, the selected chip |

### Status: desaturated, never the loudest thing on the page

| Token | Value | Use |
|---|---|---|
| `--st-working` | `= --brass` | Something is happening |
| `--st-attention` | `= --brass-bright` | Needs the reader |
| `--st-done` | `#8fa58a` | Done, merged, passing, published |
| `--st-failed` | `#b5685e` | Failed, error, destructive |
| `--st-failed-text` | `#d9a39b` | *(web)* Error text on dark: the red, lightened to read |
| `--st-idle` | `#77736b` | Paused, archived, inactive |
| `--st-done-wash` / `--st-failed-wash` | 7% / 10% tints | Backgrounds for ok / error callouts |

Text selection is brass at 30% (`--selection`, `rgb(201 169 106 / 0.3)`).

Working and attention are deliberately not colours of their own: they are brass and bright brass, so the one accent stays the one accent.

### Contrast (on `--bg` unless stated)

| Pair | Ratio | WCAG |
|---|---|---|
| `--text` | 16.0 | AAA |
| `--text` on `--surface-3` | 13.8 | AAA |
| `--text-2` | 7.45 | AAA |
| `--text-3` (web) | 4.92 | AA |
| `--text-3-app` | 3.54 | large text and UI only |
| `--brass` | 8.88 | AAA |
| `--brass-bright` | 12.34 | AAA |
| `--brass-dim` | 4.55 | AA, but keep it for small marks |
| `--on-brass` on `--brass` | 8.41 | AAA |
| `--st-done` | 7.50 | AAA |
| `--st-failed` | 4.84 | AA |
| `--st-idle` | 4.22 | UI marks only |

The styleguide page computes these live.


## 4. Typography

| Family | Token | Weights | Job |
|---|---|---|---|
| **Cormorant Garamond** | `--font-display` | 400, 500, 600 · italic 400, 500 | Headlines, pull quotes, card titles that want character. Never body text or UI |
| **Inter** (variable) | `--font-ui` | 100–900 (use 400, 500, 600) | Body, UI, labels, buttons, nav, the wordmark |
| **JetBrains Mono** (variable) | `--font-mono` | 100–800 (use 400, 500) | Code, commands, file paths, post meta (dates, durations, counts) |

All three are open-licensed (SIL OFL) and shipped as woff2 in `fonts/`, so the site doesn't depend on a font service.

**The signature move:** in a headline, set one phrase in *Cormorant italic* and `--brass-bright`. (`h1 em`, `.t-display em`.)

### Scale

| Role | Token | Size | Font / weight | Line height | Notes |
|---|---|---|---|---|---|
| Display | `--fs-5xl` | 52–96px fluid | Cormorant 400 | 1.05 | Front-page hero only |
| H1 | `--fs-4xl` | 44–68px fluid | Cormorant 400 | 1.05 | Page and post title |
| H2 | `--fs-3xl` | 44px | Cormorant 400 | 1.2 | The app's empty-state heading |
| H3 | `--fs-2xl` | 32px | Cormorant 500 | 1.2 | |
| H4 | `--fs-xl` | 24px | Cormorant 500 | 1.2 | Also the pull-quote size |
| Lead | `--fs-lg` | 20px | Inter 400, `--text-2` | 1.55 | Under a headline |
| Body | `--fs-base` | 17px | Inter 400 | 1.7 | Articles. Column ≤ 68ch |
| UI | `--fs-md` | 15px | Inter 400 | 1.5 | Cards, fields, menus |
| Small | `--fs-sm` | 13px | Inter 400 | 1.5 | The app's body size; buttons, captions |
| Meta / chip | `--fs-xs` | 11px | Mono, `+0.04em` | 1.4 | Dates, counts, durations |
| Eyebrow | `--fs-2xs` | 10px | Inter, UPPERCASE, `+0.22em` | 1.4 | Section kickers. `--text-3` or `--brass` |
| Label | `--fs-xs` | 11px | Inter, UPPERCASE, `+0.12em` | 1.4 | Status words, "NEEDS YOU" |
| Wordmark | 11px+ | 11px | Inter 500, UPPERCASE, `+0.34em` | | |
| Card title (UI) | | 17px | Inter 600 | 1.3 | Plain card titles |
| Card title (serif) | | 24px | Cormorant 500 | 1.2 | Essays and featured posts |

Weights: `--fw-regular` 400 · `--fw-medium` 500 · `--fw-semibold` 600.
Tracking: `--tracking-tight` −0.01em · `--tracking-normal` 0.005em · `--tracking-wide` 0.12em · `--tracking-wider` 0.22em · `--tracking-wordmark` 0.34em.
Line heights: `--lh-tight` 1.05 · `--lh-snug` 1.2 · `--lh-ui` 1.5 · `--lh-prose` 1.7.

### Rules

- Body text is Inter, not Cormorant: Cormorant is thin at small sizes.
- Headlines are sentence case. Uppercase is only for eyebrows, labels and the wordmark, always tracked.
- Never more than one italic-brass phrase per headline.
- Long reading: `.prose` (17px, 1.7, ≤ 68ch, brass bullets, serif pull quotes, hairline-underlined links).

---

## 5. Space, shape and elevation

### Spacing: a 4px grid

| Token | px | Typical use |
|---|---|---|
| `--s-1` | 4 | Icon gaps, tight stacks |
| `--s-2` | 8 | Between related inline things |
| `--s-3` | 12 | Card inner gaps |
| `--s-4` | 16 | Standard padding |
| `--s-5` | 24 | Card padding, group gaps |
| `--s-6` | 32 | Panel padding |
| `--s-7` | 48 | Between blocks |
| `--s-8` | 64 | *(web)* Section padding |
| `--s-9` | 96 | *(web)* Between page sections |
| `--s-10` | 128 | *(web)* Hero breathing room |

### Radius: small corners read as precision

| Token | px | Use |
|---|---|---|
| `--r-xs` | 2 | *(web)* Tick marks, scrollbar thumbs |
| `--r-sm` | 4 | Buttons, inputs, tabs, kbd |
| `--r-md` | 8 | Panels, code blocks, callouts |
| `--r-lg` | 12 | Cards, dialogs |
| `--r-xl` | 20 | *(web)* Hero panels, large media |
| `--r-icon` | 22% | *(web)* The app icon's plate |
| `--r-full` | 999 | Chips and dots only |

### Borders

`--bw` 1px: every border is a hairline. `--bw-accent` 3px: the status rail on the left edge of a card, and blockquote rules.

### Elevation

Depth is tone first. Use a shadow only when something floats.

| Token | Value | Use |
|---|---|---|
| `--shadow-raise` | `0 8px 24px rgb(0 0 0 / 0.35)` | *(web)* A card on hover |
| `--shadow-float` | `0 18px 50px rgb(0 0 0 / 0.55), 0 2px 8px rgb(0 0 0 / 0.4)` | Menus, dialogs, a dragged card |
| `--glow-brass` | `0 0 28px 0 rgb(201 169 106 / 0.12)` | "Needs you" breathing |
| `--glow-dot` | `0 0 10px var(--brass)` | The small attention dot |

### Texture

The faint engraved dot grid behind the app's canvas: `--grid-dot` at `--grid-size` (32px), faded to the edges with a radial mask. Class `.plate-grid` puts it behind a section. `--plate-gradient` is the icon plate's warm-black gradient, used for media placeholders.

---

## 6. Motion

One easing, three speeds.

| Token | Value | Use |
|---|---|---|
| `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | Everything: quick out, long settle |
| `--dur-fast` | 140ms | Hover, colour changes |
| `--dur` | 240ms | Most things |
| `--dur-slow` | 420ms | Things arriving (`arrive`: scale 0.96 → 1 and fade) |
| `--dur-orbit` | 14s | *(web)* One lap of the dot while busy |
| `--dur-orbit-idle` | 42s | *(web)* One lap while quiet |

Named movements: `spin` (the working arc, 1.6s linear), `breathe` (opacity 1 → 0.45, 2.4–3.2s), `glow`, `arrive`, `slide-in`, `fade-in`, `trace` (a hairline drawing itself).

Status marks (`.mark`): a turning arc = working; a breathing ring = needs you; a solid dot in `--st-done` / `--st-failed` = finished; dashed = idle.

`prefers-reduced-motion`: durations drop to ~0, loops stop, and the orbiting dot is placed and held still. This is built into `tokens.css`, `components.css` and `orbit.js`.

---

## 7. Layout

| Token | Value | Use |
|---|---|---|
| `--w-prose` | 68ch | A reading column |
| `--w-content` | 1120px | Standard page (`.container`) |
| `--w-wide` | 1360px | Header and wide sections (`.container.wide`) |
| `--gutter` | `clamp(16px, 4vw, 40px)` | Page side padding |
| `--bp-sm / md / lg / xl` | 640 / 900 / 1200 / 1480 | Write these numbers in `@media`; CSS can't read variables there |

Z-index: `--z-base` 0 · `--z-raised` 1 · `--z-sticky` 10 · `--z-overlay` 20 · `--z-modal` 30 · `--z-toast` 40.

Card grids: `.grid-cards`, `repeat(auto-fill, minmax(min(100%, 320px), 1fr))`, gap `--s-5`. Mobile first; the layout works from 320px.

Focus: `--focus-ring` (2px `--brass-bright`) with `--focus-offset` 2px, always visible for keyboard users.

---

## 8. Components

All in `components.css`. Class names match the app where a component exists there.

- **Buttons** `.btn` · `.solid` (brass fill, the one main action per view) · `.quiet` · `.danger` · `.sm` (28px) · default 36px · `.lg` (46px) · `.icon`. Hover: border and text go to brass. Active: 0.5px down.
- **Chips** `.chip` (11px, pill, hairline) · `.on` (selected) · `.mono` (versions, languages, tags).
- **Kind label** `.kind`: a 5px dot, an icon, an uppercase label. `.live` makes the dot breathe (for a live stream or a brand-new post).
- **Segmented control** `.seg`: filters and view switches. Selected = `--surface-3` with `--brass-bright` text.
- **Fields** `.field` > `label` + `.input` / `.textarea`. 40px, `--surface-1`, hairline `--line-strong`; focus = `--line-brass` border. `aria-invalid="true"` turns the border red; `.hint.error` explains.
- **Cards** `.card` (+ `.card-media`, `.card-body`, `.card-title`, `.card-text`, `.card-foot`). Hover (links only): border → `--line-strong`, surface → `--surface-2`, rise 2px with `--shadow-raise`. `.fresh` = brass rail on the left edge (the newest thing). `.featured` = slow glow; at most one per page.
- **Callouts** `.callout` · `.brass` · `.ok` · `.bad`.
- **Status mark** `.mark` (+ `.needs`, `.done`, `.failed`, `.idle`), `.attention`.
- **Code** `pre.code` (+ `.k` `.s` `.c` `.n` for tokens, `.add` / `.del` for diffs), inline `code`, `kbd`.
- **Header / nav / footer** `.site-header` (sticky, blurred, hairline) · `.site-nav` (`aria-current="page"` gets `--surface-2` and a hairline) · `.site-footer`.
- **Prose** `.prose` for long reading.
- **Orbit** `.orbit` + `orbit.js`.

Icons: 16×16 viewBox, 1.5px stroke, round caps and joins, `currentColor`, shown at 15px. The page includes a starter set (news, blog, vlog, project, repo, arrow, star, copy, play, sun). Draw new ones in the same language.

---

## 9. Designing the site's content types

Five kinds of post, one visual system. **The kind is a label and an icon, never a colour of its own**, so the single accent stays single.

| Kind | Icon | Card | Notes |
|---|---|---|---|
| **News** | newspaper | Media (16:9) + sans title, 2-line summary, date · read time | Short, fast to scan. Sans title for speed |
| **Blog** | pen | Often no image; **serif title** (`.card-title.serif`), 3-line summary, tags | The reading experience: `.prose`, one column |
| **Vlog** | play | Media with the `.play` ring and `.duration` badge; kind label may be `.live` | Video poster in `.card-media`; hover scales the play ring |
| **Project** | cube | Media + name, one-line description, tech chips (`.chip.mono`), status `.mark` | Status uses the same marks as the app (in progress = turning arc, shipped = done) |
| **Repo** | branch | No image; **mono name** (`owner/repo`), description, `.stats` (language, stars, forks), updated date | Looks like code because it is |

- Order the front page by date; `.fresh` the newest; `.featured` one pinned post at most.
- Filters are a `.seg` (All · News · Blogs · Vlogs · Projects · Repos); tags are `.chip`.
- Media placeholders (no image yet): `--plate-gradient` + the dot grid + the ivory mark at 10% opacity.
- Post pages: eyebrow (kind · read time) → H1 with one italic-brass phrase → lead → `.prose`.

---

## 10. Accessibility

- Body text meets AA everywhere (contrast table in section 3). Only `--text-3-app` and `--st-idle` fall below 4.5:1 and are restricted to large text and non-text marks.
- Keyboard focus is always visible (`--focus-ring`).
- Motion is reduced on request, including the orbit.
- Never rely on colour alone: every status has a shape or a word; kinds have icons and labels.
- Interactive targets are ≥ 28px tall (36px default), with `.btn.lg` at 46px for touch-first pages.
- `<html lang>`, one `<h1>` per page, headings in order, `alt` on every content image (empty `alt` on decorative ones).

---

## 11. Using it

```
design-system/
  DESIGN_SYSTEM.md   this document
  index.html         the live design system page
  tokens.css         all design tokens + fonts
  tokens.json        the same tokens as data
  components.css     base styles + all components
  orbit.js           the animated ring and dot
  assets/            logo files (SVG)
  fonts/             woff2 for the three families (+ LICENSES/)
../tailwind/theme.css   the tokens as a Tailwind v4 theme (optional)
../brand/               favicons, icons, social images, PNG logos, lockups
```

### Start a page

```html
<link rel="icon" href="assets/r7-favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">
<script src="orbit.js" defer></script>
```

### Use the tokens

```css
.thing {
  background: var(--surface-1);
  border: var(--bw) solid var(--line);
  border-radius: var(--r-lg);
  padding: var(--s-5);
  color: var(--text-2);
  transition: border-color var(--dur) var(--ease);
}
.thing:hover { border-color: var(--line-strong); }
```

### The orbit

```html
<div class="orbit" data-orbit="busy" style="--orbit-size: 320px"></div>
```

`data-orbit` empty = quiet drift; `busy` = a lap in about 14s; `busy waiting` = the dot pulses. From script: `el.orbit.set({ busy: true, waiting: false })`.

### Change a value

Edit `tokens.css` first: it is the source of truth. Then update `tokens.json` and `../tailwind/theme.css` to match (they are generated from it: run `node tools/build-design-tokens.mjs` from the kit's root, no dependencies). Don't write raw hex or pixel values in components; if a value is missing, add a token.

### Frameworks

`tokens.json` has every token with its type, grouped (`color`, `fontSize`, `space`, `radius`, `shadow`, `motion`, `layout`, `breakpoint`, ...). It can feed a Figma variables import or a mobile app; values are CSS values.

**Tailwind v4:** `../tailwind/theme.css` maps the tokens onto Tailwind's names while pointing at the CSS variables. In your CSS: `@import "tailwindcss"; @import "./design-system/tokens.css"; @import "./tailwind/theme.css";`. Utilities then read `bg-bg`, `bg-surface-1`, `text-text-2`, `text-brass`, `border-line`, `font-display`, `rounded-lg`, `text-3xl` (the system's 44px), `shadow-orbit-float`, `ease-orbit`, and `md:` means 900px. The default Tailwind palette and breakpoints are switched off on purpose. (Checked against Tailwind 4.3.)

---

## 12. What is from the app, what is new, what is open

**Taken as-is from the app** (`src/renderer/tokens.css`): the three surfaces, the three lines, `--text`, `--text-2`, brass / bright / dim / on-brass, the status colours, the three font families and their pairing, `--r-sm/md/lg`, `--s-1` to `--s-7`, the easing and three durations, `--shadow-float`, and the component vocabulary (`.btn`, `.chip`, `.card`, `.seg`, `.eyebrow`, the status mark, the dot grid, the orbit).

**Added for the web** (each marked *(web)* above): `--void`, the extra brass tones taken from the logo, a web-safe `--text-3`, larger spacing and radius steps, a type scale for reading (17px body, big display sizes), page-width and breakpoint tokens, z-index, the focus ring, `.prose`, post cards, form fields, the site header and footer.

**One deliberate change from the app:** `--text-3` is lifted from `#6b675f` (3.5:1) to `#827e75` (4.9:1) so captions and meta pass AA. The app's value stays available as `--text-3-app`.

**Open questions to settle next**

2. **Content-type colour:** the system keeps one accent and tells kinds apart by icon and label. If you want a second hue for kinds, it should be a muted one added deliberately, not drift in.
3. **Imagery:** what a post's media looks like (screenshots, generated art, video stills), and a treatment that fits the palette (for example a warm duotone).
4. **Voice of the site:** headline tone and microcopy. The app's is plain and calm ("Needs you", "Finished").
5. **Page templates:** home, post, vlog, project and repo pages. This system gives you the parts; the next step is composing them.
6. **Logo extras:** a horizontal lockup with a tagline, a social/OG image, and a favicon set in PNG and ICO if the host needs them.
