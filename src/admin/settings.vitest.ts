import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import site from '../data/site.json';
import { siteSchema } from '../lib/site-settings';
import { buildConfig, CMS_AUTH_URL, CMS_REPO } from './config';
import { SETTINGS_FILE, settingsCollection, settingsCollections } from './settings';

// The Site settings collection against the schema the build reads the file with (src/lib/site-settings.ts): the same fields under the
// same names, the same rules, and nothing the author should not edit from a browser.

type Field = Record<string, unknown> & {
  name: string;
  fields?: Field[];
  pattern?: [string, string];
  required?: boolean;
};

const file = (settingsCollection as unknown as { files: Field[] }).files[0];
const fields = file.fields as Field[];
const named = (list: Field[], name: string) => list.find((f) => f.name === name) as Field;

/** Every field path in the form, e.g. author.name, nav.label. */
const paths = (list: Field[], prefix = ''): string[] =>
  list.flatMap((f) => [`${prefix}${f.name}`, ...(f.fields ? paths(f.fields, `${prefix}${f.name}.`) : [])]);

/** Every key path in the settings file (list items read through their first item). */
const keys = (value: unknown, prefix = ''): string[] => {
  if (Array.isArray(value)) return value.length ? [...new Set(value.flatMap((v) => keys(v, prefix)))] : [];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [`${prefix}${k}`, ...keys(v, `${prefix}${k}.`)]);
  }
  return [];
};

describe('the Site settings collection', () => {
  it('edits src/data/site.json, the file every page reads, as JSON, and cannot delete it', () => {
    expect(settingsCollection).toMatchObject({ name: 'settings', label: 'Site settings', delete: false });
    expect(file).toMatchObject({ name: 'site', file: SETTINGS_FILE, format: 'json' });
    expect(SETTINGS_FILE).toBe('src/data/site.json');
    expect(readFileSync('src/data/site.ts', 'utf8')).toContain("from './site.json'");
  });

  it('comes after the posts, the authors and the pages', () => {
    const { collections } = buildConfig({ repo: 'o/n', branch: 'main', local: true });
    expect(collections.map((c) => c.name).slice(-2)).toEqual(['pages', 'settings']);
    expect(settingsCollections).toEqual([settingsCollection]);
  });

  it('has a field for every setting in the file, except the address of the site', () => {
    const inFile = keys(site).filter(
      (k) => !['nav.footer', 'nav.icon', 'footer.links.href', 'footer.links.social'].includes(k),
    );
    const inForm = paths(fields);
    expect(inFile.filter((k) => !inForm.includes(k)).sort()).toEqual(['url']);
    // And no field the schema does not know (it is strict, so it would fail the build).
    const known = new Set([...keys(site), 'nav.footer', 'nav.icon', 'footer.links.href', 'footer.links.social']);
    expect(inForm.filter((p) => !known.has(p))).toEqual([]);
  });

  it('holds nothing about where the editor commits or signs in, and no secret', () => {
    const text = JSON.stringify(settingsCollection);
    for (const secret of [CMS_REPO, CMS_AUTH_URL, 'token', 'secret', 'CF_DEPLOY_HOOK'])
      expect(text).not.toContain(secret);
    expect(paths(fields)).not.toContain('url');
    expect(paths(fields).filter((p) => p.startsWith('newsletter'))).toEqual([]);
  });

  it('marks optional exactly what the schema lets be empty', () => {
    const optional = (list: Field[], prefix = ''): string[] =>
      list.flatMap((f) => [
        ...(f.required === false ? [`${prefix}${f.name}`] : []),
        ...(f.fields ? optional(f.fields, `${prefix}${f.name}.`) : []),
      ]);
    expect(optional(fields).sort()).toEqual(
      [
        'links.github',
        'links.youtube',
        'nav.footer',
        'nav.icon',
        'footer.links.href',
        'footer.links.social',
        'footer.note',
      ].sort(),
    );
  });

  it('checks addresses in the form the way the build does', () => {
    const test = (field: Field, value: string) => new RegExp(field.pattern![0]).test(value);
    const accepts = (change: (s: typeof site) => void) => {
      const copy = structuredClone(site);
      change(copy);
      return siteSchema.safeParse(copy).success;
    };
    const social = named(named(fields, 'links').fields!, 'github');
    for (const value of ['https://github.com/a', 'http://github.com/a', 'github.com/a', 'javascript:alert(1)', 'https://']) {
      expect(test(social, value), value).toBe(accepts((s) => (s.links.github = value)));
    }
    const href = named(named(fields, 'nav').fields!, 'href');
    for (const value of [
      '/notes/',
      '/#top',
      'https://example.org/',
      'blog/',
      '//evil.example/',
      'http://example.org/',
      'mailto:a@b.co',
    ]) {
      expect(test(href, value), value).toBe(accepts((s) => (s.nav[0].href = value)));
    }
  });

  it('has no email field and offers only GitHub and YouTube as profile links', () => {
    expect(paths(fields).some((p) => /email|mail/i.test(p))).toBe(false);
    expect(named(named(fields, 'links').fields!, 'github')).toBeTruthy();
    expect(named(fields, 'links').fields!.map((f) => f.name)).toEqual(['github', 'youtube']);
    const social = named(named(named(fields, 'footer').fields!, 'links').fields!, 'social');
    expect((social.options as { value: string }[]).map((o) => o.value)).toEqual(['github', 'youtube']);
  });
});
