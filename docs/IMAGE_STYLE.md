# Image style: article imagery

**Status: proposed, not decided.** The author picks; nothing on the live site has changed. Round 1 (three directions) is at `/styleguide/imagery/`; round 2 (variety, the editor's picker, the brand in the words, agent cards: section 8) is at `/styleguide/imagery/v2/`. Both are noindex and unlinked. Screenshots are in `docs/screenshots/imagery-*.png`.

How to look at it:

```
npm run build
npm run preview          # then open http://localhost:4321/styleguide/imagery/ and http://localhost:4321/styleguide/imagery/v2/
# or, without a build:  npm run dev   (same address; pictures load without their small WebP copies)
```

Hover or tab to a card to see the dot move. The page also shows a hover and a focus state side by side, for anyone looking at a screenshot.

---

## 1. The problem

1. **The covers are raw app screenshots.** A 2559 px desktop window shrinks into a 360 px card. Every label in it becomes unreadable, so the picture just says "some software".
2. **Dark UI on dark cards.** The R7 canvas is near black on an obsidian card. The picture has no edge and no focal point. On the home page the pinned card's left half reads as a grey rectangle.
3. **Repeats with nothing to tell them apart.** Three of the five cards on the home page show the same Vesper Drift black-hole frame, and the two "What if you had ten?" posts show near-identical canvases.
4. **No brand.** Nothing in a thumbnail says R7 Orbit. Shared on X or Discord it could be anyone's. A shared post shows the raw cover (and the Vesper Drift project page shares `og-default.png`, not its poster).
5. **The hero fights its own picture.** In `ArticleHero` the screenshot sits under the headline behind one even veil, so UI text ("Gun & HUD juice", "INTERRUPTED") shows through the lead paragraph.

## 2. Three directions

All three use the logo's ring: an ellipse **2.94 times as wide as it is tall, tilted −24°** (`src/scripts/orbit.js`, `RING`), with the bright dot and its short tail. They are CSS and inline SVG laid over the picture. **Nothing is baked into an image file**, so every past and future picture gets the treatment, and changing it later is a CSS change.

### A. Transit (recommended)

**Idea:** one arc of the orbit crosses the corner of every picture, with the dot riding on it. The picture keeps its own colour.

| | |
| --- | --- |
| Brand shape | A large ring, mostly outside the frame. Its left tip curls inside the bottom-right of the picture, so you see a brass "(" with the dot and three tail dots near the tip, plus a soft glow (a light leak) around the dot. |
| The picture | Full bleed, own colours. A **focus point and crop** per picture (`--ix-at`, `--ix-zoom`): busy screenshots are cropped in 1.3–1.6× on their subject. A dark veil deepens the corner the arc crosses (so a 1px brass line reads on any picture) and settles the edges into the card. |
| Title, kind, date | Unchanged on cards: in the card body, as today. Real text, never in the picture. On a video card the duration badge moves to the bottom **left**: the bottom-right corner belongs to the orbit. |
| Card hover/focus | The dot travels 22° up the arc (420 ms, `--ease`), the tail follows, the ring goes from 70% to full opacity. With reduced motion only the ring brightens. |
| Hero | The picture fills the right two thirds; the left third is solid obsidian, fading into it. The words sit on the solid side, never on the picture. The arc and dot sit at the bottom right. On a phone the picture is a 16:9 band at the top and the words start under it. |
| og:image | 1200×630: the picture on the right two thirds, the lockup (mark + R7 ORBIT) top left, the kind in brass, the title in Cormorant with its italic-brass phrase, the date and domain in mono, the arc at the bottom right. |
| No picture | The plate (`--plate-gradient`), the dot grid fading out, the kind's icon in a hairline brass ring at the centre (the logo's place), the same corner arc and dot, and a faint brass wash where the dot is. |

### B. Eclipse

**Idea:** the picture becomes the planet: a circular crop with the brand ring passing **behind it and in front of it**, like the R7 inside the logo's ring.

