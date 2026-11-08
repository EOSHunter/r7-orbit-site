// The layout check (docs/WRITING_GUIDE.md "The layout check"): reads one post, Markdown/MDX body or `sections`, and says where it
// reads as a wall of text or breaks a writing rule. Report only: it never changes a file, and it is not part of the build, CI or
// Cloudflare. Plain JavaScript with no Astro, so scripts/check-layout.mjs and Vitest (layout-check.vitest.ts) share the one rule.
//
// The body is read line by line, not by a full Markdown parser: each paragraph, heading, list, quote, code block, picture, MDX
// component or section block becomes an "item", and the rules look at the run of items. Good enough to point at a line; the
// numbers are the guide's (LIMITS below), so a change to the guide is a change here.
import { LineCounter, parseDocument } from 'yaml';
import { contactProblems } from './no-contact.mjs';

/** The guide's numbers (docs/WRITING_GUIDE.md "Density rules"). */
export const LIMITS = {
  /** Paragraphs in a row with nothing else between them. */
  runParagraphs: 4,
  /** Words in a row with nothing else between them. */
  runWords: 250,
  /** Sentences in one paragraph before it is flagged (the guide asks for five at most). */
  paragraphSentences: 6,
  /** Words after which a post should hold a picture. */
  pictureWords: 600,
  /** One callout per this many words (at least one allowed). */
  wordsPerCallout: 400,
  /** One pull quote per this many words (at least one allowed). */
  wordsPerPullquote: 800,
  /** h2 headings, and words, from which a contents list is wanted. */
  tocHeadings: 3,
  tocWords: 600,
  /** The summary: aim, and the schema's hard limit (src/content.config.ts). */
  summaryAim: 155,
  summaryMax: 180,
  /** The title: aim (docs/VOICE_AND_COPY.md), the schema allows 90. */
  titleAim: 70,
};

/** What each rule costs the score, and its fix. Kept in one table so the report, the guide and the tests agree. */
export const RULES = {
  'wall-of-text': { weight: 10, fix: 'Break it up: a heading, a Figure or image, a Callout, a list or a quote.' },
  'long-paragraph': { weight: 4, fix: 'One idea per paragraph, five sentences at most: split it.' },
  'no-picture': {
    weight: 8,
    fix: 'Add a picture (Figure, image or image-row block, gallery) or a diagram; or ask for one with an IMAGE NEEDED marker.',
  },
  'no-contents': {
    weight: 6,
    fix: 'Three or more ## headings want a contents list: a toc block (sections), or leave `toc` on (blog).',
  },
  'no-hero': {
    weight: 8,
    fix: 'Add a featured image or cover, or write `# heroless: <why>` in the front matter and say why in your report.',
  },
  'alt-missing': { weight: 10, fix: 'Describe the picture in one plain sentence (what it shows and why it is there).' },
  'alt-poor': { weight: 5, fix: 'Say what the picture shows, not "image of" or a file name.' },
  'image-needed': {
    weight: 10,
    fix: 'Get the picture from the author, or leave the post as a draft and list it in your report.',
  },
  placeholder: {
    weight: 10,
    fix: 'Replace every TODO: and [PLACEHOLDER] from the template, and delete the template comments.',
  },
  'placeholder-plate': {
    weight: 6,
    fix: 'A Figure with no src draws the empty plate: give it a picture or remove it.',
  },
  'heading-h1': { weight: 5, fix: 'The page title is the h1: start headings in the body at ##.' },
  'heading-skip': { weight: 4, fix: 'Do not skip heading levels (## then ###).' },
  'title-case': { weight: 3, fix: 'Sentence case: capitalise the first word and names only.' },
  'brass-phrase': {
    weight: 3,
    fix: 'One *brass phrase* per title or heading, a few words that carry the idea, not the whole line.',
  },
  'title-length': { weight: 2, fix: 'Aim for 70 characters or fewer.' },
  summary: { weight: 10, fix: 'One or two sentences that say what the reader gets, 155 characters or fewer.' },
  'vague-link': { weight: 3, fix: 'Link text says where it goes ("the Git worktree docs"), never "click here".' },
  'raw-html': {
    weight: 4,
    fix: 'Use the block: a Button or game block (sections), Figure (MDX) or ![alt](src) (Markdown).',
  },
  hype: { weight: 4, fix: 'Say what it does instead (docs/VOICE_AND_COPY.md, "Words to avoid").' },
  exclamation: { weight: 2, fix: 'Calm voice: no exclamation marks.' },
  contact: { weight: 10, fix: 'The site has no email, mailto, newsletter or RSS: remove it.' },
  'too-many-callouts': { weight: 3, fix: 'At most one Callout per ~400 words: keep the ones that matter.' },
  'too-many-pullquotes': { weight: 3, fix: 'At most one Pullquote per ~800 words.' },
  'pullquote-echo': {
    weight: 4,
    fix: 'A Pullquote repeats a line of the text (screen readers skip it): copy the line, or use Quote.',
  },
  'news-sources': {
    weight: 6,
    fix: 'End a news item with its sources: a list of links to where each claim comes from.',
  },
};

