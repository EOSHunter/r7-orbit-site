// The text of the About page as a list of lines, for tests/about.spec.js: the title, the meta description, then every
// heading, paragraph, list item, quote, caption and emphasis inside <main> in document order, and the alt text of every image.
// Runs of whitespace are collapsed to one space, which is what a reader sees (the source wraps long lines).

/** @param {import('@playwright/test').Page} page */
export async function aboutTextLines(page) {
  return page.evaluate(() => {
    const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const lines = [
      `title: ${clean(document.title)}`,
      `description: ${clean(document.querySelector('meta[name="description"]')?.getAttribute('content'))}`,
    ];
    const els = document.querySelectorAll('main :is(h1,h2,h3,h4,p,li,blockquote,figcaption,strong,em,img)');
    for (const el of els) {
      const tag = el.tagName.toLowerCase();
      lines.push(tag === 'img' ? `img alt: ${clean(el.getAttribute('alt'))}` : `${tag}: ${clean(el.textContent)}`);
    }
    return lines;
  });
}
