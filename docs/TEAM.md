# The team

Who writes the site, as author files in `src/content/authors/` (one JSON file each, edited in `/admin` under **Authors**; fields in [`CONTENT_MODEL.md`](CONTENT_MODEL.md#authors)). The About page shows them all under "Meet the team" (the **Team** block, [`SECTIONS.md`](SECTIONS.md)). Every bio is the author's own text, approved word for word; agents never write or edit their own.

## Roles and slugs

| Slug (`author`) | Name | Kind | Subtitle | Title on About | Writes | Guide |
| --- | --- | --- | --- | --- | --- | --- |
| `hunter-newton` | Hunter Newton | person | (none; name, bio and photo from `site.json`) | Director | His own posts; directs the agents and reads every piece before it goes up | (his own) |
| `r7` | R7 | agent | Orbit AI Agent | Lead agent | General pieces (essays, how-tos, notes); edits the others' drafts | [`r7.md`](../.claude/skills/add-content/agents/r7.md) |
| `pulsar` | Pulsar | agent | Orbit News Agent | News writer | `/news/` items | [`pulsar.md`](../.claude/skills/add-content/agents/pulsar.md) |
| `orion` | Orion | agent | Orbit Games Agent | Games writer | Blog posts about games | [`orion.md`](../.claude/skills/add-content/agents/orion.md) |
| `kepler` | Kepler | agent | Orbit Projects Agent | Projects writer | Project, app and game pages, repo pages, build logs | [`kepler.md`](../.claude/skills/add-content/agents/kepler.md) |
| `hubble` | Hubble | agent | Orbit Video Agent | Video writer | Vlog pages, and video scripts (not pages) | [`hubble.md`](../.claude/skills/add-content/agents/hubble.md) |
| `pictor` | Pictor | agent | Orbit Imagery Agent | Image maker | No posts: the featured image and hover clip for a post, made in R7 Orbit Studio; credited as "Image by Pictor" | [`pictor.md`](../.claude/skills/add-content/agents/pictor.md) |
| `parallax` | Parallax | agent | Orbit Fact-Check Agent | Fact-checker | No posts: fact-check notes on everyone else's | [`parallax.md`](../.claude/skills/add-content/agents/parallax.md) |

The titles are the About page's own words (`src/content/pages/about.md`, the Team block); the subtitles are the author files'.

## Who writes what

The add-content skill (`.claude/skills/add-content/SKILL.md`, "Who writes it") picks the agent by the kind of piece, sets its slug as `author`, and has it read its guide on top of the [`orbit-voice`](../.claude/skills/orbit-voice/SKILL.md) skill. Every piece ends with Parallax's fact-check (claim, source, verdict, fix) before the report; Hunter reviews last and is the only one who publishes. An agent's post has no `aiAssist`.

Where a guide and the skill or [`VOICE_AND_COPY.md`](VOICE_AND_COPY.md) differ, the skill and that file win. The guides were drafted by Claude from the approved bios and [`WRITING_GUIDE.md`](WRITING_GUIDE.md); the author may change them.

## How the credit shows

- A post by an agent has `author: <slug>`; its byline shows the agent's avatar, name (a link to `/authors/<slug>/`), subtitle and an **AI-written** chip. There is no footer note (removed 2026-10-21, [`DECISIONS.md`](DECISIONS.md)).
- Each agent has a page, `/authors/<slug>/`. A page with no published posts is `noindex` and out of the sitemap, like an empty archive; an agent's says "<Name> is an AI agent and has no posts on this site." and carries an **AI agent** chip instead of **AI-written**. Parallax and Pictor write no posts, so their pages always read like that (Pictor's credit is the "Image by Pictor" line on the posts it made the picture for, and its page lists those posts as cards under "Images by Pictor" instead of the empty box: `imagesByAgent` in `src/lib/authors.ts`, 2026-11-07).
- On About, the Team block labels every agent **AI agent** (icon and words, no colour of its own): the cards are not posts.
- Structured data: an agent is an `Organization`, a person a `Person`.

## Adding an agent later

Three edits, no code:

1. **One author file:** `src/content/authors/<slug>.json` (in `/admin`: **Authors > New Author**), `kind: agent`, with the name, subtitle and bio the author approves, and `avatar: /assets/r7-mark.svg` until its picture exists. It appears in every Author menu after the next deploy.
2. **One guide:** `.claude/skills/add-content/agents/<slug>.md`, in the shape of the others (role and kinds, recipe and template, tone on top of orbit-voice, never, hand-off to Parallax), and a row in the skill's "Who writes it" table, in the table above and in `docs/WRITING_GUIDE.md`, "Who writes what".
3. **One line in the About team block:** **Pages > About page > Team > Add member**, pick the author, give a title. Refresh the About text fixture in the next code change (`UPDATE_PAGE_TEXT=1 npx playwright test about`).

## Avatars

R7 uses the R7 mark (`/assets/r7-mark.svg`). The other five agents have their own avatar, art that relates to each (2026-10-21): Pulsar a star with twin beams, Orion a game controller inside the constellation, Kepler an ocean planet, Hubble the space telescope, Parallax a magnifying glass over a star with a dashed offset ghost. Pictor (added 2026-11-07; the constellation whose name means the painter's easel) is an easel traced as a constellation holding a brass canvas with an orbit and a dot, 512 × 512 PNG from `brand/source/agents/pictor.svg`. Each is a brass picture on the same obsidian plate as the R7 icon, 256 × 256 PNG in `public/media/authors/<slug>.png`; the vector sources (1024 px SVG) are in `brand/source/agents/`, to export larger copies. Replacing one is one edit in the admin.

- **Shape and size:** square (1:1), **512 × 512 px at least** (1024 × 1024 is better; the five agents' 256 px files are the exception, and are enough for the 88 px they are drawn at, 176 px on a 2x screen). The site draws it at 32 px in a byline and 88 px on the author page and the Team card, with the corners rounded by the site; the build makes the smaller WebP copies (`srcset`) itself.
- **Formats:** PNG, JPG, WebP or AVIF, or SVG for flat art. No HEIC. 10 MB at most per file (2 MB after the build's shrinking); names in lowercase letters, digits, `.`, `-` and `_` only ([`IMAGES.md`](IMAGES.md)).
- **Where:** `public/media/authors/<slug>.png` (for example `public/media/authors/pulsar.png`), written in the author file as `/media/authors/pulsar.png`. In the admin: **Authors > Pulsar > Avatar**, choose the file, save.
- **Alt text:** **Avatar description** (`avatarAlt`) says in one sentence what the picture shows ("A brass pulsar beacon on the obsidian plate"). It is read on the author page and the Team card, where the picture is large; in a byline the picture sits beside the name and stays decorative (`alt=""`). Leave it empty for the R7 mark or a plain portrait.
- **Look:** the design system's rules hold ([`DESIGN_SYSTEM.md`](../src/styles/design-system/DESIGN_SYSTEM.md)): brass the only accent, no new hues, obsidian not black, ivory not white. Not the R7 logo recoloured or stretched. The author approves each picture.
- Hunter's avatar stays `author.photo` in `src/data/site.json` (his author file has no `avatar`).
