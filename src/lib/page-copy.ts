// The pages that keep a fixed frame around blocks from src/content/pages/: privacy, 404 and search (docs/PAGES.md,
// docs/CONTENT_MODEL.md "Pages"). Their words are blocks of the shared library, edited in /admin; their frame (the eyebrow, the
// search box, the orbit) stays code. This module is what those pages do with the blocks before drawing them:
//
// - Settings tokens. `{site.name}`, `{site.tagline}`, `{site.description}` and
//   `{newsletter.provider}` in any text are replaced with the values of src/data/site.json, so changing the name in the settings changes the privacy page. An unknown `{x.y}` stops the
//   build, so a typo never reaches the page as braces.
// - The newsletter switch, kept only so the Privacy page (whose words are the author's to change) still builds: there is no newsletter
//   (docs/DECISIONS.md), so it is never connected. `{if newsletter connected}` hides a block, `{if newsletter not connected}` shows it, and
//   `{newsletter.provider}` is empty. Remove this with the Privacy page's newsletter paragraphs.
// - Slots. Which blocks sit where in the page's frame: the Lead paragraphs at the top go under the page heading, and so on per
//   page (the functions below say how).
//
// Pure, and used by both the pages (build time) and the admin preview (browser).
import { SECTION_LABELS, type Section } from './sections';

/** The site settings a page's text can print. */
export interface PageSettings {
  siteName: string;
  siteTagline: string;
  siteDescription: string;
  newsletterProvider: string;
  newsletterConnected: boolean;
}

interface SiteLike {
  name: string;
  tagline: string;
  description: string;
}

/** The settings from src/data/site.json (`site` from src/data/site.ts, or the JSON itself in the admin). */
export function pageSettingsOf(site: SiteLike): PageSettings {
  return {
    siteName: site.name,
    siteTagline: site.tagline,
    siteDescription: site.description,
    newsletterProvider: '',
    newsletterConnected: false,
  };
}

const TOKENS: Record<string, (s: PageSettings) => string> = {
  'site.name': (s) => s.siteName,
  'site.tagline': (s) => s.siteTagline,
  'site.description': (s) => s.siteDescription,
  'newsletter.provider': (s) => s.newsletterProvider,
};

/** The tokens a page's text may hold, as written: `{site.name}` and so on. */
export const PAGE_TOKENS = Object.keys(TOKENS).map((name) => `{${name}}`);

const CONDITIONS: Record<string, (s: PageSettings) => boolean> = {
  'if newsletter connected': (s) => s.newsletterConnected,
  'if newsletter not connected': (s) => !s.newsletterConnected,
};

/** The condition lines a block's text may start with. */
export const PAGE_CONDITIONS = Object.keys(CONDITIONS).map((name) => `{${name}}`);

const TOKEN = /\{([a-z]+(?:\.[a-zA-Z]+)+)\}/g;
const CONDITION = /^\s*\{(if [^}]*)\}\s*/;

/** Replaces every settings token in one string. Throws, naming `where`, on a token that does not exist. */
export function fillTokens(text: string, settings: PageSettings, where: string): string {
  return text.replace(TOKEN, (_, name: string) => {
    const value = TOKENS[name];
    if (!value)
      throw new Error(
        `${where}: there is no setting {${name}}. The settings a page can print are ${PAGE_TOKENS.join(', ')}.`,
      );
    return value(settings);
  });
}

/** Replaces every settings token in every string of a value (an entry's data, a block, a list of blocks). Throws like fillTokens. */
export const fillValue = (value: unknown, settings: PageSettings, where: string): unknown => {
  if (typeof value === 'string') return fillTokens(value, settings, where);
  if (Array.isArray(value)) return value.map((v) => fillValue(v, settings, where));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillValue(v, settings, where)]));
  }
  return value;
};

/** Whether a block is shown under the settings, and its text without the condition line. Throws on an unknown condition. */
function applyCondition(block: Section, settings: PageSettings, where: string): Section | undefined {
  const text = (block as { text?: unknown }).text;
  if (typeof text !== 'string') return block;
  const match = CONDITION.exec(text);
  if (!match) return block;
  const test = CONDITIONS[match[1].trim()];
  if (!test)
    throw new Error(
      `${where}: the line {${match[1]}} is not a condition this site knows. Use ${PAGE_CONDITIONS.join(' or ')}.`,
    );
  return test(settings) ? ({ ...block, text: text.slice(match[0].length) } as Section) : undefined;
}

interface PageData {
  title: string;
  seoTitle?: string;
  description: string;
  sections: Section[];
}

/**
 * A page's data as the reader sees it: tokens filled in the title, description and every block, and the blocks whose condition
 * is false left out. `source` is the file name, for errors ("privacy.md").
 */
export function fillPage<T extends PageData>(data: T, settings: PageSettings, source: string): T {
  const sections: Section[] = [];
  data.sections.forEach((block, i) => {
    const where = `${source}, block ${i + 1} (${SECTION_LABELS[block.type] ?? block.type})`;
    const shown = applyCondition(block, settings, where);
    if (shown) sections.push(fillValue(shown, settings, where) as Section);
  });
  return {
    ...data,
    title: fillTokens(data.title, settings, `${source}, page heading`),
    ...(data.seoTitle !== undefined
      ? { seoTitle: fillTokens(data.seoTitle, settings, `${source}, browser title`) }
      : {}),
    description: fillTokens(data.description, settings, `${source}, description`),
    sections,
  };
}

// ---- Slots ---------------------------------------------------------------------------------------------------------------

/** The Lead paragraphs at the very top (they sit under the page heading), and the blocks after them. */
export function splitLead(sections: readonly Section[]): { lead: Section[]; rest: Section[] } {
  const first = sections.findIndex((s) => s.type !== 'lead');
  const at = first === -1 ? sections.length : first;
  return { lead: sections.slice(0, at), rest: sections.slice(at) };
}

/** /privacy/: the Lead under the heading; the rest is the policy, one reading column; a Text block at the very end is the small print ("Last updated"). */
export function privacySlots(sections: readonly Section[]) {
  const { lead, rest } = splitLead(sections);
  const last = rest.at(-1);
  return last?.type === 'text' ? { lead, body: rest.slice(0, -1), after: [last] } : { lead, body: rest, after: [] };
}

/** /404.html: the Lead under the heading; any other block follows it, above the search box. */
export function lostSlots(sections: readonly Section[]) {
  const { lead, rest } = splitLead(sections);
  return { lead, body: rest };
}
