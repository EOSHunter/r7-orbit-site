// The text of a page as a list of lines, for the wording snapshots of the pages built from src/content/pages/ (tests/pages.spec.js):
// the title, the meta description and the robots meta, then every heading, paragraph, list item, link (with its address), label,
// button and field placeholder inside <main> in document order, with the alt text of every image. Runs of whitespace are
// collapsed to one space, which is what a reader sees (the source wraps long lines). Same idea as tests/about-text.js, with links,
// so an address that moves (the contact email, the RSS feed) fails as surely as a word that changes.

/** @param {import('@playwright/test').Page} page */
export async function pageTextLines(page) {
  return page.evaluate(() => {
    const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
    const meta = (name) => clean(document.querySelector(`meta[name="${name}"]`)?.getAttribute('content'));
    const lines = [
      `title: ${clean(document.title)}`,
      `description: ${meta('description')}`,
      `robots: ${meta('robots')}`,
    ];
    const els = document.querySelectorAll(
      'main :is(h1,h2,h3,h4,p,li,blockquote,figcaption,strong,em,a,label,button,input,img)',
    );
    for (const el of els) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'img') lines.push(`img alt: ${clean(el.getAttribute('alt'))}`);
      else if (tag === 'a') lines.push(`a: ${clean(el.textContent)} -> ${el.getAttribute('href')}`);
      else if (tag === 'input')
        lines.push(`input: ${el.getAttribute('type')} "${clean(el.getAttribute('placeholder'))}"`);
      else lines.push(`${tag}: ${clean(el.textContent)}`);
    }
    return lines;
  });
}