/** docs/VOICE_AND_COPY.md's list, used when the doc cannot be read (scripts/check-layout.mjs reads the doc itself). */
export const DEFAULT_HYPE = [
  'revolutionary',
  'game-changing',
  'groundbreaking',
  'unlock',
  'supercharge',
  '10x',
  'seamless',
  'leverage',
  'delve',
  "in today's fast-paced world",
  'the future of',
  "it's important to note",
  "let's dive in",
  'ultimate guide',
];
/** Not in the list's sentence, but in the paragraph under it. */
const EXTRA_HYPE = ['AI-powered'];

/** The words of "## Words to avoid" in docs/VOICE_AND_COPY.md (the italic line under the heading). */
export function parseHypeList(voiceDoc) {
  const section = /##\s+Words to avoid\s*\n+\s*\*([^*]+)\*/i.exec(voiceDoc ?? '');
  if (!section) return DEFAULT_HYPE;
  const words = section[1]
    .replace(/\.\s*$/, '')
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);
  return words.length ? words : DEFAULT_HYPE;
}

const POST_KINDS = { news: 'news', blog: 'blog', vlogs: 'vlog', projects: 'project', repos: 'repo', pages: 'page' };

/** The kind of a file, from its folder (src/content/<kind>/ or tests/fixtures/posts/<kind>/), else from its fields. */
export function kindOf(path, data = {}) {
  const parts = String(path ?? '').split(/[\\/]/);
  for (let i = parts.length - 2; i >= 0; i--) if (POST_KINDS[parts[i]]) return POST_KINDS[parts[i]];
  if (data.sourceUrl) return 'news';
  if (data.youtubeId || data.videoUrl || data.duration) return 'vlog';
  if (data.status) return 'project';
  if (data.repo) return 'repo';
  if (data.description && !data.summary) return 'page';
  return 'blog';
}

// ---- text helpers ---------------------------------------------------------------------------------------------------------

/** Markdown (or a bit of MDX) as plain words: links by their text, code spans as a word, tags and marks gone. */
export function plainText(md) {
  return String(md ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`[^`\n]*`/g, 'code')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const countWords = (text) =>
  plainText(text)
    .split(' ')
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|st|no|cf|fig|approx)\.$/i;

/** Sentences in a paragraph: a stop, then a space, then a capital, digit or quote (abbreviations and decimals are not stops). */
export function countSentences(md) {
  const text = plainText(md);
  if (!/[\p{L}\p{N}]/u.test(text)) return 0;
  const stop = /[.!?…]+["'”’)\]]*\s+(?=["'“‘(]?[\p{Lu}\p{N}])/gu;
  let count = 1;
  for (let m = stop.exec(text); m; m = stop.exec(text)) {
    if (ABBREVIATION.test(text.slice(Math.max(0, m.index - 8), m.index + 1))) continue;
    count++;
  }
  return count;
}

const normalise = (text) =>
  plainText(text)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Names the site writes with a capital, whatever the post says. */
const KNOWN_NAMES = [
  'R7',
  'Orbit',
  'Claude',
  'Codex',
  'GitHub',
  'YouTube',
  'TypeScript',
  'JavaScript',
  'Electron',
  'Astro',
  'Hunter',
  'Newton',
];

/** Capitalised words a post uses in the middle of a sentence: its proper nouns ("Vesper Drift", "Ask Orbit"). */
export function namesIn(paragraphs) {
  const names = new Set(KNOWN_NAMES);
  for (const paragraph of paragraphs) {
    const words = plainText(paragraph).split(' ');
    for (let i = 1; i < words.length; i++) {
      if (/[.!?:…]["'”’)]*$/.test(words[i - 1])) continue;
      const word = words[i].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (/^\p{Lu}/u.test(word)) names.add(word);
    }
  }
  return names;
}

/** True when a heading or title is in Title Case: most of its ordinary words after the first are capitalised. */
export function isTitleCase(heading, names = new Set(KNOWN_NAMES)) {
  const words = plainText(String(heading).replace(/`[^`]*`/g, ' '))
    .split(' ')
    .filter(Boolean);
  let eligible = 0;
  let capitals = 0;
  for (let i = 1; i < words.length; i++) {
    if (/[.!?…]["'”’)]*$/.test(words[i - 1])) continue;
    const word = words[i].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!/\p{L}/u.test(word) || /\p{N}/u.test(word)) continue;
    if (/^I(?:['’]\w+)?$/.test(word) || (word.length > 1 && word === word.toUpperCase())) continue;
    if (names.has(word)) continue;
    eligible++;
    if (/^\p{Lu}/u.test(word)) capitals++;
  }
  return capitals > 0 && capitals / eligible >= 0.5;
}

/** What is wrong with an alt text, or undefined. An empty one is handled by the caller (it may be decorative). */
export function altProblem(alt) {
  const text = String(alt ?? '').trim();
  if (!text) return undefined;
  if (/^(?:an?\s+|the\s+)?(?:image|picture|photo|photograph|graphic|img|pic)\s+(?:of|showing|shows)\b/i.test(text)) {
    return `alt text starts with "${text.split(/\s+/).slice(0, 2).join(' ')}"`;
  }
  if (
    /\.(?:png|jpe?g|webp|avif|svg|gif|heic)$/i.test(text) ||
    /^(?:img|dsc|pxl|screenshot)[-_ ]?\d/i.test(text) ||
    /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/i.test(text)
  ) {
    return `alt text looks like a file name ("${text}")`;
  }
  if (/^(?:decorative|placeholder|image|picture|photo|screenshot|logo)$/i.test(text) || text.split(/\s+/).length < 2) {
    return `alt text "${text}" says too little`;
  }
  return undefined;
}

const VAGUE_LINK = /^(?:click here|here|this|this link|link|read more|more|go|see here|this page|this post)$/i;

function hypeMatchers(words) {
  return [...words, ...EXTRA_HYPE].map((word) => {
    const body = word
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/'/g, "['’]")
      .replace(/-/g, '[- ]?');
    const single = /^[\w-]+$/.test(word);
    // A single word also matches its forms: unlocks, leveraging, seamlessly, delved.
    const stem = single && /e$/.test(word) ? `(?:${body}|${body.slice(0, -1)})` : body;
    const forms = single ? `${stem}(?:s|d|ed|ing|ly|r|rs)?` : body;
    return { word, re: new RegExp(`(?<![\\w-])${forms}(?![\\w-])`, 'i') };
  });
}

// ---- reading a file -------------------------------------------------------------------------------------------------------

/** Front matter and body, with the line the body starts on (1-based). */
export function splitFile(text) {
  const raw = String(text);
  const source = (raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw).replace(/\r\n?/g, '\n');
  const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(source);
  if (!match) return { frontMatter: '', body: source, bodyLine: 1, source };
  const bodyLine = match[0].split('\n').length - (match[0].endsWith('\n') ? 1 : 0) + 1;
  return { frontMatter: match[1], body: source.slice(match[0].length), bodyLine, source };
}

/** The attributes of an MDX opening tag: name="x", name='x', name={expr}, bare name (true). */
export function jsxAttributes(tag) {
  const attrs = {};
  const s = tag.replace(/^<\w+/, '').replace(/\/?>$/, '');
  let i = 0;
  while (i < s.length) {
    const name = /^\s*([A-Za-z_][\w-]*)/.exec(s.slice(i));
    if (!name) break;
    i += name[0].length;
    if (s[i] !== '=') {
      attrs[name[1]] = true;
      continue;
    }
    i++;
    const quote = s[i];
    if (quote === '"' || quote === "'") {
      const end = s.indexOf(quote, i + 1);
      attrs[name[1]] = s.slice(i + 1, end === -1 ? undefined : end);
      i = end === -1 ? s.length : end + 1;
    } else if (quote === '{') {
      const end = matchingBrace(s, i);
      const expr = s.slice(i + 1, end).trim();
      attrs[name[1]] = /^(["'`])([\s\S]*)\1$/.test(expr)
        ? expr.slice(1, -1)
        : expr === 'true'
          ? true
          : expr === 'false'
            ? false
            : { expr };
      i = end + 1;
    } else break;
  }
  return attrs;
}

/** The index of the brace closing the one at `start`, skipping strings. */
function matchingBrace(s, start) {
  let depth = 0;
  let quote = '';
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return s.length;
}

/** Where an MDX opening tag that starts at `start` ends: the index after `>` or `/>`, and whether it closed itself. */
function tagEnd(s, start) {
  let quote = '';
  for (let i = start + 1; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '{') i = matchingBrace(s, i);
    else if (c === '>') return { end: i + 1, selfClosing: s[i - 1] === '/' };
  }
  return { end: s.length, selfClosing: true };
}

/** The objects of an array expression ({[{...}, {...}]}), as text. */
function arrayObjects(expr) {
  const objects = [];
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] !== '{') continue;
    const end = matchingBrace(expr, i);
    objects.push(expr.slice(i, end + 1));
    i = end;
  }
  return objects;
}

