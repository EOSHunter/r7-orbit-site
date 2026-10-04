// A paragraph that is an image followed by an italic line becomes <figure> with <figcaption>.

function isBlank(node) {
  return node.type === 'text' && node.value.trim() === '';
}

/** @returns {(tree: import('mdast').Root) => void} */
export default function remarkFigures() {
  return (tree) => {
    const visit = (node) => {
      if (!Array.isArray(node.children)) return;
      for (const child of node.children) {
        if (child.type === 'paragraph') {
          const kids = child.children.filter((c) => !isBlank(c));
          if (kids.length === 2 && kids[0].type === 'image' && kids[1].type === 'emphasis') {
            const [image, caption] = kids;
            child.data = { hName: 'figure' };
            child.children = [image, { type: 'paragraph', data: { hName: 'figcaption' }, children: caption.children }];
            continue;
          }
        }
        visit(child);
      }
    };
    visit(tree);
  };
}
