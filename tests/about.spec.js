import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import site from '../src/data/site.json' with { type: 'json' };
import { aboutTextLines } from './about-text.js';
import { aboutTitle } from './about-title.js';
import { headingBefore } from '../src/lib/sections-to-content.ts';
import { contentTextProblems, inputsDigest, pageCopy, readTextFixture, staleNote, textFixture } from './fixture-inputs.js';

// The About page is built from src/content/pages/about.md (edited in /admin). Its wording must not change by accident:
// tests/fixtures/about-text.txt is the text of the page, line for line, with the digest of the files it came from on its first
// line (tests/fixture-inputs.js). If the author has edited them since, the page is checked against them instead and the test says
// the fixture is out of date. Changed the page on purpose? Rebuild, refresh the fixture and read its diff:
//   npm run build && UPDATE_PAGE_TEXT=1 npx playwright test about
const fixtureUrl = new URL('./fixtures/about-text.txt', import.meta.url);
const INPUTS = ['src/data/site.json', 'src/content/pages/about.md', 'src/content/authors/'];

test('the rendered /about/ text is exactly the fixture: title, description, headings, paragraphs, bold lead-ins, alt text', async ({
  page,
}) => {
  await page.goto('/about/');
  const lines = await aboutTextLines(page);
  const inputs = inputsDigest(INPUTS);
  if (process.env.UPDATE_PAGE_TEXT) return writeFileSync(fixtureUrl, textFixture(inputs, lines));
  const fixture = readTextFixture(fixtureUrl);
  if (fixture.inputs === inputs) expect(lines).toEqual(fixture.lines);
  else {
    test.info().annotations.push({
      type: 'note',
      description: staleNote('tests/fixtures/about-text.txt', 'UPDATE_PAGE_TEXT=1 npx playwright test about'),
    });
    expect(contentTextProblems(lines, 'about'), 'the words its file holds').toEqual([]);
  }
});

test('the Person structured data still comes from site.json, and the page head is unchanged', async ({ page }) => {
  await page.goto('/about/');
  const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent())['@graph'];
  const person = graph.find((n) => n['@type'] === 'Person');
  expect(person.name).toBe(site.author.name);
  expect(person.description).toBe(site.author.bio);
  const profile = graph.find((n) => n['@type'] === 'ProfilePage');
  expect(profile.name).toBe(`${aboutTitle} · ${site.name}`);
  const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList').itemListElement.map((i) => i.name);
  expect(crumbs).toEqual(['Home', aboutTitle]);
  await expect(page.locator('nav [aria-current="page"]').first()).toContainText('About');
});

const portraitCount = () => (pageCopy('about').sections ?? []).filter((b) => b.type === 'portrait').length;