const objectField = (object, key) => {
  const m = new RegExp(`["']?${key}["']?\\s*:\\s*(?:(["'\`])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1|(true|false))`).exec(
    object,
  );
  return m ? (m[3] ? m[3] === 'true' : m[2]) : undefined;
};

const VISUAL_COMPONENTS = new Set([
  'Figure',
  'ImageRow',
  'ImageGallery',
  'VideoEmbed',
  'AgentCards',
  'OrbitDiagram',
  'StatDial',
  'CodeBlock',
  'Quote',
  'Pullquote',
  'Callout',
  'Divider',
  'TwoColumn',
  'Toc',
]);
const PICTURE_COMPONENTS = new Set(['Figure', 'ImageRow', 'ImageGallery', 'VideoEmbed', 'AgentCards', 'OrbitDiagram']);

/**
 * A Markdown or MDX body as items, in order. `line` is the file line the body (or the text box) starts on.
 * Item: { type, line, text?, words?, level?, picture?, name?, attrs?, inner? }
 */
export function bodyItems(body, line = 1) {
  const lines = body.split('\n');
  const items = [];
  let para = null;
  const flush = () => {
    if (para) items.push({ type: 'para', line: para.line, text: para.text.join('\n') });
    para = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const at = line + i;
    const trimmed = raw.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    // Fenced code.
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(raw);
    if (fence) {
      flush();
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith(fence[1])) j++;
      items.push({ type: 'code', line: at });
      i = j;
      continue;
    }
    // MDX comment or HTML comment.
    if (trimmed.startsWith('{/*') || trimmed.startsWith('<!--')) {
      flush();
      const close = trimmed.startsWith('{/*') ? '*/}' : '-->';
      let j = i;
      while (j < lines.length && !lines[j].includes(close)) j++;
      i = j;
      continue;
    }
    // An MDX component (a capitalised tag) or raw HTML at the start of a line.
    const tag = /^<([A-Za-z][\w.]*)/.exec(trimmed);
    if (tag && !para) {
      const rest = lines.slice(i).join('\n');
      const offset = rest.indexOf('<');
      const open = tagEnd(rest, offset);
      const name = tag[1];
      let end = open.end;
      let inner = '';
      if (!open.selfClosing) {
        const closing = new RegExp(`</${name.replace('.', '\\.')}\\s*>`).exec(rest.slice(open.end));
        if (closing) {
          inner = rest.slice(open.end, open.end + closing.index);
          end = open.end + closing.index + closing[0].length;
        } else if (/^[a-z]/.test(name)) {
          // A one-line HTML element such as <a ...>text</a> closes on the same line; an unclosed one is the line itself.
          end = rest.indexOf('\n') === -1 ? rest.length : rest.indexOf('\n');
        }
      }
      const attrs = jsxAttributes(rest.slice(offset, open.end));
      const consumed = rest.slice(0, end).split('\n').length - 1;
      flush();
      if (/^[A-Z]/.test(name)) items.push(componentItem(name, attrs, inner, at));
      else items.push({ type: 'html', name, line: at, text: rest.slice(offset, end) });
      i += consumed;
      continue;
    }
    // Headings: ATX, or a setext underline under a one-line paragraph.
    const heading = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(raw);
    if (heading) {
      flush();
      items.push({ type: 'heading', level: heading[1].length, text: heading[2], line: at });
      continue;
    }
    if (para && para.text.length === 1 && /^ {0,3}(=+|-+)\s*$/.test(raw)) {
      items.push({ type: 'heading', level: raw.includes('=') ? 1 : 2, text: para.text[0], line: para.line });
      para = null;
      continue;
    }
    if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(raw)) {
      flush();
      items.push({ type: 'divider', line: at });
      continue;
    }
    // Blockquotes: callouts, pull quotes, quotes.
    if (/^ {0,3}>/.test(raw)) {
      flush();
      const quote = [];
      let j = i;
      while (j < lines.length && /^ {0,3}>/.test(lines[j])) quote.push(lines[j++].replace(/^ {0,3}>\s?/, ''));
      const text = quote.join('\n');
      const callout = /^\s*\[!(NOTE|TIP|WARNING)\]/i.exec(text);
      if (callout) items.push({ type: 'callout', line: at, text: text.slice(callout[0].length) });
      else if (/(?:^|\n)[—―]\s*\S[^\n]*$/.test(text)) items.push({ type: 'quote', line: at, text });
      else items.push({ type: 'quote', line: at, text });
      i = j - 1;
      continue;
    }
    // Lists and tables.
    if (/^\s*(?:[-*+]|\d{1,9}[.)])\s+/.test(raw) && !para) {
      const listLine = (l) => /^\s*(?:[-*+]|\d{1,9}[.)])\s+/.test(l ?? '') || /^\s{2,}\S/.test(l ?? '');
      let j = i;
      while (j < lines.length && (listLine(lines[j]) || (!lines[j].trim() && listLine(lines[j + 1])))) j++;
      items.push({ type: 'list', line: at, text: lines.slice(i, j).join('\n') });
      i = j - 1;
      continue;
    }
    if (/^\s*\|/.test(raw) && !para) {
      let j = i;
      while (j < lines.length && /^\s*\|/.test(lines[j])) j++;
      items.push({ type: 'table', line: at, text: lines.slice(i, j).join('\n') });
      i = j - 1;
      continue;
    }
    // A picture on its own line (with an italic caption under it, a figure).
    if (/^!\[[^\]]*\]\([^)]*\)\s*$/.test(trimmed) && !para) {
      const m = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+["']([^"']*)["'])?\s*\)/.exec(trimmed);
      items.push({
        type: 'image',
        line: at,
        picture: true,
        images: [{ alt: m?.[1] ?? '', src: m?.[2], decorative: m?.[3] === 'decorative', line: at }],
      });
      if (lines[i + 1] && /^\s*[*_][^*_].*[*_]\s*$/.test(lines[i + 1])) i++;
      continue;
    }
    if (!para) para = { line: at, text: [] };
    para.text.push(raw);
  }
  flush();
  // Pictures inside paragraphs still count as pictures.
  for (const item of items) {
    if (item.type !== 'para') continue;
    const images = [...item.text.matchAll(/!\[([^\]]*)\]\(\s*(\S+?)(?:\s+["']([^"']*)["'])?\s*\)/g)];
    if (images.length) {
      item.picture = true;
      item.images = images.map((m) => ({ alt: m[1], src: m[2], decorative: m[3] === 'decorative', line: item.line }));
    }
  }
  return items;
}

