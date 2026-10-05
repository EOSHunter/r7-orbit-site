import { describe, expect, it, vi } from 'vitest';
import { bridgeGetAsset } from './asset-bridge';

/** A stand-in for Decap's getAsset: it knows uploads by file name (under their folder) and returns '' for the rest. */
const decap = (known: Record<string, string>) =>
  vi.fn((path: string) => ({ toString: () => known[path] ?? (/^(\/|https?:)/.test(path) ? path : '') }));

describe('bridgeGetAsset', () => {
  it('finds a fresh upload by its file name, for the paths the editor writes', () => {
    const getAsset = decap({ 'poster.png': 'blob:abc' });
    const bridged = bridgeGetAsset(getAsset);
    expect(String(bridged('/media/vlogs/poster.png'))).toBe('blob:abc');
    expect(String(bridged('/src/assets/blog/poster.png'))).toBe('blob:abc');
  });

  it('falls back to the path itself when Decap does not hold the file (an image that is already live)', () => {
    const bridged = bridgeGetAsset(decap({}));
    expect(String(bridged('/media/vlogs/poster.png'))).toBe('/media/vlogs/poster.png');
  });

  it('leaves older images in deeper folders, other addresses and relative paths alone', () => {
    const getAsset = decap({ 'poster.jpg': 'blob:abc' });
    const bridged = bridgeGetAsset(getAsset);
    // A same-named upload must not stand in for an older image in a sub-folder.
    expect(String(bridged('/media/vlogs/building-vesper-drift/poster.jpg'))).toBe('/media/vlogs/building-vesper-drift/poster.jpg');
    expect(String(bridged('https://example.com/poster.jpg'))).toBe('https://example.com/poster.jpg');
    expect(getAsset).not.toHaveBeenCalledWith('poster.jpg', undefined);
  });

  it('passes the field through, and returns the same function for the same getAsset (React compares them)', () => {
    const getAsset = decap({ 'a.png': 'blob:x' });
    const field = { name: 'src' };
    bridgeGetAsset(getAsset)('/media/news/a.png', field);
    expect(getAsset).toHaveBeenCalledWith('a.png', field);
    expect(bridgeGetAsset(getAsset)).toBe(bridgeGetAsset(getAsset));
  });
});
