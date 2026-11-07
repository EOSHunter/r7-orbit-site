import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { motionOf } from './post-cards';

// Hover clips (docs/IMAGES.md "Hover clips"): `coverMotion` names an MP4 under /media/; its WebM twin is found by name; a clip that
// is not in public/ stops the build with the post's path in the message.
describe('motionOf', () => {
  let root = '';
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'motion-'));
    mkdirSync(join(root, 'public/media/motion/a'), { recursive: true });
    writeFileSync(join(root, 'public/media/motion/a/hover.mp4'), 'mp4');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('is undefined without a clip', () => {
    expect(motionOf(undefined, 'src/content/blog/x', root)).toBeUndefined();
  });

  it('returns the MP4, and the WebM only when that file exists', () => {
    expect(motionOf('/media/motion/a/hover.mp4', 'x', root)).toEqual({ mp4: '/media/motion/a/hover.mp4' });
    writeFileSync(join(root, 'public/media/motion/a/hover.webm'), 'webm');
    expect(motionOf('/media/motion/a/hover.mp4', 'x', root)).toEqual({ mp4: '/media/motion/a/hover.mp4', webm: '/media/motion/a/hover.webm' });
  });

  it('stops with a readable message when the file is missing', () => {
    expect(() => motionOf('/media/motion/b/hover.mp4', 'src/content/blog/my-post', root)).toThrow(
      /src\/content\/blog\/my-post: coverMotion \/media\/motion\/b\/hover.mp4 is not in public\//,
    );
  });
});
