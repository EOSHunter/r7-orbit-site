import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { fitUnderLimit } from '../../scripts/media.mjs';
import { fitAttempts, MAX_SHIPPED_BYTES } from './media-rules.mjs';

// A picture the author uploads must never stop the build (2026-11-06): one still over the limit after the build shrank it is
// re-encoded harder, then made narrower, until it fits (scripts/media.mjs).
const dir = mkdtempSync(join(tmpdir(), 'media-fit-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Random noise: the worst case for compression, so a 2000px PNG of it is far over 2 MB. */
const noise = (width: number, height: number) =>
  sharp(Buffer.from(Array.from({ length: width * height * 3 }, () => Math.floor(Math.random() * 256))), { raw: { width, height, channels: 3 } });

describe('fitUnderLimit', () => {
  it('brings a 1600px noise PNG of several MB under 2 MB, keeping it a PNG', async () => {
    const file = join(dir, 'screenshot.png');
    writeFileSync(file, await noise(1600, 900).png().toBuffer());
    expect(readFileSync(file).length).toBeGreaterThan(MAX_SHIPPED_BYTES);
    const fitted = await fitUnderLimit(file);
    expect(fitted?.data.length).toBeLessThanOrEqual(MAX_SHIPPED_BYTES);
    expect((await sharp(fitted!.data).metadata()).format).toBe('png');
  }, 60_000);

  it('brings a heavy JPEG under 2 MB and leaves a light one alone', async () => {
    const heavy = join(dir, 'photo.jpg');
    writeFileSync(heavy, await noise(2000, 2000).jpeg({ quality: 100 }).toBuffer());
    expect((await fitUnderLimit(heavy))?.data.length).toBeLessThanOrEqual(MAX_SHIPPED_BYTES);
    const light = join(dir, 'small.jpg');
    writeFileSync(light, await noise(200, 200).jpeg().toBuffer());
    expect(await fitUnderLimit(light)).toBeUndefined();
  }, 60_000);

  it('tries its own width first, then narrower, never wider than 2000px', () => {
    expect(fitAttempts(3000)[0]).toEqual({ width: 2000, quality: 80 });
    expect(fitAttempts(1200).map((a) => a.width)).toEqual([1200, 1200, 1024, 1024, 800, 800, 640, 640]);
  });
});