function componentItem(name, attrs, inner, line) {
  const words = countWords(inner);
  if (name === 'Paragraph') return { type: 'para', line, text: inner, lead: attrs.lead === true };
  if (name === 'Heading' || name === 'Subheading') {
    const level =
      name === 'Subheading' ? 3 : Number(typeof attrs.level === 'object' ? attrs.level.expr : (attrs.level ?? 2));
    return { type: 'heading', level, text: inner.trim(), line, component: true };
  }
  if (name === 'Prose') return { type: 'group', line, items: bodyItems(inner, line + 1) };
  const item = { type: VISUAL_COMPONENTS.has(name) ? componentType(name) : 'visual', name, attrs, inner, line, words };
  if (name === 'Figure') {
    item.picture = attrs.src !== undefined;
    item.images = [
      {
        alt: typeof attrs.alt === 'string' ? attrs.alt : attrs.alt === undefined ? undefined : '',
        src: attrs.src,
        decorative: attrs.decorative === true,
        line,
        plate: attrs.src === undefined,
      },
    ];
  } else if (name === 'ImageRow' || name === 'ImageGallery') {
    const expr = typeof attrs.images === 'object' ? attrs.images.expr : '';
    item.images = arrayObjects(expr.replace(/^\[|\]$/g, '')).map((o) => {
      const src = objectField(o, 'src');
      return {
        alt: objectField(o, 'alt'),
        src,
        decorative: objectField(o, 'decorative') === true,
        line,
        plate: src === undefined,
      };
    });
    item.picture = item.images.some((image) => image.src !== undefined);
  } else if (PICTURE_COMPONENTS.has(name)) item.picture = true;
  return item;
}

