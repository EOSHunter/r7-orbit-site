// `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]` become a .callout (brass for NOTE and TIP, .bad for WARNING).
// `> [!POST] Name · @handle · Platform · 2026-11-04 · https://…` becomes a post card (src/lib/post-card.mjs); a blockquote inside
// it is the post it quotes, with an optional first line `[!QUOTED] Label · 2026-10-30 · https://…`.
// Any other blockquote whose last line starts with an em dash (`— Name`) becomes a pull quote with a <cite>.
import { parsePostHeader, parseQuotedHeader, postCardFoot, postCardHead, postCardQuotedLabel } from '../post-card.mjs';

const KINDS = {
  NOTE: { label: 'Note.', className: 'callout brass' },
  TIP: { label: 'Tip.', className: 'callout brass' },
  WARNING: { label: 'Warning.', className: 'callout bad' },
};

const MARKER = /^\[!(NOTE|TIP|WARNING)\][ \t]*\r?\n?/i;
const ATTRIBUTION = /(?:^|\n)[—―][ \t]*(\S[^\n]*)$/;

function walk(node, fn) {
  if (node.data?.postCard) return;
  fn(node);
  if (Array.isArray(node.children)) for (const child of [...node.children]) walk(child, fn);
}

function asCallout(node) {
  const first = node.children[0];
  if (!first || first.type !== 'paragraph') return false;
  const text = first.children[0];
  if (!text || text.type !== 'text') return false;
  const match = MARKER.exec(text.value);
  if (!match) return false;
  const kind = KINDS[match[1].toUpperCase()];
  text.value = text.value.slice(match[0].length);
  if (text.value === '') first.children.shift();
  first.children.unshift(
    { type: 'strong', children: [{ type: 'text', value: kind.label }] },
    { type: 'text', value: ' ' },
  );
  node.data = { hName: 'div', hProperties: { className: kind.className.split(' ') } };
  return true;
}

function asPullQuote(node) {
  const last = node.children[node.children.length - 1];
  if (!last || last.type !== 'paragraph') return;
  const tail = last.children[last.children.length - 1];
  if (!tail || tail.type !== 'text') return;
  const match = ATTRIBUTION.exec(tail.value);
  if (!match) return;
  tail.value = tail.value.slice(0, match.index);
  if (tail.value === '') last.children.pop();
  const cite = { type: 'paragraph', data: { hName: 'cite' }, children: [{ type: 'text', value: match[1] }] };
  if (last.children.length === 0) node.children.pop();
  node.children.push(cite);
}

const POST_MARKER = /^\[!POST\][ \t]*/i;
const QUOTED_MARKER = /^\[!QUOTED\][ \t]*/i;

/** The text of inline nodes as written (a link autolinked from a bare address gives its address back). */
function inlineText(nodes) {
  return nodes.map((n) => (n.type === 'text' || n.type === 'inlineCode' ? n.value : n.type === 'link' ? n.url : inlineText(n.children ?? []))).join('');
}

/**
 * Takes the first line off a blockquote's first paragraph when it starts with `marker`, and returns that line's text (after the
 * marker), or undefined when there is no marker. What follows the line stays in the paragraph; an emptied paragraph is removed.
 */
function takeHeaderLine(node, marker) {
  const first = node.children[0];
  if (!first || first.type !== 'paragraph') return undefined;
  const head = first.children[0];
  if (!head || head.type !== 'text' || !marker.test(head.value)) return undefined;
  head.value = head.value.replace(marker, '');
  const line = [];
  while (first.children.length) {
    const child = first.children[0];
    if (child.type === 'text' && child.value.includes('\n')) {
      const at = child.value.indexOf('\n');
      line.push({ type: 'text', value: child.value.slice(0, at) });
      child.value = child.value.slice(at + 1);
      if (child.value === '') first.children.shift();
      break;
    }
    if (child.type === 'break') {
      first.children.shift();
      break;
    }
    line.push(first.children.shift());
  }
  if (first.children.length === 0) node.children.shift();
  return inlineText(line);
}

/** A hast element from post-card.mjs as an mdast node that turns into it. */
const hastNode = (el) => ({ type: 'paragraph', children: [], data: { hName: el.tagName, hProperties: el.properties, hChildren: el.children, postCard: true } });

function asPostCard(node) {
  const header = takeHeaderLine(node, POST_MARKER);
  if (header === undefined) return false;
  const post = parsePostHeader(header);
  const body = node.children.map((child) => {
    if (child.type !== 'blockquote') return child;
    const quoted = parseQuotedHeader(takeHeaderLine(child, QUOTED_MARKER) ?? '');
    return {
      type: 'blockquote',
      children: [hastNode(postCardQuotedLabel(quoted)), ...child.children],
      data: { hName: 'div', hProperties: { className: ['post-card-quoted'] }, postCard: true },
    };
  });
  if (!body.some((child) => child.type !== 'blockquote')) throw new Error(`post card for ${post.name}: the post's own text is missing (write it under the [!POST] line)`);
  const foot = postCardFoot(post);
  node.children = [
    hastNode(postCardHead(post)),
    { type: 'blockquote', children: body, data: { hName: 'blockquote', hProperties: { className: ['post-card-text'], ...(post.url ? { cite: post.url } : {}) }, postCard: true } },
    ...(foot ? [hastNode(foot)] : []),
  ];
  node.data = { hName: 'figure', hProperties: { className: ['post-card'] }, postCard: true };
  return true;
}

/** @returns {(tree: import('mdast').Root) => void} */
export default function remarkCallouts() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'blockquote') return;
      if (!asPostCard(node) && !asCallout(node)) asPullQuote(node);
    });
  };
}
