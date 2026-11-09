// A paragraph that is an image followed by an italic line becomes <figure> with <figcaption>.
// A credit line may follow (or stand in for) the caption: `Image: [OpenAI](https://…)` (also Chart:, Photo:, Screenshot:, Video:),
// for an official picture taken from the source's own announcement (docs/IMAGES.md, "Official images"). It is drawn as a small
// credit at the end of the caption.

const CREDIT = /^(Image|Chart|Photo|Screenshot|Video)(?: (?:from|by))?:\s*/i;

function isBlank(node) {
  return node.type === 'text' && node.value.trim() === '';
}

/** The credit's nodes (text and links), its label trimmed of leading line breaks; undefined unless it starts with a credit word. */
function creditOf(nodes) {
  const [first, ...rest] = nodes;
  if (!first || first.type !== 'text') return undefined;
  const value = first.value.replace(/^\s+/, '');
  if (!CREDIT.test(value)) return undefined;
  return [{ ...first, value }, ...rest];
}

/** @returns {(tree: import('mdast').Root) => void} */
export default function remarkFigures() {
  return (tree) => {
    const visit = (node) => {
      if (!Array.isArray(node.children)) return;
      for (const child of node.children) {
        if (child.type === 'paragraph' && !child.data?.hName) {
          const kids = child.children.filter((c) => !isBlank(c));
          if (kids[0]?.type === 'image' && kids.length >= 2) {
            const [image, ...after] = kids;
            const caption = after[0].type === 'emphasis' ? after.shift() : undefined;
            const credit = after.length ? creditOf(after) : undefined;
            if (caption || credit) {
              if (!after.length || credit) {
                const parts = [
                  ...(caption ? caption.children : []),
                  ...(caption && credit ? [{ type: 'text', value: ' ' }] : []),
                  ...(credit ? [{ type: 'paragraph', data: { hName: 'span', hProperties: { className: ['fig-credit'] } }, children: credit }] : []),
                ];
                child.data = { hName: 'figure' };
                child.children = [image, { type: 'paragraph', data: { hName: 'figcaption' }, children: parts }];
                continue;
              }
            }
          }
        }
        visit(child);
      }
    };
    visit(tree);
  };
}
