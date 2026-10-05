import { describe, expect, it } from 'vitest';
import {
  MAX_SHIPPED_BYTES,
  MAX_SOURCE_BYTES,
  bodyImagesMissingAlt,
  checkShippedFile,
  checkSourceFile,
  extensionOf,
  safeFileName,
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
