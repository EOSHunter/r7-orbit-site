// Rehype steps for the site: heading anchors, code blocks with a bar and copy button, and the no-hot-linking rule.
// Shiki runs before these plugins; Astro adds heading ids after them, so list rehypeHeadingIds from
// @astrojs/markdown-remark first (it is idempotent) when a plugin needs the ids.

const isElement = (node, name) => node.type === 'element' && (name === undefined || node.tagName === name);

function textOf(node) {
  if (node.type === 'text') return node.value;
  return Array.isArray(node.children) ? node.children.map(textOf).join('') : '';
}

function walk(node, fn) {
  if (!Array.isArray(node.children)) return;
  node.children = node.children.map((child) => fn(child) ?? child);
  for (const child of node.children) walk(child, fn);
}

/** @returns {(tree: import('hast').Root, file: { path?: string }) => void} */
export function rehypeHeadingAnchors() {
  return (tree) => {
    walk(tree, (node) => {
      if (!isElement(node) || !/^h[2-4]$/.test(node.tagName) || !node.properties?.id) return;
      node.properties.className = [...(node.properties.className ?? []), 'has-anchor'];
      node.children.push({
        type: 'element',
        tagName: 'a',
        properties: {
          className: ['heading-anchor'],
          href: `#${node.properties.id}`,
          ariaLabel: `Link to this section: ${textOf(node)}`,
        },
        // No text node: the # is drawn by CSS, so the heading text Astro collects for the table of contents stays clean.
        children: [],
      });
    });
  };
}

/** Wraps <pre class="code"> in .codeblock with a bar (filename or language, copy button). */
export function rehypeCodeBlocks() {
  let count = 0;
  return (tree) => {
    walk(tree, (node) => {
      // The Shiki transformer sets these with hyphenated keys.
      if (!isElement(node, 'pre') || node.properties?.['data-code-block'] === undefined) return;
      const id = `code-${++count}`;
      const title = node.properties['data-title'] || node.properties['data-lang'] || 'text';
      node.properties.id = id;
      delete node.properties['data-code-block'];
      delete node.properties['data-title'];
      delete node.properties['data-lang'];
      return {
        type: 'element',
        tagName: 'div',
        properties: { className: ['codeblock'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['codeblock-bar'] },
            children: [
              { type: 'element', tagName: 'span', properties: {}, children: [{ type: 'text', value: String(title) }] },
              {
                type: 'element',
                tagName: 'button',
                properties: { className: ['btn', 'sm', 'quiet'], type: 'button', dataCopy: `#${id}` },
                children: [
                  {
                    type: 'element',
                    tagName: 'svg',
                    properties: { className: ['ico'], ariaHidden: 'true' },
                    children: [{ type: 'element', tagName: 'use', properties: { href: '#i-copy' }, children: [] }],
                  },
                  {
                    type: 'element',
                    tagName: 'span',
                    properties: { dataCopyLabel: '' },
                    children: [{ type: 'text', value: 'Copy' }],
                  },
                ],
              },
            ],
          },
          node,
        ],
      };
    });
  };
}

/** Rule 4 in CONTENT_MODEL.md: nothing in the body hot-links an image or script from another site. */
export function rehypeNoHotlinks() {
  return (tree, file) => {
    walk(tree, (node) => {
      if (!isElement(node, 'img') && !isElement(node, 'script')) return;
      const src = String(node.properties?.src ?? '');
      if (/^(https?:)?\/\//i.test(src)) {
        throw new Error(
          `${file.path ?? 'A Markdown file'}: <${node.tagName}> loads from another site (${src}). Download the file into public/media/ and link that instead.`,
        );
      }
    });
  };
}
