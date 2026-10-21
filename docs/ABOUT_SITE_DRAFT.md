# Draft: a paragraph about the site, for the About page

**Not published.** Two drafts for the author to pick from, edit or throw away. Nothing here is on the site; `src/content/pages/about.md` is unchanged by this file. Drafted by Claude (the coding agent that built the Team block), in the author's first person to match his existing About text, so it is the author's to approve and reword before it goes up (`docs/VOICE_AND_COPY.md`: no AI-written text is published as his without his review).

To use one: in `/admin`, **Pages > About page**, add a **Text** block where it should go (for example after the R7 section, above "Meet the team") and paste it in.

## Version A: what is here, who writes it

> This site is where I post what I'm building with AI: news, blog posts, videos, projects and code. I write some of it myself, and AI agents I run in R7 Orbit write the rest, each with its own job. A piece an agent wrote carries its name and an "AI-written" label, and I read every piece before it goes up. The site shares R7 Orbit's look, but it's a separate project from the app.

## Version B: starting from the site's description

> News, builds and the things in between: this is where I write about building with AI. You'll find short news items, longer posts, videos, my projects and their code. A small team of AI agents helps me: R7 leads, Pulsar, Orion, Kepler and Hubble write about news, games, projects and videos, and Parallax checks their work. Their names are on what they write, and I read every piece before it goes up.

## Where each fact comes from

| Claim | Source in the repo |
| --- | --- |
| The five kinds: news, blog posts, videos (vlogs), projects, code (repos) | `docs/PROJECT_BRIEF.md` §1; `docs/PAGES.md`, "Sitemap" |
| "News, builds and the things in between … building with AI" | The site description, `description` in `src/data/site.json` (the author's own words) |
| Building with AI; R7 Orbit is a desktop app for directing agents | The author's bio, `author.bio` in `src/data/site.json`, and the About text |
| Agents "I run in R7 Orbit" | R7's bio (`src/content/authors/r7.json`) and the About text |
| Each agent's job; Parallax checks the others' work before anything goes up | The bios in `src/content/authors/` (approved by the author, 2026-10-21) |
| R7 "leads" | The title "Lead agent" the author gave R7 in the Team block (`about.md`) |
| An agent's piece carries its name and an "AI-written" label | The byline (`AuthorByline`, `AgentChip`; `docs/DECISIONS.md`, Authors) |
| "I read every piece before it goes up" | The author's own sentence in the R7 section of `about.md` |
| Shares R7 Orbit's look, separate from the app | `docs/PROJECT_BRIEF.md`, first paragraph; `CLAUDE.md`, "What this project is" |

Left out on purpose: anything about the waitlist, a newsletter or contact (the site has no contact address), numbers of posts (they change), and any claim about quality or speed the repo cannot show.
