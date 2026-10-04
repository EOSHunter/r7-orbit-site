// `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]` become a .callout (brass for NOTE and TIP, .bad for WARNING).
// Any other blockquote whose last line starts with an em dash (`— Name`) becomes a pull quote with a <cite>.

const KINDS = {
  NOTE: { label: 'Note.', className: 'callout brass' },
  TIP: { label: 'Tip.', className: 'callout brass' },
  WARNING: { label: 'Warning.', className: 'callout bad' },
};

const MARKER = /^\[!(NOTE|TIP|WARNING)\][ \t]*\r?\n?/i;
const ATTRIBUTION = /(?:^|\n)[—―][ \t]*(\S[^\n]*)$/;

function walk(node, fn) {
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

/** @returns {(tree: import('mdast').Root) => void} */
export default function remarkCallouts() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'blockquote') return;
      if (!asCallout(node)) asPullQuote(node);
    });
  };
}
