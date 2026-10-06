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
  type PageSettings,
} from './page-copy';
import { sectionsSchema, type Section } from './sections';

const settings: PageSettings = {
  siteName: 'Site',
  siteTagline: 'A tagline',
  siteDescription: 'A description.',
  authorEmail: 'me@site.test',
  rss: '/rss.xml',
  newsletterProvider: 'a provider',
  newsletterConnected: false,
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
      authorEmail: site.author.email,
      rss: site.links.rss,
      newsletterProvider: '',
      newsletterConnected: false,
    });
  });

  it('fills every token, as often as it appears', () => {
    expect(
      fillTokens(
        '[{author.email}](mailto:{author.email}) on {site.name} via {newsletter.provider} at {links.rss}',
        settings,
        'x',
      ),
    ).toBe('[me@site.test](mailto:me@site.test) on Site via a provider at /rss.xml');
  });

  it('stops on a token that does not exist, naming the place and the tokens there are', () => {
    expect(() => fillTokens('Write to {author.mail}', settings, 'privacy.md, block 3 (Text)')).toThrow(
      /privacy\.md, block 3 \(Text\): there is no setting \{author\.mail\}\. .*\{author\.email\}/,
    );
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
        sections: [{ type: 'links', items: [{ label: '{author.email}', url: '/x/' }] } as Section],
      },
      settings,
      'x.md',
    );
    expect(out).toMatchObject({
      title: 'Site',
      seoTitle: 'At Site',
      description: 'About Site',
      sections: [{ items: [{ label: 'me@site.test' }] }],
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
  it('privacy, not connected: the other paragraphs, with the RSS address from the settings', () => {
    const texts = textsOf(
      fillPage(read('privacy'), { ...pageSettingsOf(site), newsletterConnected: false }, 'privacy.md'),
    );
    expect(texts).toContain(
      `The newsletter isn't connected yet. The sign-up form on this site does not send your address anywhere, and nothing is stored. When it is connected, this page will name the service that holds the list.\n\nUntil then, you can follow by [RSS](${site.links.rss}), which needs no address at all.`,
    );
    expect(texts.join('\n')).not.toContain('If you subscribe');
  });

  it('privacy prints the contact email from the settings and never holds it as text', () => {
    const file = readFileSync('src/content/pages/privacy.md', 'utf8');
    expect(file).toContain('[{author.email}](mailto:{author.email})');
    expect(file).not.toContain(site.author.email);
    const texts = textsOf(
      fillPage(read('privacy'), { ...pageSettingsOf(site), authorEmail: 'new@site.test' }, 'privacy.md'),
    );
    expect(texts).toContain('Questions, or a request to remove your address: [new@site.test](mailto:new@site.test).');
  });

  it('every page file reads through the schema and fills without an unknown token', () => {
    for (const name of ['privacy', '404', 'search']) {
      expect(() => fillPage(read(name), pageSettingsOf(site), `${name}.md`), name).not.toThrow();
    }
  });
});
