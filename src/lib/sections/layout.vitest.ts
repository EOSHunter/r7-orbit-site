import { describe, expect, it } from 'vitest';
import { layoutSections, placementOf, type Row } from './index';

type B = { type: string; [k: string]: unknown };
const heading = (text: string): B => ({ type: 'heading', level: 2, text });
const text = (t: string): B => ({ type: 'text', text: t });
const portrait = (side: 'left' | 'right' = 'left'): B => ({ type: 'portrait', side, text: 'beside' });
const image = (width: 'narrow' | 'wide' | 'full'): B => ({ type: 'image', width });
const divider: B = { type: 'divider' };
const types = (blocks: B[]) => blocks.map((b) => b.type).join(',');
const shape = (rows: Row<B>[]) =>
  rows.map((r) =>
    r.kind === 'split'
      ? `split(${r.lead?.text ?? ''}|${types(r.blocks)})`
      : r.kind === 'prose'
        ? `prose(${types(r.blocks)})`
        : `${r.kind}(${r.block.type}${r.block.width ? `:${r.block.width}` : ''})`,
  );

describe('layoutSections', () => {
  it('keeps the About page as it was: one portrait row holding both sections', () => {
    expect(shape(layoutSections([heading('Hunter Newton'), portrait(), heading('R7'), text('p1')]))).toEqual(['split(Hunter Newton|heading,text)']);
  });

  it('puts the heading above a portrait beside it, and not a heading further up', () => {
    expect(shape(layoutSections([heading('Intro'), text('t'), heading('Me'), portrait()]))).toEqual(['prose(heading,text)', 'split(Me|)']);
  });

  it('draws plain text as one reading column', () => {
    expect(shape(layoutSections([heading('A'), text('t'), text('u')]))).toEqual(['prose(heading,text,text)']);
    expect(shape(layoutSections([]))).toEqual([]);
  });

  it('drops the row a lone heading would leave behind when a portrait takes it', () => {
    expect(shape(layoutSections([heading('Me'), portrait()]))).toEqual(['split(Me|)']);
  });

  it('ends a portrait row at a divider, a block that leaves the column, or another portrait', () => {
    expect(shape(layoutSections([portrait(), text('a'), divider, text('b')]))).toEqual(['split(|text)', 'prose(divider,text)']);
    expect(shape(layoutSections([portrait(), text('a'), image('wide'), text('b')]))).toEqual(['split(|text)', 'wide(image:wide)', 'prose(text)']);
    expect(shape(layoutSections([portrait(), text('a'), image('full')]))).toEqual(['split(|text)', 'full(image:full)']);
    expect(shape(layoutSections([portrait(), text('a'), { type: 'latest' }, text('b')]))).toEqual(['split(|text)', 'wide(latest)', 'prose(text)']);
    expect(shape(layoutSections([portrait(), text('a'), portrait('right'), text('b')]))).toEqual(['split(|text)', 'split(|text)']);
  });

  it('keeps a narrow image in the column and a wide one out of it', () => {
    expect(shape(layoutSections([text('a'), image('narrow'), text('b')]))).toEqual(['prose(text,image,text)']);
    expect(shape(layoutSections([text('a'), image('wide'), text('b')]))).toEqual(['prose(text)', 'wide(image:wide)', 'prose(text)']);
  });

  it('follows the order of the list when blocks are moved', () => {
    expect(shape(layoutSections([heading('Me'), portrait(), heading('Agent'), text('x')]))).toEqual(['split(Me|heading,text)']);
    expect(shape(layoutSections([heading('Agent'), text('x'), heading('Me'), portrait()]))).toEqual(['prose(heading,text)', 'split(Me|)']);
  });

  it('does not change the list it is given', () => {
    const list = [heading('Me'), portrait(), text('x')];
    const copy = structuredClone(list);
    layoutSections(list);
    expect(list).toEqual(copy);
  });
});

describe('where each block sits (its definition decides)', () => {
  it('puts text blocks in the reading column and the wide ones in rows of their own', () => {
    for (const type of ['heading', 'lead', 'text', 'quote', 'pullquote', 'callout', 'code', 'video', 'divider', 'spacer', 'links', 'button', 'toc', 'stats', 'author']) {
      expect(placementOf({ type }), type).toBe('prose');
    }
    for (const type of ['image-row', 'gallery', 'game', 'columns', 'latest']) expect(placementOf({ type }), type).toBe('wide');
    expect(placementOf({ type: 'portrait' })).toBe('portrait');
  });

  it('lets an image choose by its width, and the newsletter by its style', () => {
    expect(placementOf({ type: 'image', width: 'narrow' })).toBe('prose');
    expect(placementOf({ type: 'image' })).toBe('prose');
    expect(placementOf({ type: 'image', width: 'wide' })).toBe('wide');
    expect(placementOf({ type: 'image', width: 'full' })).toBe('full');
    expect(placementOf({ type: 'newsletter', style: 'band' })).toBe('band');
    expect(placementOf({ type: 'newsletter', style: 'form' })).toBe('prose');
  });

  it('draws the newsletter band, a gallery and a game each in a row of their own, ending a portrait row', () => {
    expect(shape(layoutSections([text('a'), { type: 'newsletter', style: 'band' }, text('b')]))).toEqual(['prose(text)', 'band(newsletter)', 'prose(text)']);
    expect(shape(layoutSections([text('a'), { type: 'newsletter', style: 'form' }, text('b')]))).toEqual(['prose(text,newsletter,text)']);
    expect(shape(layoutSections([{ type: 'gallery' }, { type: 'game' }]))).toEqual(['wide(gallery)', 'wide(game)']);
  });

  it('treats a block type it does not know as text, so a half-typed list still draws', () => {
    expect(shape(layoutSections([{ type: 'whatever' }]))).toEqual(['prose(whatever)']);
  });
});
