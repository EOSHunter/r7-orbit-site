// The post card: a quoted post from X, Bluesky, LinkedIn, a forum or any other public feed, drawn as a card in the site's own
// style (docs/ARTICLE_COMPONENTS.md, "Post"). No platform's logo or layout, no embed script, no avatar fetched from elsewhere:
// initials stand in for the picture, and the link goes to the original. One source for every place that draws it:
//   - the Markdown callout `> [!POST] …` (src/lib/markdown/remark-callouts.mjs) uses the trees below as hast
//   - the <Post> component, the `post` page block and the editor's previews use `postCardHtml`, the same trees as HTML
// Pure: no Astro, no DOM. Every value is escaped. Plain JavaScript so the Markdown plugin (loaded by astro.config.mjs) can import it.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-11-04`: the only date form a post card takes. */
export const POST_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** The original post's address: https only. */
export const POST_URL_PATTERN = /^https:\/\/\S+$/;

/**
 * @typedef {object} PostCardData
 * @property {string} name Who posted it, as their profile shows the name.
 * @property {string} platform Where: X, Bluesky, LinkedIn, Mastodon, GitHub, a forum's name.
 * @property {string} [handle] `@addyosmani`, as the platform shows it.
 * @property {string} [role] A few words on who they are, from a source ("Anthropic").
 * @property {string} [date] `2026-11-04`.
 * @property {string} [url] The post's own address (https).
 */

/**
 * @typedef {object} QuotedData
 * @property {string} [label] What the inner post is ("Quoted reply"); "Quoted post" when empty.
 * @property {string} [date] `2026-10-30`.
 * @property {string} [url] The inner post's own address (https).
 */

/** @typedef {{ type: 'text', value: string }} TextNode */
/** @typedef {{ type: 'element', tagName: string, properties: Record<string, string | string[]>, children: Array<ElementNode | TextNode> }} ElementNode */

/** @returns {ElementNode} */
const el = (tagName, properties, children) => ({ type: 'element', tagName, properties, children });
/** @returns {TextNode} */
const tx = (value) => ({ type: 'text', value });

/** `Nov 4, 2026` (the site's `longDate`) from `2026-11-04`. Throws on anything else. */
export function postDate(iso) {
  const match = POST_DATE_PATTERN.exec(iso) && /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const m = match ? Number(match[2]) - 1 : -1;
  const d = match ? Number(match[3]) : 0;
  if (!match || m < 0 || m > 11 || d < 1 || d > 31) throw new Error(`post card: the date "${iso}" must be written 2026-11-04`);
  return `${MONTHS[m]} ${d}, ${match[1]}`;
}

/** The first letters of the first two words of the name: `AO` for Addy Osmani. */
export function initials(name) {
  const letters = name
    .split(/\s+/)
    .map((word) => /\p{L}|\p{N}/u.exec(word)?.[0] ?? '')
    .filter(Boolean);
  return letters.slice(0, 2).join('').toUpperCase() || '?';
}

function checkUrl(url, what) {
  if (url && !POST_URL_PATTERN.test(url)) throw new Error(`post card: ${what} "${url}" must be a full address starting with https://`);
}

/** Checks a card's fields and returns them trimmed; throws a readable error when one is wrong. */
export function checkPost(/** @type {PostCardData} */ d) {
  const out = {
    name: (d.name ?? '').trim(),
    platform: (d.platform ?? '').trim(),
    handle: d.handle?.trim() || undefined,
    role: d.role?.trim() || undefined,
    date: d.date?.trim() || undefined,
    url: d.url?.trim() || undefined,
  };
  if (!out.name) throw new Error('post card: it needs the name of who posted it');
  if (!out.platform) throw new Error(`post card for ${out.name}: it needs the platform (X, Bluesky, LinkedIn...)`);
  if (out.date) postDate(out.date);
  checkUrl(out.url, 'the address');
  return out;
}

/** The top of the card, a <figcaption>: initials, name, handle and role, and "Post on X". */
export function postCardHead(/** @type {PostCardData} */ data) {
  const d = checkPost(data);
  const meta = [d.handle, d.role].filter(Boolean).join(' · ');
  return el('figcaption', { className: ['post-card-head'] }, [
    el('span', { className: ['post-card-avatar'], ariaHidden: 'true' }, [tx(initials(d.name))]),
    el('span', { className: ['post-card-who'] }, [
      el('span', { className: ['post-card-name'] }, [tx(d.name)]),
      ...(meta ? [el('span', { className: ['post-card-meta'] }, [tx(meta)])] : []),
    ]),
    el('span', { className: ['post-card-platform'] }, [tx(`Post on ${d.platform}`)]),
  ]);
}

/** The bottom line: the date and "View the post on X". Undefined when the card has neither. */
export function postCardFoot(/** @type {PostCardData} */ data) {
  const d = checkPost(data);
  if (!d.date && !d.url) return undefined;
  const children = [];
  if (d.date) children.push(el('time', { dateTime: d.date }, [tx(postDate(d.date))]));
  if (d.url) children.push(el('a', { className: ['post-card-link'], href: d.url, rel: 'noopener' }, [tx(`View the post on ${d.platform}`)]));
  return el('p', { className: ['post-card-foot'] }, children);
}

