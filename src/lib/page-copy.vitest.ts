import { readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import site from '../data/site.json';
import {
  fillPage,
  fillTokens,
  pageSettingsOf,
  privacySlots,
  lostSlots,
  ascentSlots,
  type PageSettings,
} from './page-copy';
import { sectionsSchema, type Section } from './sections';

const settings: PageSettings = {
  siteName: 'Site',
  siteTagline: 'A tagline',
  siteDescription: 'A description.',
  newsletterProvider: 'a provider',
  newsletterConnected: false,
  waitlistOn: false,
};
const connected = { ...settings, newsletterConnected: true };

const page = (sections: unknown[]) => ({ title: 'T', description: 'D', sections: sections as Section[] });
const text = (t: string) => ({ type: 'text', text: t }) as Section;
const types = (blocks: Section[]) => blocks.map((b) => b.type);

/** A page file as the site reads it: front matter through the real schema. */
const read = (name: string) => {
  const { frontmatter } = parseFrontmatter(readFileSync(`src/content/pages/${name}.md`, 'utf8'));
  return {
    ...(frontmatter as { title: string; seoTitle?: string; description: string }),
    sections: sectionsSchema.parse(frontmatter.sections),
  };
};
const textsOf = (data: { sections: Section[] }) => data.sections.map((s) => (s as { text?: string }).text ?? '');

describe('settings tokens', () => {
  it('reads the settings from site.json; the newsletter is never connected (there is none)', () => {
    expect(pageSettingsOf(site)).toMatchObject({
      siteName: site.name,
      newsletterProvider: '',
      newsletterConnected: false,
    });
  });

  it('fills every token, as often as it appears', () => {
    expect(
      fillTokens(
        '{site.name}: {site.tagline} ({site.description}) via {newsletter.provider}, {site.name} again',
        settings,
        'x',
      ),
    ).toBe('Site: A tagline (A description.) via a provider, Site again');
  });

  it('stops on a token that does not exist, naming the place and the tokens there are', () => {
    expect(() => fillTokens('Write to {author.mail}', settings, 'privacy.md, block 3 (Text)')).toThrow(
      /privacy\.md, block 3 \(Text\): there is no setting \{author\.mail\}\. .*\{site\.name\}/,
    );
    // There is no email and no feed to print.
    for (const gone of ['{author.email}', '{links.rss}'])
      expect(() => fillTokens(gone, settings, 'x')).toThrow(/there is no setting/);
  });

  it('leaves braces that are not a token alone', () => {
    expect(fillTokens('a {b} and {} and { site.name }', settings, 'x')).toBe('a {b} and {} and { site.name }');
  });

  it('fills the title, browser title, description and every field of every block, nested ones included', () => {
    const out = fillPage(
      {
        title: '{site.name}',
        seoTitle: 'At {site.name}',
        description: 'About {site.name}',
        sections: [{ type: 'links', items: [{ label: '{site.tagline}', url: '/x/' }] } as Section],
      },
      settings,
      'x.md',
    );
    expect(out).toMatchObject({
      title: 'Site',
      seoTitle: 'At Site',
      description: 'About Site',
      sections: [{ items: [{ label: 'A tagline' }] }],
    });
  });
});

describe('the newsletter condition', () => {
  const blocks = [
    text('{if newsletter connected}\nOn.'),
    text('{if newsletter not connected}\n\nOff.'),
    text('Always.'),
  ];

  it('keeps the block whose condition holds, without the condition line, and drops the other', () => {
    expect(textsOf(fillPage(page(blocks), settings, 'x.md'))).toEqual(['Off.', 'Always.']);
    expect(textsOf(fillPage(page(blocks), connected, 'x.md'))).toEqual(['On.', 'Always.']);
  });

  it('also reads a condition the editor joined onto the first line', () => {
    expect(textsOf(fillPage(page([text('{if newsletter connected} On.')]), connected, 'x.md'))).toEqual(['On.']);
  });

  it('stops on a condition it does not know', () => {
    expect(() => fillPage(page([text('{if it rains}\nWet.')]), settings, 'privacy.md')).toThrow(
      /privacy\.md, block 1 \(Text\): the line \{if it rains\} is not a condition/,
    );
  });
});

describe('slots', () => {
  const lead = { type: 'lead', text: 'L' } as Section;
  const heading = { type: 'heading', text: 'H', level: 2 } as Section;
  it('privacy: a Text block at the very end is the small print; anything else ends the body', () => {
    expect(types(privacySlots([lead, heading, text('a'), text('b')]).after)).toEqual(['text']);
    expect(privacySlots([lead, text('a'), heading]).after).toEqual([]);
  });

  it('404: the lead under the heading, the rest after it', () => {
    expect(lostSlots([lead, text('a')])).toEqual({ lead: [lead], body: [text('a')] });
  });
});

// The page files hold the wording that was in the .astro pages before they became editable. The rendered text is compared with
// fixtures in tests/pages.spec.js; the privacy page's "connected" paragraphs never show (there is no newsletter), so they
// are only checked here to stay hidden.
describe('the page files', () => {
  it('privacy, not connected: the other paragraphs, with no feed link and no contact address', () => {
    const texts = textsOf(
      fillPage(read('privacy'), { ...pageSettingsOf(site), newsletterConnected: false }, 'privacy.md'),
    );
    expect(texts).toContain(
      "The newsletter isn't connected yet. The sign-up form on this site does not send your address anywhere, and nothing is stored. When it is connected, this page will name the service that holds the list.",
    );
    expect(texts.join('\n')).not.toContain('If you subscribe');
    const file = readFileSync('src/content/pages/privacy.md', 'utf8');
    expect(file).not.toMatch(/mailto|@|rss/i);
  });

  it('every page file reads through the schema and fills without an unknown token', () => {
    for (const name of ['privacy', '404', 'search', 'ascent']) {
      expect(() => fillPage(read(name), pageSettingsOf(site), `${name}.md`), name).not.toThrow();
    }
  });
});

describe('the waitlist condition', () => {
  const blocks = [text('{if waitlist on}\nOn.'), text('{if waitlist off}\nOff.'), text('Always.')];

  it('shows a block only while the live site shows the waitlist, or only while it does not', () => {
    expect(textsOf(fillPage(page(blocks), settings, 'x.md'))).toEqual(['Off.', 'Always.']);
    expect(textsOf(fillPage(page(blocks), { ...settings, waitlistOn: true }, 'x.md'))).toEqual(['On.', 'Always.']);
  });

  it('reads "on" from the settings: switched on AND with a site key', () => {
    const waitlist = (enabled: boolean, turnstileSiteKey: string) =>
      pageSettingsOf({ ...site, waitlist: { enabled, turnstileSiteKey } }).waitlistOn;
    expect(pageSettingsOf(site).waitlistOn).toBe(site.waitlist.enabled && site.waitlist.turnstileSiteKey !== '');
    expect(waitlist(true, '0x4AAAAAAABkMYinukE8nzY')).toBe(true);
    expect(waitlist(true, '')).toBe(false);
    expect(waitlist(false, '0x4AAAAAAABkMYinukE8nzY')).toBe(false);
  });
});

describe('the game page (ascent)', () => {
  const lead = (t: string) => ({ type: 'lead', text: t }) as Section;
  it('puts the Lead above the game, the rest below it, and the last Text block as the credits', () => {
    const credits = text(['Directed by *someone*.', 'Made with [three.js](https://threejs.org/).'].join('\n'));
    const slots = ascentSlots([lead('Climb.'), text('How to play.'), credits]);
    expect(textsOf({ sections: slots.lead } as never)).toEqual(['Climb.']);
    expect(slots.body).toHaveLength(1);
    expect(slots.creditLines).toEqual(['Directed by someone.', 'Made with three.js.']);
    expect(ascentSlots([lead('Climb.')]).creditLines).toEqual([]);
  });

  it('prints the author name from the settings', () => {
    const filled = fillPage(
      page([text('Directed by {author.name}.')]),
      { ...settings, authorName: 'A. Author' },
      'x.md',
    );
    expect(textsOf(filled)).toEqual(['Directed by A. Author.']);
  });
});