const componentType = (name) =>
  ({ Callout: 'callout', Pullquote: 'pullquote', Quote: 'quote', CodeBlock: 'code', Divider: 'divider', Toc: 'toc' })[
    name
  ] ?? 'visual';

// ---- sections -------------------------------------------------------------------------------------------------------------

/** A sections list as items, with the file line of each block. */
export function sectionItems(sections, lineOf) {
  const items = [];
  sections.forEach((block, index) => {
    const at = lineOf(index, block);
    const textLine = lineOf(index, block, 'text');
    switch (block?.type) {
      case 'heading':
        items.push({
          type: 'heading',
          level: Number(block.level ?? 2),
          text: block.text ?? '',
          line: at,
          block: index,
        });
        break;
      case 'lead':
        items.push({ type: 'para', line: at, text: block.text ?? '', lead: true, block: index });
        break;
      case 'text':
        items.push(...bodyItems(String(block.text ?? ''), textLine).map((item) => ({ ...item, block: index })));
        break;
      case 'callout':
        items.push({
          type: 'callout',
          line: at,
          text: block.text ?? '',
          title: block.title,
          words: countWords(block.text),
          block: index,
        });
        break;
      case 'pullquote':
        items.push({ type: 'pullquote', line: at, inner: block.text ?? '', block: index });
        break;
      case 'quote':
        items.push({ type: 'quote', line: at, text: block.text ?? '', block: index });
        break;
      case 'code':
        items.push({ type: 'code', line: at, block: index });
        break;
      case 'divider':
        items.push({ type: 'divider', line: at, block: index });
        break;
      case 'spacer':
        break;
      case 'toc':
        items.push({ type: 'toc', line: at, block: index });
        break;
      case 'image':
      case 'portrait':
        items.push({
          type: 'visual',
          name: block.type,
          line: at,
          picture: true,
          block: index,
          words: countWords(block.text ?? '') + countWords(block.caption ?? ''),
          images: [{ alt: block.alt, src: block.image, decorative: block.decorative === true, line: at }],
          paragraphs: block.type === 'portrait' ? [block.text ?? ''] : [],
        });
        break;
      case 'image-row':
        items.push({
          type: 'visual',
          name: block.type,
          line: at,
          picture: true,
          block: index,
          images: (block.images ?? []).map((image) => ({
            alt: image.alt,
            src: image.image,
            decorative: image.decorative === true,
            line: at,
          })),
        });
        break;
      case 'gallery':
        items.push({
          type: 'visual',
          name: block.type,
          line: at,
          picture: true,
          block: index,
          images: (block.shots ?? []).map((shot) => ({ alt: shot.alt, src: shot.image, line: at })),
        });
        break;
      case 'video':
      case 'game':
        items.push({ type: 'visual', name: block.type, line: at, picture: true, block: index });
        break;
      case 'columns':
        items.push({
          type: 'visual',
          name: block.type,
          line: at,
          block: index,
          words: countWords(block.left) + countWords(block.right),
          paragraphs: [block.left ?? '', block.right ?? ''],
        });
        break;
      default:
        items.push({ type: 'visual', name: block?.type ?? 'unknown', line: at, block: index });
    }
  });
  return items;
}

// ---- the check ------------------------------------------------------------------------------------------------------------

/**
 * Check one file. Returns { path, kind, words, findings: [{ rule, line, message, fix }], notes: [string], score }.
 * Options: path (for the kind and the report), kind (overrides), hype (the list of words to avoid).
 */