| | |
| --- | --- |
| Brand shape | A full ring around a circular porthole. The far half is drawn behind the porthole in `--brass-dim`, the near half in front in `--brass`, the dot on the near side. The kind as a "seal" top left: its icon in a small ring with a dot on it. |
| The picture | Cropped to a circle (72% of the frame's height) on its focus point. Behind it: a blurred, darkened copy of the same picture (the 160 px WebP that the build already makes, so no extra weight), with the dot grid. |
| Title, kind, date | Card body, as today. The seal repeats the kind as an icon (decorative). |
| Card hover/focus | The dot travels 34° round the near side of the ring. |
| Hero | Words on the left, the planet on the right half. On a phone the planet is a band at the top. |
| og:image | Words on the plate at the left, the planet and ring on the right. |
| No picture | The porthole holds the plate and the kind's icon. This is the strongest empty state of the three. |

### C. Dial

**Idea:** every picture gets the house grade, obsidian and brass, with orbit lines etched over it like an instrument dial. Its own colour comes back on hover.

| | |
| --- | --- |
| Brand shape | Three concentric rings (inner one strongest) on the picture's centre, the dot and a large glow on the middle ring. Seal top left. |
| The picture | A brass duotone: grey, multiplied by `--brass-bright` (whites turn brass), blacks lifted to `--bg`, a vignette into obsidian. |
| Title, kind, date | Card body, as today. |
| Card hover/focus | The grade fades out and the picture's real colour returns (420 ms); the dot travels 24° and the middle ring brightens. With reduced motion the colour change is instant and the dot stays. |
| Hero | Graded picture on the right two thirds, two rings (the outer one would cross the words). |
| og:image | Graded picture, two rings and the dot on the right, words on the left. |
| No picture | Plate, three rings, the kind icon at their centre. |

## 3. Recommendation: Transit

- **Click appeal.** It keeps each picture's own colour and adds a tighter crop, which is what makes a thumbnail worth a click: the black hole stays orange, the evolution cards stay lilac. Dial turns every picture into the same sepia and loses that. Eclipse is beautiful but shrinks the picture to a circle, a third of the card's area; a screenshot becomes illegible inside it (see `imagery-eclipse-cards-1440.png`).
- **Consistency within the rules.** One brass shape in one place on every picture. Nothing else is added: no second hue, no new font. Kinds are still told apart by icon and label.
- **Recognisable at any size.** The curl and the dot read at 320×180 and still read at 160×90 (`imagery-transit-details-1440.png`). Eclipse reads at both too. Dial's hairlines get lost on busy pictures below about 320 px.
- **Performance.** No extra request. On a card it is one small inline SVG (the ring paths are defined once per page). The hero picture gets *smaller* (68% of the width), so `sizes` drops and LCP can only improve. The prototype page itself scores 99 for Lighthouse performance (LCP 1880 ms, CLS 0) with 33 treated cards, 18 thumbnails, 3 heroes and 9 share images on it.
- **Accessibility.** The overlay never holds text. Text over pictures (hero and share image) sits on a near-solid veil: 4.9:1 or better, measured.
- **Effort.** The smallest of the three: one component (`CardMedia`) gains an overlay, `ArticleHero` gets a new veil and layout, the placeholder gets the kind icon. Eclipse needs the same plus a second picture per card. Dial needs blend modes everywhere and a contrast story for brass-on-brass.

What Transit does not fix on its own: a very dark screenshot is still dark. The rules below (crop in, lift exposure, prefer a detail) do that work, and they are needed whichever direction is picked.

Worth keeping from the others whatever is picked: **Eclipse's no-picture card** (the kind icon inside the ring) and its **kind seal**, if the author wants the kind on the picture itself.

## 4. Rules that make any picture look on-brand

### Pictures

| Rule | Why |
| --- | --- |
| Covers are **16:9**, at least **1280×720**, ideally 1920×1080. Never smaller than 960 wide. | Cards crop to 16:9; the share image needs 1200 wide; the build makes 160–1280 px WebP copies. |
| Every cover has a **focus point** (where the subject is) and a **zoom** (1–2). Default: centre, 1. | The crop decides whether a thumbnail reads. Proposed front matter: `coverFocus: "48% 40%"`, `coverZoom: 1.5`. |
| **Busy screenshots** (a whole app window): zoom 1.3–1.6 on one subject: one card, one result, the hub. Better still, take a second screenshot of just that part. Never use a full desktop window at 1×. | At card size a full window is just texture. |
| **Dark screenshots:** take them at a higher zoom level in the app, or with the subject brightly lit. A cover whose brightest areas are under about 40% grey will look empty on the obsidian card. | Dark on dark has no edge. |
| **Photos and game frames** (the black hole): zoom 1–1.2, focus on the subject. | They already have a subject and colour. |
| **Illustrations and diagrams:** on a dark background only; no white canvases. | A white rectangle on an obsidian page is the loudest thing on it. |
| **Safe area:** keep the subject out of the right 38% of the frame below the top fifth. That is where the arc runs (x ≥ 61%, y ≥ 19% of the frame). | So the ring never crosses a face, a title in a screenshot, or the play button. |
| **No text in the picture** that a reader needs. Titles, kinds, dates and durations are HTML in the card. Text that comes with a screenshot is fine as texture. | Text in a picture is not read by screen readers, does not translate, and shrinks to nothing. |
| One cover per post. Two posts about the same thing (a vlog and its blog post) should not share one frame: use a second frame or a different crop. | Repeats on the home page. |

### Ring geometry (Transit)

All in the overlay's own units: a 320×180 box (a 16:9 card at 1×). The SVG scales with the frame (`preserveAspectRatio="xMaxYMax slice"`, anchored bottom right).

| Part | Value |
| --- | --- |
| Ring | Ellipse centre (372, 80), rx 190, ry 64.6 (rx / 2.94), tilt −24°. Visible arc: angles 116°–261°, entering and leaving through the right edge; its tip is at (62%, 87%). |
| Dot at rest / on hover | 196° (62%, 77% of the frame) / 218° (68%, 58%). |
| Dot | Diameter 7 units on a card (≈7–8 px), 5 on the pinned card (≈9 px), 8 at 320×180, 13 at 160×90 (≈6.5 px), 5 units in the hero (≈16 px), 5 in the share image (≈13 px). |
| Tail | 3 dots behind the head, 1.1% of the ring's length apart; each is (1 − 0.22k) of the dot's size at opacity 0.8 − 0.2k (k = 1, 2, 3). |
| Glow | A blurred dot (Gaussian blur, 4 units) 3.5× the dot's size, `--brass-bright` at 50%. |
| Ring stroke | 1px on cards (`--bw`), 1.25px on the pinned card, 1.5px in the hero, 2px in the share image. It does not scale with the frame (`vector-effect: non-scaling-stroke`). |
| Hero and share image | The ring box is 16:9, anchored bottom right: `min(100%, 64rem)` wide in the hero, 70% of the share image. |

The dot is a zero-length dash with round caps on the ring path (`pathLength="100"`). Moving it is a change of `stroke-dashoffset`, so it slides along the exact curve with CSS alone. No JavaScript.

Proposed tokens for the rollout (not added yet: a token change is its own task): `--orbit-ratio: 2.94`, `--orbit-tilt: -24deg`, `--orbit-ring: var(--bw)`, `--orbit-ring-wide: calc(var(--bw) * 1.5)`, `--orbit-travel: var(--dur-slow)`.

### Colour

Brass tokens only. All transparency is `color-mix()` over a token; no new values.

| Part | Colour |
| --- | --- |
| Ring | `--brass-bright` at 70%, 100% on hover/focus |
| Dot | `--brass-highlight` (the brightest brass, "for tiny points of light") |
| Tail | `--brass` at 60%, 40%, 20% |
| Glow | `--brass-bright` at 50%, blurred |
| Corner veil | `--bg` at 70%, fading to nothing over 75% of the frame; edge vignette `--bg` at 45% |
| Hero / share veil | `--bg` solid on the words' side (0–30%), 88% at 44%, 25% at 72%, then clear |
| No picture | `--plate-gradient`, `--grid-dot`, icon ring `--line-brass`, icon `--brass`, wash `--brass-wash-3` |

### Motion

| What | Spec |
| --- | --- |
| Dot travel on hover/focus | `stroke-dashoffset`, `--dur-slow` (420 ms), `--ease`. 22° of arc. |
| Ring brightening | `opacity`, `--dur` (240 ms), `--ease`. |
| Nothing moves on its own | No idle animation on cards. The orbit's continuous motion stays in the home hero, loading and the 404 (design rule 8). |
| `prefers-reduced-motion: reduce` | The dot stays where it is; only the ring brightens. (The token file also makes every duration 0.001 ms.) |

## 5. Accessibility

- **Decorative.** Every overlay SVG, veil, seal and placeholder is `aria-hidden="true"` and `focusable="false"`; the card's link name is still its title. The picture keeps its alt text.
- **No text on pictures on cards.** On the hero and share image the words sit on a near-solid veil. Measured over the real pictures by sampling the brightest pixel behind each run of text (the method of `tests/hero-contrast.spec.js`): every hero and share image in all three directions passes AA at 320, 768 and 1280 px; the worst case is 4.77:1.
- **Focus.** Keyboard focus moves the dot exactly as hover does, and the card keeps the site's focus ring (`--focus-ring`).
- **Forced colours.** The ring, glow, seal, tone and grid are hidden; on cards the veil goes too; behind hero and share-image text the veil becomes `Canvas` at 85%. The picture shows without any filter.
- **Print.** Overlays, veils and grades are hidden; the picture prints plain.
- **axe** on the prototype page: no violations at 375 and 1280 px. It reports text over pictures as "needs review" (it cannot see through a picture); the measurement above covers that.

## 6. What was checked, and what was not

Checked:

- The prototype page at 1440×900 and 390×844 (Playwright screenshots, 28 files in `docs/screenshots/imagery-*.png`), and at every audit width (320–1480) by `tests/audit.spec.js`.
- axe: 0 violations at 375 and 1280 px. No console errors.
- Lighthouse (mobile, simulated): performance 99, accessibility 100, best practices 100, LCP 1880 ms, CLS 0. The page's own SEO is 69 because it is noindex, by design.
- **The live site is unchanged.** Every built HTML, CSS, JS and XML file is byte-identical to the build before this work; the only new file is `dist/styleguide/imagery/index.html`. The page's CSS is in its own file, imported by that page only.
- Text contrast over the pictures, as above.

Not checked:

- Safari and Firefox. The dot relies on zero-length dashes with round caps and `stroke-dashoffset` transitions on `<use>`; both are standard, but only Chromium was run here.
- Real share-image rendering on X, LinkedIn, Discord and Slack: the share images here are HTML. The rollout's build step would make the PNG.
- Pictures that are not on the site yet (a bright photo, a white diagram). The rules above say what to do with them; the prototype only has the real covers.

Screenshots: `imagery-overview-1440`, then per direction (`transit`, `eclipse`, `dial`): `-cards-1440` (before/after, pinned, archive cards), `-details-1440` (states, 320×180 and 160×90 thumbnails), `-no-picture-1440`, `-hero-1440`, `-og-post-1200x630`, `-og-project-1200x630`, `-og-no-picture-1200x630`, `-cards-390`, `-hero-390`.

## 7. Rollout plan (Transit)

### What changes

| Where | Change |
| --- | --- |
| `src/components/CardMedia.astro` | Draws the overlay over the picture and sets `--ix-at` / `--ix-zoom` from the cover. One place: every card (news, blog, vlog, project, related, search results) goes through it. |
| `src/components/AppCard.astro` | Draws its own `<img>` today: switch it to `CardMedia` (or the same overlay). |
| `src/components/VlogCard.astro` | Duration badge to the bottom left. |
| `src/components/MediaPlaceholder.astro` | Takes the post's kind: the kind icon in a ring, the plate, the arc. |
| New `src/components/OrbitDefs.astro` | The ring paths and the glow filter, once per page (like `IconSprite`), rendered by `BaseLayout`. |
| New `src/lib/orbit.ts` | The geometry (ellipse path, angle → place on the path). Pure, unit-tested. |
| `src/components/ArticleHero.astro` | The picture on the right two thirds, the left-solid veil, the arc. `sizes` becomes `(min-width: 900px) 68vw, 100vw`. |
| `src/styles/site.css` | The overlay rules (about 2 kB gzipped; the prototype's whole stylesheet, all three directions, is 3.1 kB). Tokens added to `tokens.css`, `tokens.json` and `DESIGN_SYSTEM.md` (§4). |
| `src/content.config.ts`, `src/lib/post-cards.ts`, `src/admin/config.ts` | Optional `coverFocus` and `coverZoom` per post: a 3×3 focus picker and a zoom number in the editor. |
| `src/admin/preview.css`, `preview-html.ts`, `post-preview.ts` | The editor's previews draw the same card and hero, so the author sees the crop while editing. |
| Share images | A build-time endpoint, `src/pages/og/[...slug].png.ts`, plus `src/lib/og-image.ts`; `ArticlePage`, `VlogPage`, `ProjectPage` point `og:image` at it. |

### Share images at build time

The brand shapes stay out of the source pictures. The share image is composed during the build:

- **Possible today, no new dependency:** `sharp` (already a dev dependency, used by `scripts/media.mjs`) can resize the cover to 1200×630 with its focus point, then composite an SVG over it: the veil (an SVG gradient), the ring, the dot and its glow, and the lockup PNG from `brand/logo/`. An Astro static endpoint returns the PNG, so it lands in `dist/og/` like any page. **The one thing it cannot do well is the title**: sharp draws SVG text with the system's fonts (librsvg and fontconfig), not the site's woff2 files, and the build machine (Cloudflare Pages) has no Cormorant.
- **Phase 1 recommendation: no title in the image.** X, LinkedIn, Slack and Discord all print `og:title` next to or under the picture, so a picture with the lockup, the kind and the arc is complete. The kind labels (five words) can be drawn once from `brand/source/` like the lockup, and committed as small PNGs.
- **Titles in the image** would need `satori` + `@resvg/resvg-js` (two new dependencies, a few MB installed, build-time only; nothing ships to readers), with TTF or WOFF copies of Cormorant and Inter (satori does not read woff2). That is the author's call (CLAUDE.md: ask before a new dependency). Playwright, already installed for the tests, could screenshot the prototype's HTML share image instead, but it would need a browser downloaded in every Pages build: too slow and fragile there.

### LCP, CLS and the budgets

- **No new request on any page.** The ring is inline SVG; its paths are defined once per page (about 0.5 kB of HTML for Transit); each card adds about 550 bytes of HTML before gzip, most of it repeated, so little after gzip.
- **CSS:** about +2 kB gzipped on every page, inside the 40 kB budget.
- **JavaScript:** none.
- **LCP:** cards: unchanged (the overlay paints with the picture). Hero: a smaller picture (68% of the width), so an equal or better LCP. Watch the HTML size of the long listings: the thinnest route today is `/styleguide/sections/` at 14.5 kB of gzipped HTML, just under the first TCP window, and every card adds overlay markup.
- **CLS:** 0. Everything is absolutely placed inside the existing 16:9 box.

### Tests

- Unit: `orbit.ts` (path, angle → path position, the dot stays inside the frame for every context); `og-image.ts` (1200×630 PNG, under 300 kB, works offline); the focus and zoom schema (bad values fail the build with a readable message).
- e2e: every card's overlay is `aria-hidden` and not focusable; hover and focus change the dot's `stroke-dashoffset`, and with reduced motion they do not; forced colours hide the overlay; `hero-contrast.spec.js` keeps passing over the new veil; every post's `og:image` answers 200 and is 1200×630; axe, budgets and Lighthouse on every route as now.
- Refresh the screenshots and `tests/fixtures/site-chrome.txt` only if the head changes (the `og:image` address will).

### Tasks (at most four, one pull request each)

1. **Card overlay and placeholder.** `src/lib/orbit.ts` (+ test), `OrbitDefs.astro`, `BaseLayout.astro` (render it), `CardMedia.astro`, `AppCard.astro`, `VlogCard.astro`, `MediaPlaceholder.astro`, `site.css`; the tokens in `tokens.css`, `tokens.json`, `DESIGN_SYSTEM.md`; e2e for overlay, hover, reduced motion, forced colours.
2. **Cover focus and zoom.** `content.config.ts`, `src/lib/post-cards.ts` (`coverOf`), `src/lib/cards.ts` (`Cover`), `src/admin/config.ts` and the previews (`post-preview.ts`, `preview.css`), `docs/CONTENT_MODEL.md`, `docs/IMAGES.md`; set the focus on the five current covers.
3. **Article hero.** `ArticleHero.astro`, `src/admin/preview-html.ts` and `preview.css` (the blog preview's hero), `tests/hero-contrast.spec.js` (unchanged rules; new layout).
4. **Share images.** `src/pages/og/[...slug].png.ts`, `src/lib/og-image.ts` (+ test), kind-label PNGs in `brand/` and `brand/source/`, `ArticlePage.astro`, `VlogPage.astro`, `ProjectPage.astro`, `src/lib/seo.ts`, `docs/SEO_AND_SHARING.md`; an e2e check of every `og:image`.

When the rollout is done: delete `src/pages/styleguide/imagery/`, `src/styles/imagery-prototype.css` and its line in `tests/routes.js`, and mark the decision in `docs/DECISIONS.md`.

---

## 8. Round 2: variety, the editor and the brand in the words

The author's feedback on round 1: the looks are liked, but one treatment on every picture gets repetitive and the cards will not stand out from each other; the author wants to choose the look per post in the editor; and the brand should show in the words of a post too, with the app's cards where they fit. Round 2 answers all three. The prototype is `/styleguide/imagery/v2/`.

### 8.1 Variety: one family, many looks

The three directions stop being rivals and become one family. They share the ring and the dot, and each kind of post has its own.

| Kind | Style on Auto | Why |
| --- | --- | --- |
| Blog, news | Transit | Mostly screenshots: they keep their colour, the arc sits in a corner. |
| Vlog | Eclipse | The play button sits in the planet; a video poster does not need to be read at card size. |
| Project, app, repo | Dial | An instrument for a game frame; the colour comes back on hover. |
| Any | Plain | The picture alone, for a picture strong enough without a shape. Chosen, never Auto. |

- **Four corners.** Each style can put its shape in any corner (bottom right, bottom left, top right, top left). Only the shape and its veil turn; **the picture is never mirrored** (that would flip the text in a screenshot). Three styles × four corners, plus Plain, makes 13 looks for one picture (`imagery-v2-variants-1440.png`).
- **The Auto rule.** The style comes from the kind. The corner comes from a hash of the post's address (FNV-1a, modulo 4), so a post looks the same on its card, its page and its share image, on every build. In a list, a card that would repeat its left neighbour's style *and* corner takes the next corner. Nothing is random at view time.
- **Share images** keep the shape on the picture's side, because the words are on the left: there, Transit takes only the vertical flip.
- A video's duration badge moves to whichever bottom corner the arc leaves free.
- Still kept: brass only, and kinds told apart by icon and label. The style follows the kind, but it is never the only thing that says the kind.

### 8.2 Choosing it in the editor

A **Picture** group next to the cover in /admin. Every field starts on Auto, so a post nobody touches still gets its kind's look.

| Field | Values | Default |
| --- | --- | --- |
| Style | Auto, Transit, Eclipse, Dial, Plain | Auto (the kind's style) |
| Ring position | Auto, bottom right, bottom left, top right, top left | Auto (from the address) |
| Focus point | 3×3: the nine points at 15%, 50% and 85% | Centre |
| Zoom | 1 to 2 (1.3 to 1.6 for busy screenshots) | 1 |

The editor's preview shows the card and the share image as they will be. The prototype's picker does exactly this in CSS alone (`:has()`), so it works with JavaScript off; nothing is saved. In Decap: two `select` widgets, a `select` of nine points for the focus (a 3×3 custom widget is possible later: Decap already ships React for custom widgets), and a `number` for the zoom. Front matter: an optional `picture: { style, corner, focus, zoom }`, validated by the schema.

### 8.3 The brand in the words

Five pieces, each rationed so it keeps its effect. The sample post in the prototype uses all five; its words are quoted from R7's published post, and the agents are copied from the screenshot in it.

| Piece | What it is | Rule |
| --- | --- | --- |
| **Word ring** | An ellipse drawn round one to three words, a little tilted, with the dot at its right end. It draws itself as the words come fully into view. Written `==words==` in Markdown (a remark plugin), or `<Ring>` in MDX. | Once a post. In a headline (instead of the italic-brass phrase, never both), a section heading, the lead or a pull quote. **Never in running text**: the ring would cross the lines above and below. |
| **Orbit divider** | The logo's small orbit between two fading hairlines. | Between the main parts of a post. It could replace every `---` in `.prose`: a site-wide change, so the author's call. |
| **Agent card** | The card from the app: status mark, task, agent name in brass, tool, model chip, branch in mono, state, what it reported. | Only to quote what a real agent reported, copied, never written for it. |
| **Orbit diagram** | The canvas as a figure: the R7 hub in the middle, up to six agents around it, joined by hairlines. A list on a rail on phones. | For posts about agents at work. Real agents and tasks only. |
| **Stat dial** | One number inside the brand ring, like the R7 inside the logo: the far half of the ring behind it, the near half and the dot in front. | One a post, for the number the post hangs on, with its source under it. |

The pull quote gets the small orbit as its mark instead of a quotation glyph.

Accessibility: every ring, line and dot is `aria-hidden`; the words stay plain text. With reduced motion the ring is simply there. In forced colours the lines and dots take `CanvasText`. The diagram is a `figure` with a real list of agents; the divider is `role="separator"`. Browsers without scroll-driven animations (Firefox today) draw the ring at once.

### 8.4 R7's posts as agent cards

A post whose author is an agent (`kind: "agent"` in `src/content/authors/`; today only R7) is drawn as the app's agent card in every list: the rail along its body, the done mark, the title in Inter, "R7 · Orbit AI Agent" with the existing **AI-written** chip, the post's address where the branch goes, "Published", the summary, then the kind, date and minutes. A post by Hunter keeps the editorial card with its serif title. The picture treatment is the same for both. Who wrote a post shows before you read a word.

The name, role and label are the author's own text (`r7.json` and `AGENT_LABEL`); nothing new is worded for the agent.

### 8.5 Recommendation (updated)

Ship the **family**, not one direction: Auto by kind (Transit, Eclipse, Dial), four corners by address, plus Plain and the per-post override in the editor. Round 1's case for Transit still holds for screenshots, which is why blog posts and news get it. The other two go where they suit the picture: Eclipse's porthole hides the detail of a busy screenshot, which matters less behind a play button; Dial's grade turns a dark screenshot to mud, and a game frame is not dark in that way.

For the words: the **divider, stat dial and agent card** first (they are blocks; no existing text changes), the **word ring** next (it needs a Markdown syntax), the **orbit diagram** last (the biggest block). **Agent cards for R7's posts** are recommended (honest and on-brand), but they change how three of today's five cards look, so that is the author's call.

### 8.6 Rollout, revised

This replaces the task list in section 7; the "What changes" table there still applies to the picture treatments.

1. **The picture family on cards.** `src/lib/orbit.ts` (geometry, the Auto rule, the neighbour rule; unit-tested), `OrbitDefs.astro`, `BaseLayout.astro`, `CardMedia.astro` (style and corner per card), `AppCard.astro`, `VlogCard.astro`, `MediaPlaceholder.astro`, `post-cards.ts` (the looks for a list), `site.css`; the tokens in `tokens.css`, `tokens.json`, `DESIGN_SYSTEM.md`.
2. **The Picture fields in the editor.** `content.config.ts` (the `picture` object), `src/lib/front-matter.ts` (blank fields dropped), `src/admin/config.ts`, `post-preview.ts` and `preview.css` (card and share image in the preview), `docs/CONTENT_MODEL.md`.
3. **Hero and share images** that follow the post's look: `ArticleHero.astro`, `src/pages/og/[...slug].png.ts` + `src/lib/og-image.ts` (sharp; no title in phase 1, see section 7), `ArticlePage`, `VlogPage`, `ProjectPage`, `seo.ts`, `docs/SEO_AND_SHARING.md`.
4. **The brand in the words.** Section blocks and MDX components for the agent card, orbit diagram and stat dial (`src/lib/sections/definitions.ts`, `src/components/sections/`, `src/components/article/`, `src/admin/blocks.ts`, `docs/SECTIONS.md`, `docs/ARTICLE_COMPONENTS.md`); the divider; the `==words==` remark plugin in `src/lib/markdown/` with its unit test.
5. **Agent cards for agents' posts**, if the author wants them: `PostCard.astro` (a switch on the author's kind), a new `AgentPostCard.astro`, `site.css`.

One pull request each. 1 comes before 2 and 3; 4 and 5 stand alone.

### 8.7 What was checked in round 2

Checked:

- Looked at the page at 1440×900 and 390×844 (13 screenshots, `docs/screenshots/imagery-v2-*.png`), including the picker after changing its choices (`imagery-v2-editor-eclipse-1440.png`). Fixed what looked wrong along the way: the word ring was clamped to the word's width by the site's `svg { max-width: 100% }`, and it crowded the next word.
- The e2e checks on the route (smoke, axe at 375 and 1280 px, the layout audit at 320–1480 px, head and headings, budgets, keyboard, reduced motion) all pass. axe: 0 violations; no console errors.
- Lighthouse (mobile, simulated): performance 99, accessibility 100, best practices 100, CLS 0, **LCP 1958 ms: under the 2000 ms budget, but by less than one step**. What costs the time: the feed's six pictures sit within Chrome's lazy-load distance on a phone and start before the first paint, and the document is 19.7 kB gzipped (one round trip more than a page under 14.6 kB). If it flips over 2000 ms, move the Variety section below "The brand in the words", or take the route out of `tests/routes.js`. Round 1's page is unchanged (LCP 1879 ms).
- **Nothing live changed.** Round 1's built HTML is byte-identical after its helpers moved to `_prototype.ts`, and every other built HTML, CSS, JS and XML file is identical to the build before round 2; the only new file is `dist/styleguide/imagery/v2/index.html`.
- `npm run check` and `npm run lint` are clean.

Not checked: Safari and Firefox (Firefox has no scroll-driven animations, so its word ring is drawn at once, by design); the picker's CSS-only behaviour with a screen reader (the radios are labelled in fieldsets with legends, and work with the keyboard); the real editor (Decap), which this round only mocks.

Screenshots: `imagery-v2-overview-1440`, `-feed-1440`, `-variants-1440`, `-editor-1440`, `-editor-eclipse-1440`, `-sample-post-1440`, `-word-ring-1440`, `-stat-dials-1440`, `-agent-cards-1440`, `-feed-390`, `-editor-390`, `-diagram-390`, `-agent-card-390`.