test('each portrait sits beside its text on a wide screen and above it on a phone', async ({ page }) => {
  test.skip(!portraitCount(), 'about.md has no Portrait block');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/about/');
  const rows = page.locator('.about-grid');
  await expect(rows).toHaveCount(portraitCount());
  for (const row of await rows.all()) {
    const portrait = (await row.locator('.portrait').boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
    const prose = (await row.locator('.prose').boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
    expect(portrait.x + portrait.width, 'portrait is left of the text').toBeLessThanOrEqual(prose.x);
    expect(Math.abs(portrait.y - prose.y), 'the two start level').toBeLessThanOrEqual(1);
  }
  // A heading in a row (the Heading block above a portrait, or one inside its text) is in the text column beside it, not above the row.
  for (const row of await rows.all()) {
    const prose = (await row.locator('.prose').boundingBox()) ?? { x: 0 };
    for (const h of await row.locator('h2, h3').all()) expect(((await h.boundingBox()) ?? { x: 0 }).x).toBeGreaterThanOrEqual(prose.x);
  }

  await page.setViewportSize({ width: 375, height: 800 });
  for (const row of await rows.all()) {
    const small = (await row.locator('.portrait').boundingBox()) ?? { y: 0, height: 0 };
    const smallProse = (await row.locator('.prose').boundingBox()) ?? { y: 0 };
    expect(small.y + small.height, 'portrait is above the text').toBeLessThanOrEqual(smallProse.y);
  }
});

// The Team block ("Meet the team"): the members, titles and order come from about.md, the names and bios from the author files
// (a person's from site.json), so the test follows the author's edits in /admin.
const authorFile = (slug) => JSON.parse(readFileSync(new URL(`../src/content/authors/${slug}.json`, import.meta.url), 'utf8'));
const teamBlock = () => (pageCopy('about').sections ?? []).find((b) => b.type === 'team');

test('the team cards follow about.md: name, title, subtitle, bio, avatar and a link to each author page', async ({ page }) => {
  const block = teamBlock();
  test.skip(!block, 'about.md has no Team block');
  await page.goto('/about/');
  const cards = page.locator('[data-team] > li');
  await expect(cards).toHaveCount(block.members.length);
  // Names are h3 under a section heading, h2 when the Team block has none above it (the page never skips a level).
  const sections = pageCopy('about').sections;
  const level = headingBefore(sections, sections.findIndex((b) => b.type === 'team')) ? 3 : 2;
  for (const [i, member] of block.members.entries()) {
    const file = authorFile(member.author);
    const person = file.kind === 'person';
    const card = cards.nth(i);
    await expect(card).toHaveAttribute('data-team-member', member.author);
    const name = file.name ?? site.author.name;
    await expect(card.getByRole('heading', { level })).toHaveText(name);
    await expect(card.getByRole('link', { name })).toHaveAttribute('href', `/authors/${member.author}/`);
    await expect(card.locator('.team-role')).toContainText(member.title);
    if (file.subtitle) await expect(card.locator('.team-role .author-sub')).toHaveText(file.subtitle);
    await expect(card.locator('.team-bio')).toHaveText(member.blurb || file.bio || site.author.bio);
    await expect(card.locator('.avatar img')).toHaveAttribute('src', file.avatar ?? site.author.photo);
    // An agent is labelled "AI agent", never "AI-written" (this is not a post); a person has no label.
    await expect(card.locator('.chip.ai-agent')).toHaveCount(person ? 0 : 1);
  }
  await expect(page.locator('main .chip.ai-written')).toHaveCount(0);
});

// The agreed order and Hunter's title, checked word for word only while the About files are the ones the fixture was made from
// (the same rule as the text fixture above): after the author edits them in /admin, the test above follows the file instead.
// The page leads with Hunter (a Portrait block: his photo, name and bio), then "The agents" (docs/DECISIONS.md, "Design audit, brand").
test('About leads with Hunter Newton, then the agents: R7, Pulsar, Orion, Kepler, Hubble, Pictor and Parallax', async ({ page }) => {
  await page.goto('/about/');
  if (inputsDigest(INPUTS) !== readTextFixture(fixtureUrl).inputs) {
    test.info().annotations.push({ type: 'note', description: staleNote('tests/fixtures/about-text.txt', 'UPDATE_PAGE_TEXT=1 npx playwright test about') });
    return;
  }
  const lead = page.locator('main .portrait-row, main .sec-row').first();
  await expect(lead.getByRole('heading', { level: 2, name: site.author.name })).toBeVisible();
  await expect(lead.locator('img')).toHaveAttribute('src', /hunter-newton/);
  await expect(page.getByRole('heading', { level: 2, name: 'The agents' })).toBeVisible();
  const slugs = await page.locator('[data-team] > li').evaluateAll((els) => els.map((e) => e.dataset.teamMember));
  expect(slugs).toEqual(['r7', 'pulsar', 'orion', 'kepler', 'hubble', 'pictor', 'parallax']);
});

for (const width of [320, 375, 1280]) {
  test(`/about/ has no axe violations at ${width}px, the team included`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/about/');
    await page.locator('[data-team]').scrollIntoViewIfNeeded();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
}

test('the team is one column on a phone and two or three on a wide screen, under its heading, and every name is a link in tab order', async ({ page }) => {
  test.skip(!teamBlock(), 'about.md has no Team block');
  const columns = () =>
    page.locator('[data-team] > li').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/about/');
  expect(await columns()).toBe(1);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await columns()).toBeGreaterThanOrEqual(2);
  expect(await columns()).toBeLessThanOrEqual(3);
  // The heading above the block is a row of its own above the cards, not beside the R7 picture.
  const grid = await page.locator('[data-team]').boundingBox();
  // (when the page has one: the author may leave the page title above the cards to do that job)
  // (not the card names: with no heading above it the Team block draws them as h2)
  const headings = page.locator('.sections h2:not(.team-name)');
  if (await headings.count()) {
    const heading = await headings.last().boundingBox();
    expect(heading.y + heading.height).toBeLessThanOrEqual(grid.y);
    expect(Math.abs(heading.x - grid.x)).toBeLessThanOrEqual(1);
  }
  const links = page.locator('[data-team] .team-name a');
  await links.first().focus();
  await expect(links.first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(links.nth(1)).toBeFocused();
});

// Same as post titles: one *phrase* in a heading is italic brass (CSS: h1 em, h2 em, h3 em); **bold** is plain bold.
test('a *phrase* in a Heading block is set in the brass accent, like the page title, and ** stays bold', async ({ page }) => {
  await page.goto('/styleguide/sections/');
  const brass = await page.locator('h1 em').evaluate((el) => getComputedStyle(el).color);
  const heading = page.getByRole('heading', { level: 2 }).first();
  await expect(heading).toHaveText('A row of text');
  const em = heading.locator('em');
  await expect(em).toHaveText('text');
  expect(await em.evaluate((el) => getComputedStyle(el))).toMatchObject({ fontStyle: 'italic', color: brass });
  const strong = page.locator('.sections strong').first();
  expect(await strong.evaluate((el) => getComputedStyle(el).color)).not.toBe(brass);
  expect(await page.locator('.sections h2, .sections h3').allInnerTexts()).not.toContainEqual(expect.stringContaining('*'));
});

for (const width of [320, 375, 1280]) {
  test(`no horizontal scroll and no layout shift at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/about/', { waitUntil: 'networkidle' });
    const sizes = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: document.documentElement.clientWidth,
      cls: window.__cls,
    }));
    expect(sizes.doc).toBeLessThanOrEqual(sizes.view);
    // The project's own tolerance for a sub-pixel font swap (docs/DECISIONS.md, Lighthouse CLS); a real shift is far above it.
    expect(sizes.cls).toBeLessThan(0.005);
  });
}
