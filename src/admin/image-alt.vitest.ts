import { describe, expect, it } from 'vitest';
import { imageAltError } from './image-alt';

describe('imageAltError: alt text is required exactly when its picture is set', () => {
  it('asks for a description when there is a picture and the alt text is empty, missing or spaces', () => {
    for (const alt of ['', '   ', undefined, null]) {
      expect(imageAltError('../../assets/blog/a.jpg', alt, 'Featured image alt text')?.message, String(alt)).toBe(
        'Featured image alt text: describe the featured image in one plain sentence. It is needed whenever there is an image.',
      );
    }
  });

  it('passes alt text with words, and any alt text (or none) when there is no picture', () => {
    expect(imageAltError('/media/news/a.png', 'Two bars', 'Cover image alt text')).toBeUndefined();
    for (const image of [undefined, null, '', '  ']) expect(imageAltError(image, '', 'Cover image alt text')).toBeUndefined();
  });
});
