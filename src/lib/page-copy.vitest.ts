import { readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import site from '../data/site.json';
import {
  fillPage,
  fillTokens,
  pageSettingsOf,
  privacySlots,
  subscribeSlots,
  lostSlots,
  type PageSettings,
} from './page-copy';
import { sectionsSchema, type Section } from './sections';

const settings: PageSettings = {
  siteName: 'Site',
  authorEmail: 'me@site.test',
  rss: '/rss.xml',
  newsletterProvider: 'buttondown',
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
  it('reads the settings from site.json: connected means formAction is set', () => {
    expect(pageSettingsOf(site)).toMatchObject({
      siteName: site.name,
      authorEmail: site.author.email,
      rss: site.links.rss,
    });
    expect(
      pageSettingsOf({ ...site, newsletter: { provider: 'x', formAction: 'https://x.test/' } }).newsletterConnected,
    ).toBe(true);
    expect(pageSettingsOf({ ...site, newsletter: { provider: 'x', formAction: '' } }).newsletterConnected).toBe(false);
  });

  it('fills every token, as often as it appears', () => {
    expect(
      fillTokens(
        '[{author.email}](mailto:{author.email}) on {site.name} via {newsletter.provider} at {links.rss}',
        settings,
        'x',
      ),
    ).toBe('[me@site.test](mailto:me@site.test) on Site via buttondown at /rss.xml');
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
  const newsletter = { type: 'newsletter', style: 'form' } as Section;

  it('subscribe: lead under the heading, blocks up to the newsletter block beside the form, the rest after', () => {
    const s = subscribeSlots([lead, heading, text('a'), newsletter, text('b')]);
    expect([types(s.lead), types(s.beside), types(s.after)]).toEqual([['lead'], ['heading', 'text'], ['text']]);
    expect(subscribeSlots([heading, text('a')])).toEqual({ lead: [], beside: [heading, text('a')], after: [] });
  });

  it('privacy: a Text block at the very end is the small print; anything else ends the body', () => {
    expect(types(privacySlots([lead, heading, text('a'), text('b')]).after)).toEqual(['text']);
    expect(privacySlots([lead, text('a'), heading]).after).toEqual([]);
  });

  it('404: the lead under the heading, the rest after it', () => {
    expect(lostSlots([lead, text('a')])).toEqual({ lead: [lead], body: [text('a')] });
  });
});

// The page files hold the wording that was in the .astro pages before they became editable. The rendered text is compared with
// fixtures in tests/pages.spec.js; the privacy page's "connected" paragraphs only show once the newsletter is connected, so they
// are compared here, word for word with the old src/pages/privacy.astro.
describe('the page files', () => {
  it('privacy, newsletter connected: the paragraphs of the old page, with the provider from the settings', () => {
    const data = fillPage(read('privacy'), { ...pageSettingsOf(site), newsletterConnected: true }, 'privacy.md');
    const texts = textsOf(data);
    expect(texts).toContain(
      `If you subscribe, your email address is sent to **${site.newsletter.provider}**, the service that stores the list and sends the emails. I use it to tell you when something new is published, and for nothing else. That is the only time the form contacts anyone: the request is made when you press Subscribe, not when the page loads.\n\nEvery email has an unsubscribe link. Using it removes you from the list. You can also write to me and I'll remove you by hand.`,
    );
    expect(texts.join('\n')).not.toContain("The newsletter isn't connected yet");
  });

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
    for (const name of ['subscribe', 'privacy', '404', 'search']) {
      expect(() => fillPage(read(name), pageSettingsOf(site), `${name}.md`), name).not.toThrow();
    }
  });
});