/** The small label over a quoted post inside the card: "Quoted post · Oct 30, 2026", a link when it has an address. */
export function postCardQuotedLabel(/** @type {QuotedData} */ q = {}) {
  const label = q.label?.trim() || 'Quoted post';
  const date = q.date?.trim();
  const url = q.url?.trim();
  if (date) postDate(date);
  checkUrl(url, 'the quoted post\'s address');
  const words = [tx(label), ...(date ? [tx(' · '), el('time', { dateTime: date }, [tx(postDate(date))])] : [])];
  return el('p', { className: ['post-card-quoted-label'] }, url ? [el('a', { href: url, rel: 'noopener' }, words)] : words);
}

// ---- HTML -------------------------------------------------------------------------------------------------------------

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** hast property name to HTML attribute name. */
const attrName = (key) => (key === 'className' ? 'class' : key === 'dateTime' ? 'datetime' : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

/** A tree from this file as HTML. */
export function treeHtml(/** @type {ElementNode | TextNode} */ node) {
  if (node.type === 'text') return escapeHtml(node.value);
  const attrs = Object.entries(node.properties)
    .map(([key, value]) => ` ${attrName(key)}="${escapeHtml(Array.isArray(value) ? value.join(' ') : value)}"`)
    .join('');
  return `<${node.tagName}${attrs}>${node.children.map(treeHtml).join('')}</${node.tagName}>`;
}

/** Plain text (a quoted post typed into a field) as escaped paragraphs: a blank line starts a new one. */
export function plainParagraphs(source) {
  return String(source ?? '')
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\s*\n\s*/g, ' ')}</p>`)
    .join('');
}

/**
 * The whole card as HTML. `bodyHtml` and `quotedHtml` are the post's text already rendered (Markdown, MDX children or the
 * preview's own renderer): trusted HTML, not escaped here.
 * @param {PostCardData} data
 * @param {string} bodyHtml
 * @param {{ quoted?: QuotedData, quotedHtml?: string }} [inner]
 */
export function postCardHtml(data, bodyHtml, inner = {}) {
  const d = checkPost(data);
  const quoted = inner.quotedHtml?.trim()
    ? `<div class="post-card-quoted">${treeHtml(postCardQuotedLabel(inner.quoted))}${inner.quotedHtml}</div>`
    : '';
  const cite = d.url ? ` cite="${escapeHtml(d.url)}"` : '';
  const foot = postCardFoot(d);
  return `<figure class="post-card">${treeHtml(postCardHead(d))}<blockquote class="post-card-text"${cite}>${bodyHtml}${quoted}</blockquote>${foot ? treeHtml(foot) : ''}</figure>`;
}

// ---- The Markdown header line ------------------------------------------------------------------------------------------

const SEPARATOR = /\s+[·|]\s+/;
/** A part that is a date in another form (11/04/2026, 2026.11.04, 4-11-26): refused, so it never becomes the name or the role. */
const OTHER_DATE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/;

/** A header's parts, with the address and the date taken out by their shape. */
function headerParts(line) {
  const found = { words: /** @type {string[]} */ ([]) };
  for (const part of line.trim().split(SEPARATOR).map((p) => p.trim()).filter(Boolean)) {
    if (/^https?:\/\//.test(part)) found.url = part;
    else if (POST_DATE_PATTERN.test(part)) found.date = part;
    else if (OTHER_DATE.test(part)) throw new Error(`post card: the date "${part}" must be written 2026-11-04`);
    else found.words.push(part);
  }
  return found;
}

/**
 * Reads the line after `[!POST]`: `Name · @handle · Platform · Role · 2026-11-04 · https://…`, parts split by ` · ` or ` | `.
 * A part starting with https:// is the address, one like 2026-11-04 the date, one starting with @ the handle; the others are, in
 * order, the name, the platform and the role.
 * @returns {PostCardData}
 */
export function parsePostHeader(line) {
  const { url, date, words: parts } = headerParts(line);
  const out = { name: '', platform: '', url, date, handle: parts.find((p) => p.startsWith('@')) };
  const words = parts.filter((p) => !p.startsWith('@'));
  [out.name = '', out.platform = '', out.role] = words;
  if (words.length > 3) throw new Error(`post card: too many parts in "[!POST] ${line.trim()}" (name, platform and role at most, then @handle, date and address)`);
  return checkPost(out);
}

/**
 * Reads the line after `[!QUOTED]` (the optional first line of a quoted post inside the card): `Label · 2026-10-30 · https://…`.
 * @returns {QuotedData}
 */
export function parseQuotedHeader(line) {
  const { url, date, words } = headerParts(line);
  const out = { url, date };
  if (words.length) out.label = words.join(' · ');
  postCardQuotedLabel(out);
  return out;
}
