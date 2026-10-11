import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { definitions, GROUPS, SECTION_LABELS, SECTION_TYPES, sectionSchema, sectionsSchema } from './index';
import { sectionsHtml } from '../../admin/sections-html';

// The library hangs together: one definition per block, and everything that is generated from it or must accompany it is there.

const pascal = (id: string) => id.replace(/(^|-)([a-z])/g, (_m, _d, c: string) => c.toUpperCase());
const EMPTY = '<div class="sections"></div>';

describe('the block library', () => {
  it('has the blocks the About page already used, under the same names', () => {
    for (const id of ['heading', 'text', 'image', 'portrait', 'quote', 'callout', 'links', 'button', 'divider']) {
      expect(SECTION_TYPES, id).toContain(id);
    }
  });

  it('covers every component the site draws as a block', () => {
    expect([...SECTION_TYPES].sort()).toEqual(
      [
        'heading', 'lead', 'text', 'image', 'image-row', 'gallery', 'portrait', 'columns', 'callout', 'quote', 'pullquote', 'code', 'video',
        'game', 'toc', 'divider', 'button', 'links', 'stats', 'latest', 'author', 'spacer', 'feed', 'pinned', 'apps', 'waitlist',
      ].sort(),
    );
  });

  it('defines each block once: unique ids that match the schema `type`, a label, a group, a summary and an example', () => {
    expect(new Set(SECTION_TYPES).size).toBe(SECTION_TYPES.length);
    for (const d of definitions) {
      expect(d.schema.shape.type.value, d.id).toBe(d.id);
      expect(d.id, 'ids are lowercase words joined with hyphens').toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(d.label, d.id).toMatch(/\S/);
      expect(GROUPS, d.id).toContain(d.group);
      expect(d.summary, d.id).toMatch(/\S/);
      expect(d.description, d.id).toMatch(/\S/);
      expect(SECTION_LABELS[d.id]).toBe(d.label);
    }
  });

  it('lists blocks grouped, in the order of GROUPS', () => {
    const order = definitions.map((d) => GROUPS.indexOf(d.group));
    expect(order, 'the menu is grouped').toEqual([...order].sort((a, b) => a - b));
  });

  it('makes the union from the definitions: one member per block, in order', () => {
    const ids = sectionSchema.options.map((o) => (o as unknown as { shape: { type: { value: string } } }).shape.type.value);
    expect(ids).toEqual([...SECTION_TYPES]);
  });

  it('accepts a complete example of every block (the fixture page, the docs and the editor test draw from them)', () => {
    for (const d of definitions) {
      const result = sectionSchema.safeParse({ type: d.id, ...d.example });
      expect(result.success ? '' : JSON.stringify(result.error.issues), d.id).toBe('');
    }
    expect(sectionsSchema.safeParse(definitions.map((d) => ({ type: d.id, ...d.example }))).success).toBe(true);
  });

  it('has a component for every block, named <Id>Block.astro and listed in the registry, and no other', () => {
    const registry = readFileSync('src/components/sections/registry.ts', 'utf8');
    const keys = [...registry.matchAll(/^\s+'?([a-z-]+)'?: [A-Za-z]+Block,$/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual([...SECTION_TYPES].sort());
    for (const id of SECTION_TYPES) {
      const file = `src/components/sections/${pascal(id)}Block.astro`;
      expect(existsSync(file), file).toBe(true);
      expect(registry, id).toContain(`import ${pascal(id)}Block from './${pascal(id)}Block.astro';`);
    }
  });

  it('has a preview for every block: each example draws something, with no leftovers of a template', () => {
    const resolve = (p: string) => p;
    for (const d of definitions) {
      const html = sectionsHtml([{ type: d.id, ...d.example }], resolve);
      expect(html.length, d.id).toBeGreaterThan(EMPTY.length);
      expect(html, d.id).not.toMatch(/undefined|\[object|NaN/);
    }
  });

  it('has a preview that survives a block the author has just added and not filled in', () => {
    const resolve = (p: string) => p;
    for (const d of definitions) expect(() => sectionsHtml([{ type: d.id }], resolve), d.id).not.toThrow();
    expect(sectionsHtml([{ type: 'no-such-block' }, null, 'x', { text: 'no type' }], resolve)).toBe(EMPTY);
    expect(sectionsHtml(undefined, resolve)).toBe(EMPTY);
  });

  it('states what a preview approximates, for the blocks that need the built site', () => {
    for (const id of ['latest', 'feed', 'pinned', 'apps', 'stats', 'game', 'video', 'code', 'gallery', 'toc', 'waitlist']) {
      expect(definitions.find((d) => d.id === id)?.previewNote, id).toMatch(/\S/);
    }
  });
});
