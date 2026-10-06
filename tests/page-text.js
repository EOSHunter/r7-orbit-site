// The text of a page as a list of lines, for the wording snapshots of the pages built from src/content/pages/ (tests/pages.spec.js):
// the title, the meta description and the robots meta, then every heading, paragraph, list item, link (with its address), label,
// button and field placeholder inside <main> in document order, with the alt text of every image. Runs of whitespace are
// collapsed to one space, which is what a reader sees (the source wraps long lines). Same idea as tests/about-text.js, with links,
// so an address that moves fails as surely as a word that changes.

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

// `pageText`: the words of a page as a list of lines, for tests/page-text.spec.js (the home page and the listing pages): the title
// and meta description, then every heading, paragraph, list item, eyebrow, button, link-button, caption, italic phrase (the brass
// accent) and labelled landmark inside <main> in document order, and the alt text of every image. Runs of whitespace are collapsed to one space (what a reader sees).
//
// What comes from the posts is masked: a card, the hidden cards of other pages (<template>), a count, the tag and author chips
// and the filter buttons each become one `[content]` line. So the lines are the page's own words (what src/content/pages/*.md
// and the components hold), and a post's title or summary changing does not change them.

/** Where the posts show: replaced by one `[content]` line each. */
export const MASK = '.card, template, [data-count], .tag-list, .tag-index, [data-filter]';
/** The elements whose text is read. */
const TEXT = 'h1, h2, h3, h4, p, li, a.btn, a.more-link, button, span.eyebrow, figcaption, blockquote, label, em, img';
/** Landmarks and groups whose accessible name is wording too. */
const NAMED = 'nav[aria-label], section[aria-label], [role="group"][aria-label]';
/** The classes that say what a line is (kept in the line so the fixture reads as the page does). */
const KINDS = ['eyebrow', 'btn', 'more-link', 't-lead', 't-display', 'section-title', 'visually-hidden'];

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ head: string[], lines: string[] }>} `head` is the part every state of the site has: the title, the
 * description and the page head (the hero on the home page). `lines` is the whole page.
 */
export async function pageText(page) {
  return page.evaluate(
    ({ MASK, TEXT, NAMED, KINDS }) => {
      const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
      // An element that wraps a card (an app's <li>) reads without it: the card is the posts', not the page's.
      const textOf = (el) => {
        if (!el.querySelector(MASK)) return clean(el.textContent);
        const copy = el.cloneNode(true);
        copy.querySelectorAll(MASK).forEach((m) => m.remove());
        return clean(copy.textContent);
      };
      const head = [
        `title: ${clean(document.title)}`,
        `description: ${clean(document.querySelector('meta[name="description"]')?.getAttribute('content'))}`,
      ];
      const lines = [...head];
      const main = document.querySelector('main');
      if (!main) return { head, lines };
      for (const el of main.querySelectorAll('*')) {
        const masked = el.closest(MASK);
        if (masked) {
          if (masked === el && lines.at(-1) !== '[content]') lines.push('[content]');
          continue;
        }
        const tag = el.tagName.toLowerCase();
        const kind = KINDS.filter((k) => el.classList.contains(k)).map((k) => `.${k}`).join('');
        const inHead = !!el.closest('.page-head, .hero');
        const add = (line) => {
          lines.push(line);
          if (inHead) head.push(line);
        };
        if (el.matches(NAMED)) add(`${tag} aria-label: ${clean(el.getAttribute('aria-label'))}`);
        if (!el.matches(TEXT)) continue;
        if (tag === 'img') {
          add(`img alt: ${clean(el.getAttribute('alt'))}`);
          continue;
        }
        const text = textOf(el);
        if (!text && el.querySelector(MASK)) continue;
        add(`${tag}${kind}: ${text}`);
      }
      return { head, lines };
    },
    { MASK, TEXT, NAMED, KINDS },
  );
}
