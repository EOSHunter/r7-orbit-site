import { describe, expect, it } from 'vitest';
import {
  MAX_SHIPPED_BYTES,
  MAX_SOURCE_BYTES,
  bodyImagesMissingAlt,
  checkShippedFile,
  checkSourceFile,
  extensionOf,
  isVariant,
  safeFileName,
  variantPath,
  variantWidths,
} from './media-rules.mjs';

describe('checkSourceFile', () => {
  const ok = (path: string, size = 1000) => checkSourceFile({ path, size });

  it('accepts jpg, jpeg, png, webp, avif and svg with a safe name', () => {
    for (const name of ['a.jpg', 'a.jpeg', 'a.png', 'a.webp', 'a.avif', 'a.svg', 'poster-2.jpg']) {
      expect(ok(`public/media/${name}`), name).toEqual([]);
    }
  });

  it('refuses HEIC and says how to get a JPG, whatever the case', () => {
    const [problem] = ok('public/media/IMG_0001.HEIC');
    expect(problem).toContain('public/media/IMG_0001.HEIC');
    expect(problem).toMatch(/JPG/);
    expect(ok('x.heif')).toHaveLength(1);
  });

  it('refuses other formats the site does not accept', () => {
    expect(ok('x.gif')[0]).toMatch(/GIF/);
    expect(ok('x.pdf')[0]).toMatch(/not an image format/);
  });

  it('refuses names with spaces or capitals and suggests the fixed name', () => {
    const [problem] = ok('public/media/My Photo (1).png');
    expect(problem).toContain('"my-photo-1.png"');
  });

  it('refuses a file over the source limit but not one just under it', () => {
    expect(ok('a.jpg', MAX_SOURCE_BYTES)).toEqual([]);
    expect(ok('a.jpg', MAX_SOURCE_BYTES + 1)[0]).toMatch(/over the 10\.0 MB limit/);
  });
});

describe('checkShippedFile', () => {
  it('allows up to 2 MB and names the file above it, with advice for the format', () => {
    expect(checkShippedFile({ path: '/media/a.png', size: MAX_SHIPPED_BYTES })).toEqual([]);
    expect(checkShippedFile({ path: '/media/a.png', size: MAX_SHIPPED_BYTES + 1 })[0]).toMatch(/\/media\/a\.png.*JPG or WebP/);
    expect(checkShippedFile({ path: '/media/a.svg', size: MAX_SHIPPED_BYTES + 1 })[0]).toMatch(/Simplify/);
  });
});

describe('file names', () => {
  it('makes an upload name safe the way the admin does', () => {
    expect(safeFileName('My Photo (1).JPG')).toBe('my-photo-1.jpg');
    expect(safeFileName('Café été.png')).toBe('cafe-ete.png');
    expect(safeFileName('IMG_0001.jpeg')).toBe('img_0001.jpeg');
    expect(safeFileName('///')).toBe('image');
    expect(extensionOf('a/b/Photo.PNG')).toBe('png');
    expect(extensionOf('noext')).toBe('');
  });
});

describe('bodyImagesMissingAlt', () => {
  it('finds a Markdown image with no alt text, and accepts one that has it or is marked decorative', () => {
    expect(bodyImagesMissingAlt('![](/media/a.jpg)')).toEqual([{ src: '/media/a.jpg', form: 'markdown' }]);
    expect(bodyImagesMissingAlt('![ ](/media/a.jpg)')).toHaveLength(1);
    expect(bodyImagesMissingAlt('![A chart](/media/a.jpg)')).toEqual([]);
    expect(bodyImagesMissingAlt('![](/media/a.jpg "decorative")')).toEqual([]);
    expect(bodyImagesMissingAlt('![](/media/a.jpg "a title")')).toHaveLength(1);
  });

  it('finds a Figure with no alt, an empty alt or neither, and accepts decorative', () => {
    expect(bodyImagesMissingAlt('<Figure src="/src/assets/blog/a.jpg" />')).toEqual([
      { src: '/src/assets/blog/a.jpg', form: 'block' },
    ]);
    expect(bodyImagesMissingAlt('<Figure src="/media/a.jpg" alt="" />')).toHaveLength(1);
    expect(bodyImagesMissingAlt('<Figure src="/media/a.jpg" alt="A chart" />')).toEqual([]);
    expect(bodyImagesMissingAlt('<Figure src="/media/a.jpg" decorative={true} />')).toEqual([]);
    expect(bodyImagesMissingAlt('<Figure src={"/media/a.jpg"} alt={"say \\"hi\\""} />')).toEqual([]);
    // No picture yet: the placeholder plate, nothing to describe.
    expect(bodyImagesMissingAlt('<Figure alt="" />')).toEqual([]);
  });

  it('finds gallery images with no alt', () => {
    const gallery = (images: unknown) => `<ImageGallery images={${JSON.stringify(images)}} />`;
    expect(bodyImagesMissingAlt(gallery([{ src: '/media/a.jpg', alt: 'A' }, { src: '/media/b.jpg', alt: '' }]))).toEqual([
      { src: '/media/b.jpg', form: 'block' },
    ]);
    expect(bodyImagesMissingAlt(gallery([{ src: '/media/a.jpg', alt: 'A' }, { src: '/media/b.jpg', alt: 'B' }]))).toEqual([]);
  });

  it('ignores images inside a code fence', () => {
    expect(bodyImagesMissingAlt('```md\n![](/media/a.jpg)\n```')).toEqual([]);
  });
});

describe('smaller copies (srcset)', () => {
  it('makes the widths below the picture and one at its own width, after the 2000px cap', () => {
    expect(variantWidths(2293)).toEqual([160, 480, 720, 960, 1280, 2000]);
    expect(variantWidths(1280)).toEqual([160, 480, 720, 960, 1280]);
    expect(variantWidths(800)).toEqual([160, 480, 720, 800]);
    expect(variantWidths(512)).toEqual([160, 480, 512]);
    expect(variantWidths(480)).toEqual([160, 480]);
  });

  it('gives a 256px author picture a 160 copy and one at its own width, so the avatar is not a 57 kB PNG', () => {
    expect(variantWidths(256)).toEqual([160, 256]);
    expect(variantWidths(240)).toEqual([160, 240]);
  });

  it('makes none for an icon (narrower than 240px), not even the avatar-sized 160', () => {
    expect(variantWidths(239)).toEqual([]);
    expect(variantWidths(192)).toEqual([]);
    expect(variantWidths(160)).toEqual([]);
    expect(variantWidths(0)).toEqual([]);
  });

  it('names a copy after its picture, as WebP, and recognises it', () => {
    expect(variantPath('/media/vlogs/x/poster.jpg', 640)).toBe('/media/vlogs/x/poster.640w.webp');
    expect(variantPath('/media/screenshot-2026-10-03.png', 480)).toBe('/media/screenshot-2026-10-03.480w.webp');
    expect(isVariant('/media/a.640w.webp')).toBe(true);
    expect(isVariant('/media/a.webp')).toBe(false);
    expect(isVariant('/media/a-640w.webp')).toBe(false);
  });
});
