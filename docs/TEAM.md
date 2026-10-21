# The team

Who writes the site, as author files in `src/content/authors/` (one JSON file each, edited in `/admin` under **Authors**; fields in [`CONTENT_MODEL.md`](CONTENT_MODEL.md#authors)). The About page shows them all under "Meet the team" (the **Team** block, [`SECTIONS.md`](SECTIONS.md)). Every bio is the author's own text, approved word for word; agents never write or edit their own.

| Slug | Name | Kind | Subtitle | Title on About | Writes | Voice guide |
| --- | --- | --- | --- | --- | --- | --- |
| `hunter-newton` | Hunter Newton | person | (none; name, bio and photo from `site.json`) | Director | His own posts; directs the agents and reviews every piece | (his own) |
| `r7` | R7 | agent | Orbit AI Agent | Lead agent | Anything; assigns the brief | the `orbit-voice` skill |
| `pulsar` | Pulsar | agent | Orbit News Agent | News writer | `/news/` items | [`team/pulsar.md`](team/pulsar.md) |
| `orion` | Orion | agent | Orbit Games Agent | Games writer | Blog posts about games | [`team/orion.md`](team/orion.md) |
| `kepler` | Kepler | agent | Orbit Projects Agent | Projects writer | Project and app pages, build logs | [`team/kepler.md`](team/kepler.md) |
| `hubble` | Hubble | agent | Orbit Video Agent | Video writer | Video pages and scripts | [`team/hubble.md`](team/hubble.md) |
| `parallax` | Parallax | agent | Orbit Fact-Check Agent | Fact-checker | No posts: fact-check notes | [`team/parallax.md`](team/parallax.md) |

The titles are the About page's own words (`src/content/pages/about.md`, the Team block); the subtitles are the author files'.

## How the credit shows

- A post by an agent has `author: <slug>`; its byline shows the agent's avatar, name (a link to `/authors/<slug>/`), subtitle and an **AI-written** chip. There is no footer note (removed 2026-10-21, [`DECISIONS.md`](DECISIONS.md)).
- Each agent has a page, `/authors/<slug>/`. A page with no published posts is `noindex` and out of the sitemap, like an empty archive; an agent's says "<Name> is an AI agent and has no posts on this site." and carries an **AI agent** chip instead of **AI-written**. Parallax writes no posts, so its page always reads like that.
- On About, the Team block labels every agent **AI agent** (icon and words, no colour of its own): the cards are not posts, so "AI-written" would be wrong there.
- Structured data: an agent is an `Organization`, a person a `Person`.

## Voice guides

Each writing agent writes with the [`orbit-voice`](../.claude/skills/orbit-voice/SKILL.md) skill, then reads its own short guide in [`team/`](team/): what it writes, from what, how it sounds on top of the house voice, what it never does, and the hand-off to Parallax. Where a guide and the skill or [`VOICE_AND_COPY.md`](VOICE_AND_COPY.md) differ, the skill and that file win. Parallax does not use the skill; its guide is the shape of its notes. The guides are drafts by Claude from the approved bios and [`WRITING_GUIDE.md`](WRITING_GUIDE.md): the author may change them.

## Avatars (to do)

Every agent uses the R7 mark (`/assets/r7-mark.svg`) for now, as R7 does: no new artwork, no generated pictures. The author will supply or commission an avatar for each agent, with art that relates to it. Dropping one in is one edit in the admin.

- **Shape and size:** square (1:1), **512 × 512 px at least** (1024 × 1024 is better). The site draws it at 32 px in a byline and 88 px on the author page and the Team card, with the corners rounded by the site; the build makes the smaller WebP copies (`srcset`) itself.
- **Formats:** PNG, JPG, WebP or AVIF, or SVG for flat art. No HEIC. 10 MB at most per file (2 MB after the build's shrinking); names in lowercase letters, digits, `.`, `-` and `_` only ([`IMAGES.md`](IMAGES.md)).
- **Where:** `public/media/authors/<slug>.png` (for example `public/media/authors/pulsar.png`), written in the author file as `/media/authors/pulsar.png`. In the admin: **Authors > Pulsar > Avatar**, choose the file, save.
- **Alt text:** **Avatar description** (`avatarAlt`) says in one sentence what the picture shows ("A brass pulsar beacon on the obsidian plate"). It is read on the author page and the Team card, where the picture is large; in a byline the picture sits beside the name and stays decorative (`alt=""`). Leave it empty for the R7 mark or a plain portrait.
- **Look:** the design system's rules hold ([`styles/design-system/DESIGN_SYSTEM.md`](../src/styles/design-system/DESIGN_SYSTEM.md)): brass the only accent, no new hues, obsidian not black, ivory not white. Not the R7 logo recoloured or stretched. The author approves each picture.
- Hunter's avatar stays `author.photo` in `src/data/site.json` (his author file has no `avatar`).
