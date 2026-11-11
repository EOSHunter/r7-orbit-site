# DRAFT for the author to edit; not on the site

Two drafts of a paragraph for the About page that says what the R7 Orbit site is. **Nothing here is published**: `src/content/pages/about.md` does not contain either one. They are written in Hunter's first person to match his About text, so they are his to approve, reword or throw away before anything goes up (`docs/VOICE_AND_COPY.md`: no AI-written text is published as his without his review). Drafted by Claude, the coding agent that built the Team block.

**To add one:** Admin > **Pages** > **About page** > **Add section** > **Text**, paste the paragraph, drag the block to where it should sit (for example after the Orbit section, above "Meet the team"), check the preview, then **Save** and publish as usual.

## Draft A: what is here, and who writes it

> This is where I post what I'm building with AI: news, blog posts, vlogs, projects and the apps I've made. I write some of it, and a team of AI agents I direct in R7 Orbit writes the rest, each with its own job. A piece an agent wrote carries that agent's name, never mine, and I read every piece before it goes up. I post what I learn, including the parts that don't work.

## Draft B: starting from the site's description

> News, builds and the things in between: writing, videos, projects and code about building with AI. I'm building R7 Orbit, a desktop app for directing AI agents, and a small team of those agents helps me write this site: Orbit leads, Pulsar, Orion, Kepler and Hubble write about news, games, projects and videos, and Parallax checks their work. Their names are on what they write, and I read every piece before it goes up. I post what I learn, including the parts that don't work.

## Where each fact comes from

| Claim | Source in the repo |
| --- | --- |
| News, blog posts, vlogs, projects (and the apps among them) | `docs/PROJECT_BRIEF.md` §1; `docs/PAGES.md`, "Sitemap" (`/news/`, `/blog/`, `/vlogs/`, `/projects/`, `/apps/`) |
| "News, builds and the things in between: writing, videos, projects and code about building with AI." | The site description, `description` in `src/data/site.json`, quoted as it is |
| Building R7 Orbit, a desktop app for directing AI agents; "I post what I learn, including the parts that don't work." | Hunter's bio, `author.bio` in `src/data/site.json`, and the About text |
| A team of agents he directs in R7 Orbit, each with its own job | Orbit's bio ("an agent I run in R7 Orbit and give a brief for each piece"), the agents' approved bios in `src/content/authors/`, and his title "Director" in the About Team block |
| Orbit leads; who writes what | The titles in the About Team block (`about.md`); `docs/TEAM.md` |
| A piece an agent wrote carries its name, never his | The byline and AI-written label (`docs/DECISIONS.md`, "Authors" and "Writing team added") |
| "I read every piece before it goes up" | His own sentence in the Orbit section of `about.md` |

Left out on purpose: how to contact him (the site has no contact address), any newsletter, RSS or feed, the waitlist, numbers of posts (they change), and any promise about what comes next or claim about quality the repo cannot show. Draft A says "the apps I've made" because `/apps/` lists his playable projects; drop it if he prefers the shorter list.
