import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';
import { alwaysHasValue, describeShape, valuesWhere } from './describe';
import { choice, choices, count, flag, image, link, list, numberChoice, pattern, pictureAlt, text } from './fields';

// describeShape leans on Zod 4's internals (`.def`, `.meta()`). These pin what it reads, so an upgrade that moves them fails here, in
// words, and not as a form that quietly lost a field.

const shape = {
  type: z.literal('x'),
  title: text({ label: 'Title', max: 40, hint: 'A hint.' }),
  note: text({ label: 'Note', optional: true }),
  body: text({ label: 'Body', widget: 'markdown' }),
  lead: text({ label: 'Lead', widget: 'text', format: 'inline' }),
  url: link('Address', 'Where to.'),
  maybe: link('Maybe', 'Where, or nowhere.', true),
  pic: image('Picture', 'Yours.'),
  ...pictureAlt('it'),
  on: flag('On', 'Turn on.'),
  kind: choice(['a', 'b'], { a: 'Alpha', b: 'Beta' }, { label: 'Kind' }),
  size: numberChoice([2, 3], { 2: 'Two', 3: 'Three' }, { label: 'Size', fallback: 3 }),
  n: count({ label: 'How many', min: 1, max: 9, fallback: 4 }),
  many: choices(['p', 'q'], { p: 'Pee', q: 'Queue' }, { label: 'Many' }),
  rows: list({ k: text({ label: 'Key' }), v: text({ label: 'Value', optional: true }) }, { label: 'Rows', min: 1, max: 5, summary: '{{fields.k}}', itemLabel: 'row' }),
  maybeRows: list({ k: text({ label: 'Key' }) }, { label: 'Maybe rows', min: 0, max: 3, summary: '{{fields.k}}', itemLabel: 'thing' }),
  who: pattern({ label: 'Who', pattern: /^[a-z]+$/, message: 'letters only', source: 'authors', optional: true }),
  ratio: pattern({ label: 'Ratio', pattern: /^\d+:\d+$/, message: 'like 16:9', fallback: '16:9' }),
};
const fields = describeShape(shape);
const field = (name: string) => fields.find((f) => f.name === name)!;

describe('describeShape', () => {
  it('lists the fields in order, without the `type` key', () => {
    expect(fields.map((f) => f.name)).toEqual(Object.keys(shape).filter((k) => k !== 'type'));
  });

  it('reads the label and hint from the metadata, and says a text box is required unless optional', () => {
    expect(field('title')).toMatchObject({ label: 'Title', hint: 'A hint.', widget: 'string', required: true, optional: false, max: 40 });
    expect(field('note')).toMatchObject({ required: false, optional: true });
  });

  it('knows a Markdown box, an inline-Markdown box and a picture', () => {
    expect(field('body')).toMatchObject({ widget: 'markdown', format: 'markdown' });
    expect(field('lead')).toMatchObject({ widget: 'text', format: 'inline' });
    expect(field('pic')).toMatchObject({ widget: 'image', required: true });
  });

  it('reads a pattern as a source string with its message, and an optional pattern as the plain one', () => {
    expect(field('url')).toMatchObject({ pattern: expect.stringContaining('https:'), patternMessage: expect.stringContaining('https://') });
    expect(field('maybe')).toMatchObject({ optional: true, pattern: field('url').pattern });
    expect(field('who')).toMatchObject({ widget: 'select', source: 'authors', optional: true });
    expect(field('ratio')).toMatchObject({ hasDefault: true, default: '16:9', pattern: '^\\d+:\\d+$' });
  });

  it('reads a switch, a menu and a number menu with their labels and defaults', () => {
    expect(field('on')).toMatchObject({ widget: 'boolean', required: false, hasDefault: true, default: false });
    expect(field('kind')).toMatchObject({
      widget: 'select',
      required: false,
      hasDefault: true,
      default: 'a',
      options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }],
    });
    expect(field('size')).toMatchObject({ widget: 'select', default: 3, options: [{ value: 2, label: 'Two' }, { value: 3, label: 'Three' }] });
    expect(field('alt')).toMatchObject({ hasDefault: true, default: '', required: false });
  });

  it('reads a number with its limits and a many-choice menu as a multiple select', () => {
    expect(field('n')).toMatchObject({ widget: 'number', min: 1, max: 9, default: 4 });
    expect(field('many')).toMatchObject({ widget: 'select', multiple: true, required: false, options: [{ value: 'p', label: 'Pee' }, { value: 'q', label: 'Queue' }] });
  });

  it('reads a list with its limits, its row fields, and how a row reads folded', () => {
    expect(field('rows')).toMatchObject({ widget: 'list', min: 1, max: 5, summary: '{{fields.k}}', itemLabel: 'row', required: true });
    expect(field('rows').fields?.map((f) => [f.name, f.required])).toEqual([['k', true], ['v', false]]);
    expect(field('maybeRows')).toMatchObject({ min: 0, max: 3, hasDefault: true, default: [], required: false });
  });

  it('says what a form leaves blank: a menu or number with a default always has a value, a many-choice menu may be empty', () => {
    expect(alwaysHasValue(field('kind'))).toBe(true);
    expect(alwaysHasValue(field('n'))).toBe(true);
    expect(alwaysHasValue(field('many'))).toBe(false);
    expect(alwaysHasValue(field('alt'))).toBe(false);
    expect(alwaysHasValue(field('on'))).toBe(false);
  });

  it('refuses, naming the field, a kind of schema it cannot draw', () => {
    expect(() => describeShape({ weird: z.date() })).toThrow(/Block field "weird" is a date/);
  });
});

describe('valuesWhere', () => {
  const data = {
    body: 'Some words',
    lead: 'One line',
    pic: '/media/a.jpg',
    rows: [{ k: 'x', v: '' }],
    title: 'T',
  };

  it('finds the Markdown boxes, the inline ones and the pictures by what the fields are, not by name', () => {
    expect(valuesWhere(fields, data, { format: 'markdown' }).map((v) => v.field.name)).toEqual(['body']);
    expect(valuesWhere(fields, data, { format: 'inline' }).map((v) => v.field.name)).toEqual(['lead']);
    expect(valuesWhere(fields, data, { widget: 'image' }).map((v) => v.value)).toEqual(['/media/a.jpg']);
  });

  it('looks inside list rows, and skips what is empty or not text', () => {
    const rowShape = describeShape({ type: z.literal('y'), items: list({ pic: image('Pic', 'P'), t: text({ label: 'T', widget: 'markdown' }) }, { label: 'Items', max: 3, summary: 's', itemLabel: 'item' }) });
    const found = valuesWhere(rowShape, { items: [{ pic: '/a.jpg', t: '' }, { pic: '/b.jpg', t: 'words' }, null] }, { widget: 'image' });
    expect(found.map((v) => v.value)).toEqual(['/a.jpg', '/b.jpg']);
    expect(valuesWhere(rowShape, { items: [{ pic: '/a.jpg', t: '' }, { pic: '/b.jpg', t: 'words' }] }, { format: 'markdown' }).map((v) => v.value)).toEqual(['words']);
  });
});
