# Brand files

Everything that is a picture or an icon. Vector (SVG) first; PNG where a platform needs pixels.

## Web essentials (the folder root)

Put these in the site's public/static folder.

| File | Size | Used for |
|---|---|---|
| `favicon.svg` | vector | Modern browsers' tab icon (the plate and the R7, no ring) |
| `favicon.ico` | 16, 32, 48 | Old browsers, feed readers, Windows |
| `favicon-16x16.png`, `-32x32`, `-48x48` | | If a tool asks for PNG favicons |
| `apple-touch-icon.png` | 180×180 | iOS home screen (full-bleed plate; iOS rounds it) |
| `icon-192.png`, `icon-512.png` | | Android/PWA manifest icons |
| `icon-maskable-512.png` | 512×512 | PWA "maskable" icon (artwork kept inside the safe 80%) |
| `site.webmanifest` | | Name, colours, icons for "Add to home screen". Edit `name` and `description` |
| `og-default.png` | 1200×630 | Link preview (Open Graph / Twitter / LinkedIn) for any page without its own image |
| `social/og-newsletter.png` | 1200×630 | The newsletter's share picture: Buttondown's Share image, and link previews of /newsletter/ (copy in `public/og-newsletter.png`). Render with `node scripts/render-brand.mjs og-newsletter` |

## Social (`social/`)

| File | Size | Used for |
|---|---|---|
| `avatar-800.png` | 800×800 | Profile picture on YouTube, GitHub, X, LinkedIn, Bluesky (the icon survives a circle crop) |
| `youtube-banner.png` | 2560×1440 | YouTube channel art. The text sits inside the centre 1546×423 safe area |
| `github-social-preview.png` | 1280×640 | A repository's social preview (Settings → Social preview). Edit the source for each repo |

## Logo (`logo/`)

| File | Use |
|---|---|
| `r7-orbit-icon.svg`, `r7-orbit-icon-2048.png`, `-4096.png` | The app icon (plate, R7, ring, dot): the master for any square icon, large format, print |
| `r7-orbit-mark-ring.svg`, `r7-orbit-mark-ring-2048.png` | R7 + ring + dot on a transparent background (dark backgrounds only) |
| `r7-mark.svg`, `r7-mark-1024.png` | The R7 alone, brass gradient, transparent. **The everyday logo on dark** |
| `r7-mark-ivory.svg`, `-1024.png` | The R7 alone, flat ivory. Where brass would be too much |
| `r7-mark-ink.svg`, `-1024.png` | The R7 alone, flat ink. **For light backgrounds** and print |
| `lockup-horizontal-dark.png` | Mark + R7 ORBIT wordmark, transparent, light text: for dark backgrounds |
| `lockup-horizontal-ink.png` | Same in ink: for light backgrounds |

Rules: see `../design-system/DESIGN_SYSTEM.md` §2 (clear space = ¼ of the mark's height; min mark height 14px; ring versions not below ~32px; never recolour, stretch or add effects).

## Editing the pictures that contain text (`source/`)

`og-default.html`, `github-social.html`, `youtube-banner.html` and `lockup.html` are the sources. Open one over a local web server (`python -m http.server` in the kit folder, then `http://localhost:8000/brand/source/og-default.html`), change the words, and take a screenshot at the page's exact size (browser dev tools → "Capture node screenshot" on the `.canvas` element, or any HTML-to-image tool such as Playwright's `page.screenshot`). Each page is designed at the exact pixel size of the picture it makes, and uses the same tokens and fonts as the site.

The R7 Orbit repository that produced this kit also has a script that renders them in one go (`scripts/render-html.cjs`, needs Electron); it is not part of this kit.

## Not made yet

X header (1500×500), LinkedIn banner (1584×396), per-post OG images (generate at build with satori: `og-default.html` is the layout to copy), a square 1080 post template for social.