export function checkLayout(text, options = {}) {
  const findings = [];
  const notes = [];
  const add = (rule, line, message) => findings.push({ rule, line, message, fix: RULES[rule].fix });
  const { frontMatter, body, bodyLine, source } = splitFile(text);

  const counter = new LineCounter();
  const doc = parseDocument(frontMatter, { lineCounter: counter });
  if (doc.errors.length) {
    add('summary', 1, `the front matter is not valid YAML: ${doc.errors[0].message.split('\n')[0]}`);
  }
  const data = (doc.errors.length ? {} : doc.toJS()) ?? {};
  const kind = options.kind ?? kindOf(options.path, data);
  const fmLine = (offset) => counter.linePos(offset).line + 1;
  const keyLine = (key) => {
    const pair = doc.contents?.items?.find?.((p) => p.key?.value === key);
    return pair?.key?.range ? fmLine(pair.key.range[0]) : 1;
  };

  // Body items: the sections list, else the Markdown body.
  const sections = Array.isArray(data.sections) && data.sections.length ? data.sections : undefined;
  let items;
  if (sections) {
    const seq = doc.contents.items.find((p) => p.key?.value === 'sections').value;
    const lineOf = (index, _block, field) => {
      const node = seq.items[index];
      if (!field) return node?.range ? fmLine(node.range[0]) : keyLine('sections');
      const pair = node?.items?.find?.((p) => p.key?.value === field);
      if (!pair?.value?.range) return node?.range ? fmLine(node.range[0]) : keyLine('sections');
      const start = pair.value.range[0];
      const block = /^[|>]/.test(frontMatter.slice(start, start + 1));
      return fmLine(start) + (block ? 1 : 0);
    };
    items = sectionItems(sections, lineOf);
  } else {
    items = bodyItems(body, bodyLine);
  }
  items = items.flatMap((item) => (item.type === 'group' ? item.items : [item]));
  // Where the body starts: the `sections:` key, or the line after the front matter.
  const start = sections ? keyLine('sections') : bodyLine;

  const paragraphs = items.filter((item) => item.type === 'para');
  const prose = items.filter((item) => ['para', 'list', 'heading', 'callout', 'quote'].includes(item.type));
  // The words a reader reads: text, lists, headings, callouts, quotes, captions and columns; not code or pull quotes.
  const words = items.reduce(
    (n, item) => n + (prose.includes(item) && item.text !== undefined ? countWords(item.text) : (item.words ?? 0)),
    0,
  );
  const names = namesIn([
    ...paragraphs.map((p) => p.text),
    ...items.filter((i) => i.type === 'list').map((i) => i.text),
  ]);

  // Walls of text: a run of paragraphs with nothing else between them.
  let run = [];
  const endRun = () => {
    const runWords = run.reduce((n, p) => n + countWords(p.text), 0);
    if (run.length > LIMITS.runParagraphs || runWords > LIMITS.runWords) {
      const last = run[run.length - 1];
      add(
        'wall-of-text',
        run[0].line,
        `${run.length} paragraph${run.length === 1 ? '' : 's'} and ${runWords} words with nothing else between them (lines ${run[0].line}-${last.line + last.text.split('\n').length - 1})`,
      );
    }
    run = [];
  };
  for (const item of items) {
    if (item.type === 'para' && !item.picture) run.push(item);
    else endRun();
  }
  endRun();

  for (const p of paragraphs) {
    const sentences = countSentences(p.text);
    if (sentences > LIMITS.paragraphSentences) add('long-paragraph', p.line, `a paragraph of ${sentences} sentences`);
  }

  // Pictures.
  const hasPicture =
    items.some((item) => item.picture) ||
    (kind === 'project' && Array.isArray(data.gallery) && data.gallery.length > 0) ||
    kind === 'vlog';
  if (words > LIMITS.pictureWords && !hasPicture)
    add('no-picture', start, `${words} words and no picture, video or diagram in the body`);

  // Headings: levels, the h1, Title Case, the brass phrase.
  const headings = items.filter((item) => item.type === 'heading');
  let previous = 1;
  for (const h of headings) {
    if (h.level === 1) add('heading-h1', h.line, `"# ${plainText(h.text)}" is a second h1 on the page`);
    else if (h.level > previous + 1)
      add('heading-skip', h.line, `h${h.level} "${plainText(h.text)}" comes after h${previous}`);
    previous = h.level;
    if (isTitleCase(h.text, names)) add('title-case', h.line, `heading "${plainText(h.text)}" is in Title Case`);
    brassProblems(h.text, h.line, 'heading', add, false, findings);
  }
  // A heading wholly in brass, said once for the post rather than once a heading.
  const allBrass = findings.filter((f) => f.rule === 'brass-phrase' && f.whole);
  if (allBrass.length > 1) {
    findings.splice(0, findings.length, ...findings.filter((f) => !f.whole));
    add(
      'brass-phrase',
      allBrass[0].line,
      `${allBrass.length} headings are wholly in brass (lines ${allBrass.map((f) => f.line).join(', ')})`,
    );
  }

  // Contents list.
  const h2 = headings.filter((h) => h.level === 2).length;
  if (h2 >= LIMITS.tocHeadings && words >= LIMITS.tocWords) {
    const hasToc = items.some((item) => item.type === 'toc');
    if (kind === 'blog' && data.toc === false) add('no-contents', keyLine('toc'), `${h2} ## headings and toc: false`);
    else if (kind !== 'blog' && !hasToc)
      add('no-contents', start, `${h2} ## headings and no contents list (only blog posts get one by themselves)`);
  }

  // Title and summary.
  if (typeof data.title === 'string') {
    const plain = data.title.replace(/\*/g, '');
    if (plain.length > LIMITS.titleAim)
      add('title-length', keyLine('title'), `the title is ${plain.length} characters`);
    if (isTitleCase(data.title, names)) add('title-case', keyLine('title'), `the title "${plain}" is in Title Case`);
    brassProblems(data.title, keyLine('title'), 'title', add, true);
  }
  if (kind !== 'page') {
    const summary = typeof data.summary === 'string' ? data.summary.trim() : '';
    if (!summary) add('summary', keyLine('summary'), 'no summary');
    else if (summary.length > LIMITS.summaryMax)
      add(
        'summary',
        keyLine('summary'),
        `the summary is ${summary.length} characters: the build stops above ${LIMITS.summaryMax}`,
      );
    else if (summary.length > LIMITS.summaryAim)
      add('summary', keyLine('summary'), `the summary is ${summary.length} characters (aim for ${LIMITS.summaryAim})`);
    else if (normalise(summary) === normalise(data.title ?? ''))
      add('summary', keyLine('summary'), 'the summary repeats the title');
  }

  // The hero: the first screen's picture.
  const heroless = /^\s*#\s*heroless:\s*(.+?)\s*$/m.exec(frontMatter);
  const hero =
    kind === 'blog'
      ? data.featuredImage || data.cover
      : kind === 'vlog'
        ? data.youtubeId || data.poster || data.cover
        : kind === 'page'
          ? true
          : kind === 'news'
            ? data.cover || data.topic // a topic draws the item's picture (NewsSignal.astro)
            : data.cover;
  if (!hero) {
    if (heroless) notes.push(`no hero picture, by choice: ${heroless[1]}`);
    else
      add(
        'no-hero',
        1,
        kind === 'blog'
          ? 'no featuredImage and no cover'
          : `no cover (the ${kind}'s picture on its page, its card and when shared)`,
      );
  }
  for (const [image, alt] of [
    ['cover', 'coverAlt'],
    ['featuredImage', 'featuredImageAlt'],
  ]) {
    if (!data[image]) continue;
    const value = typeof data[alt] === 'string' ? data[alt].trim() : '';
    if (!value)
      add(
        'alt-missing',
        keyLine(alt in data ? alt : image),
        `${alt} is empty: ${image} is ${image === 'cover' ? 'shown on cards and when the post is shared' : 'the hero of the page'}`,
      );
    else if (altProblem(value)) add('alt-poor', keyLine(alt), `${alt}: ${altProblem(value)}`);
  }
  if (Array.isArray(data.gallery)) {
    for (const shot of data.gallery) {
      const value = String(shot?.alt ?? '').trim();
      if (!value) add('alt-missing', keyLine('gallery'), `a gallery picture (${shot?.src}) has no alt text`);
      else if (altProblem(value)) add('alt-poor', keyLine('gallery'), `gallery: ${altProblem(value)}`);
    }
  }

  // Pictures in the body: alt text, and the empty plate.
  for (const item of items) {
    for (const image of item.images ?? []) {
      if (image.plate)
        add('placeholder-plate', image.line, `${item.name ?? 'Figure'} without src: the empty placeholder plate`);
      if (image.decorative) continue;
      const value = String(image.alt ?? '').trim();
      if (!value) add('alt-missing', image.line, `the picture ${image.src ?? '(placeholder)'} has no alt text`);
      else if (altProblem(value)) add('alt-poor', image.line, altProblem(value));
    }
  }

  // Callouts and pull quotes: how many, and whether a pull quote repeats the text.
  const callouts = items.filter(
    (item) =>
      item.type === 'callout' &&
      !/IMAGE NEEDED/.test(`${item.title ?? ''} ${item.attrs?.title ?? ''} ${item.text ?? ''} ${item.inner ?? ''}`),
  );
  const allowedCallouts = Math.max(1, Math.ceil(words / LIMITS.wordsPerCallout));
  if (callouts.length > allowedCallouts)
    add(
      'too-many-callouts',
      callouts[allowedCallouts].line,
      `${callouts.length} callouts in ${words} words (${allowedCallouts} at most)`,
    );
  const pullquotes = items.filter((item) => item.type === 'pullquote');
  const allowedPullquotes = Math.max(1, Math.ceil(words / LIMITS.wordsPerPullquote));
  if (pullquotes.length > allowedPullquotes)
    add(
      'too-many-pullquotes',
      pullquotes[allowedPullquotes].line,
      `${pullquotes.length} pull quotes in ${words} words (${allowedPullquotes} at most)`,
    );
  const proseText = normalise(
    items
      .filter((item) => item.type !== 'pullquote')
      .flatMap((item) => [item.text ?? item.inner ?? '', ...(item.paragraphs ?? [])])
      .join(' '),
  );
  for (const pq of pullquotes) {
    const said = normalise(pq.inner);
    if (said && !proseText.includes(said))
      add('pullquote-echo', pq.line, `the pull quote "${plainText(pq.inner).slice(0, 60)}" is not in the text`);
  }

  // Words: hype and exclamation marks, in what a reader reads.
  const readable = [
    ...(typeof data.title === 'string' ? [{ line: keyLine('title'), text: data.title }] : []),
    ...(typeof data.summary === 'string' ? [{ line: keyLine('summary'), text: data.summary }] : []),
    ...(typeof data.subtitle === 'string' ? [{ line: keyLine('subtitle'), text: data.subtitle }] : []),
    ...(typeof data.take === 'string' ? [{ line: keyLine('take'), text: data.take }] : []),
    ...items
      .filter((item) => item.text || item.inner || item.paragraphs)
      .map((item) => ({
        line: item.line,
        text: [
          item.text,
          item.title,
          item.type === 'pullquote' || item.type === 'callout' || item.type === 'quote' ? item.inner : '',
          ...(item.paragraphs ?? []),
        ]
          .filter(Boolean)
          .join(' '),
      })),
  ];
  const hype = hypeMatchers(options.hype ?? DEFAULT_HYPE);
  for (const { line, text: t } of readable) {
    const plain = plainText(t);
    for (const { word, re } of hype) {
      const m = re.exec(plain);
      if (m) add('hype', line, `"${m[0]}" (from the words to avoid: ${word})`);
    }
    if (/[\p{L}\p{N})"'”’]!(?=\s|$|["'”’)])/u.test(plain))
      add(
        'exclamation',
        line,
        `an exclamation mark: "${plain.slice(Math.max(0, plain.search(/!/) - 30), plain.search(/!/) + 1)}"`,
      );
  }

  // The whole file, line by line: markers left in, contact, vague links, raw HTML.
  const fileLines = source.split('\n');
  let inFence = '';
  fileLines.forEach((line, i) => {
    const at = i + 1;
    if (/IMAGE NEEDED/.test(line)) add('image-needed', at, 'an IMAGE NEEDED marker is still in the post');
    if (/\bTODO:|\[PLACEHOLDER\]/.test(line))
      add('placeholder', at, `a template placeholder: "${line.trim().slice(0, 70)}"`);
    for (const problem of contactProblems(line)) add('contact', at, problem);
    if (/\bRSS\b|\bnewsletter\b|\b(?:rss|feed|atom)\.xml\b/i.test(line))
      add('contact', at, `mentions ${/newsletter/i.test(line) ? 'a newsletter' : 'RSS or a feed'}`);
    const fence = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) inFence = inFence ? (line.trim().startsWith(inFence) ? '' : inFence) : fence[1];
    if (inFence) return;
    for (const m of line.matchAll(/(?<!!)\[([^\]]*)\]\(([^)\s]*)[^)]*\)/g)) {
      const label = plainText(m[1]);
      if (!label || VAGUE_LINK.test(label))
        add('vague-link', at, label ? `link text "${label}"` : `a link with no text (${m[2]})`);
    }
    if (/<a\s[^>]*class=["'][^"']*\bbtn\b|<button\b/i.test(line)) add('raw-html', at, 'a button written as raw HTML');
    else if (/<img\b/i.test(line)) add('raw-html', at, 'a picture written as raw HTML <img>');
  });
  for (const block of sections ?? []) {
    for (const label of [block?.label, ...(block?.items ?? []).map((item) => item?.label)].filter(
      (l) => typeof l === 'string',
    )) {
      if (VAGUE_LINK.test(label.trim())) add('vague-link', keyLine('sections'), `${block.type} label "${label}"`);
    }
  }

  // News ends with its sources.
  if (
    kind === 'news' &&
    !/\]\(https:\/\//.test(sections ? JSON.stringify(sections) : body) &&
    !(sections ?? []).some((b) => b?.type === 'links')
  ) {
    add('news-sources', start, 'no link to a source in the body (the source box holds only one)');
  }

  findings.sort((a, b) => a.line - b.line);
  const score = Math.max(0, 100 - findings.reduce((n, f) => n + RULES[f.rule].weight, 0));
  return { path: options.path, kind, words, findings, notes, score, sections: Boolean(sections) };
}

