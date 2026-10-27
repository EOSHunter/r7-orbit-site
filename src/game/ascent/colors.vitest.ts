import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENE_TOKENS, parseColor } from './colors';

describe('parseColor', () => {
  it('reads what getComputedStyle gives (rgb with commas or spaces, rgba, color(srgb))', () => {
    expect(parseColor('rgb(9, 9, 10)')).toEqual({ r: 9 / 255, g: 9 / 255, b: 10 / 255 });
    expect(parseColor('rgb(236 230 216)')).toEqual({ r: 236 / 255, g: 230 / 255, b: 216 / 255 });
    expect(parseColor('rgba(201, 169, 106, 0.5)')).toEqual({ r: 201 / 255, g: 169 / 255, b: 106 / 255 });
    expect(parseColor('rgb(201 169 106 / 0.42)')).toEqual({ r: 201 / 255, g: 169 / 255, b: 106 / 255 });
    expect(parseColor('color(srgb 0.5 0.25 1)')).toEqual({ r: 0.5, g: 0.25, b: 1 });
  });

  it('reads hex, and refuses what it cannot read', () => {
    expect(parseColor('#fff')).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseColor('#c9a96a')).toEqual({ r: 201 / 255, g: 169 / 255, b: 106 / 255 });
    expect(parseColor('')).toBeNull();
    expect(parseColor('var(--bg)')).toBeNull();
    expect(parseColor('color(display-p3 1 0 0)')).toBeNull();
    expect(parseColor('rgb(a, b, c)')).toBeNull();
  });
});

describe('the scene tokens', () => {
  it('all exist in tokens.css', () => {
    const css = readFileSync(new URL('../../styles/design-system/tokens.css', import.meta.url), 'utf8');
    for (const token of Object.values(SCENE_TOKENS)) expect(css, token).toContain(`${token}:`);
  });
});
