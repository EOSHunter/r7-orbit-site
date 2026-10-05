import { describe, expect, it, vi } from 'vitest';
import { aspectRatio, isPlayable, playOrigin } from './play';

describe('play helpers', () => {
  it('is playable only with a play address', () => {
    expect(isPlayable({ playUrl: 'https://play.example.test/game/' })).toBe(true);
    expect(isPlayable({})).toBe(false);
    expect(isPlayable({ playUrl: '' })).toBe(false);
  });

  it('turns width:height into a CSS aspect-ratio and falls back to 16 / 9', () => {
    expect(aspectRatio('16:9')).toBe('16 / 9');
    expect(aspectRatio('4:3')).toBe('4 / 3');
    expect(aspectRatio(undefined)).toBe('16 / 9');
    expect(aspectRatio('wide')).toBe('16 / 9');
    expect(aspectRatio('0:9')).toBe('16 / 9');
    expect(aspectRatio('16:9; color: red')).toBe('16 / 9');
  });

  it('reads the origin a play address needs in frame-src', () => {
    expect(playOrigin('https://vesper.r7orbit.io/')).toBe('https://vesper.r7orbit.io');
    expect(playOrigin('https://vesper.r7orbit.io/')).toBe('https://vesper.r7orbit.io');
  });
});

// The projects schema, read the way src/admin/config.vitest.ts does: `defineCollection` returns what it is given.
vi.mock('astro:content', async () => {
  const { z } = await import('astro/zod');
  return {
    defineCollection: (c: unknown) => c,
    reference: (collection: string) => z.string().transform((id) => ({ collection, id })),
  };
});
vi.mock('astro/loaders', () => ({ glob: () => ({}) }));

describe('the projects schema', () => {
  async function parse(extra: Record<string, unknown>) {
    const { z } = await import('astro/zod');
    const { collections } = await import('../content.config');
    const { schema } = collections.projects as unknown as {
      schema: (ctx: { image: () => unknown }) => import('astro/zod').z.ZodType;
    };
    const base = { title: 'A project', date: '2026-10-01', summary: 'One line.', status: 'shipped' };
    return schema({ image: () => z.string() }).safeParse({ ...base, ...extra });
  }

  it('is unchanged for a project without playUrl, and fills the defaults for a playable one', async () => {
    expect((await parse({})).success).toBe(true);
    const ok = await parse({ playUrl: 'https://play.example.test/game/' });
    expect(ok.success).toBe(true);
    expect(ok.data).toMatchObject({ playMode: 'embed', playAspect: '16:9', controls: [], platforms: [] });
  });

  it('takes every playable field', async () => {
    const r = await parse({
      playUrl: 'https://play.example.test/game/',
      playMode: 'link',
      playAspect: '4:3',
      controls: [{ key: 'Space', action: 'Fire' }],
      playNote: 'Best on desktop with a mouse',
      platforms: ['desktop', 'mobile'],
    });
    expect(r.success).toBe(true);
  });

  it('rejects a play address that is not https, a bad mode, aspect or platform, and settings without a playUrl', async () => {
    for (const bad of [
      { playUrl: 'http://play.example.test/' },
      { playUrl: 'play.example.test' },
      { playUrl: 'https://play.example.test/', playMode: 'iframe' },
      { playUrl: 'https://play.example.test/', playAspect: '16/9' },
      { playUrl: 'https://play.example.test/', playAspect: '0:9' },
      { playUrl: 'https://play.example.test/', platforms: ['console'] },
      { playUrl: 'https://play.example.test/', controls: [{ key: '', action: 'Fire' }] },
      { playUrl: 'https://play.example.test/', playNote: 'x'.repeat(121) },
      { controls: [{ key: 'W', action: 'Up' }] },
      { playNote: 'Best on desktop' },
      { platforms: ['desktop'] },
    ]) {
      expect((await parse(bad)).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