/** More than one *brass phrase*, or the whole line in brass. */
function brassProblems(text, line, what, add, isTitle = false, findings = []) {
  const phrases = [...String(text).matchAll(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g)];
  if (phrases.length > 1) add('brass-phrase', line, `the ${what} has ${phrases.length} *brass phrases*`);
  else if (phrases.length === 1 && !isTitle) {
    const rest = String(text)
      .replace(phrases[0][0], '')
      .replace(/[^\p{L}\p{N}]/gu, '');
    if (!rest && phrases[0][1].trim().split(/\s+/).length > 3) {
      add('brass-phrase', line, `the whole ${what} "${phrases[0][1]}" is in brass`);
      findings.at(-1).whole = true;
    }
  }
}

// ---- the report -----------------------------------------------------------------------------------------------------------

/** The report as text: one block per file, then the summary. */
export function formatReport(results, { strict = false } = {}) {
  const out = [];
  for (const r of results) {
    out.push(
      `${r.path}  (${r.kind}${r.sections ? ', sections' : ''}, ${r.words} words)  score ${r.score}/100${r.findings.length ? '' : '  clean'}`,
    );
    for (const f of r.findings)
      out.push(`  ${String(f.line).padStart(4)}  ${f.rule.padEnd(19)} ${f.message}.\n${' '.repeat(27)}fix: ${f.fix}`);
    for (const n of r.notes) out.push(`  note  ${n}`);
  }
  const warnings = results.reduce((n, r) => n + r.findings.length, 0);
  const clean = results.filter((r) => !r.findings.length).length;
  const average = results.length ? Math.round(results.reduce((n, r) => n + r.score, 0) / results.length) : 100;
  const byRule = {};
  for (const r of results) for (const f of r.findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
  out.push('');
  out.push(
    `Checked ${results.length} file${results.length === 1 ? '' : 's'}: ${clean} clean, ${warnings} warning${warnings === 1 ? '' : 's'}, average score ${average}/100.`,
  );
  if (warnings)
    out.push(
      `Most common: ${Object.entries(byRule)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([rule, n]) => `${rule} ${n}`)
        .join(', ')}.`,
    );
  out.push(
    strict
      ? 'Strict: any warning fails (exit 1).'
      : 'Report only: nothing was changed, and the exit code is 0 (add --strict to fail on a warning).',
  );
  return out.join('\n');
}
