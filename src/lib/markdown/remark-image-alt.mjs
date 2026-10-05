// Every image in a post body needs alt text, or must say it is decoration. A forgotten one stops the build with a message that
// names the file and says what to type. Covers Markdown images and the article components (<Figure>, <ImageGallery>,
// <ImageRow>). The same rule runs in the admin when the author saves (src/admin/image-rules.ts), so the build is the safety net.
//
// A decorative Markdown image is written `![](x.jpg "decorative")` (the title is removed from the page, it is only a marker);
// a decorative Figure has the `decorative` attribute.
import { DECORATIVE, missingAltMessage } from '../media-rules.mjs';

const COMPONENTS = new Set(['Figure', 'ImageGallery', 'ImageRow']);

/** The value of a JSX attribute written as "text", {"text"} or {true}, or undefined when it is absent. */
function attribute(node, name) {
  const attr = node.attributes?.find((a) => a.type === 'mdxJsxAttribute' && a.name === name);
  if (!attr) return undefined;
  if (attr.value === null || attr.value === undefined) return true;
  if (typeof attr.value === 'string') return attr.value;
  const source = String(attr.value.value ?? '').trim();
  if (source === 'true') return true;
  if (source === 'false') return false;
  try {
    return JSON.parse(source);
  } catch {
    return source;
  }
}

const isEmpty = (v) => typeof v !== 'string' || !v.trim();

/**
 * @param {{ always?: boolean }} [options] `always` checks every file; by default only files under src/content/ (a README
 *   fetched from GitHub and the demo pages are not the author's posts).
 * @returns {(tree: import('mdast').Root, file: import('vfile').VFile) => void}
 */
export default function remarkImageAlt(options = {}) {
  return (tree, file) => {
    const path = String(file.path ?? '').replace(/\\/g, '/');
    if (!options.always && !path.includes('/src/content/')) return;
    const where = path ? path.replace(/^.*\/(src\/content\/)/, '$1') : 'A post body';

    const visit = (node) => {
      if (node.type === 'image') {
        if (isEmpty(node.alt)) {
          if (String(node.title ?? '').trim().toLowerCase() !== DECORATIVE) {
            throw new Error(missingAltMessage(where, node.url, 'markdown'));
          }
          node.title = null; // only a marker, not a tooltip
        }
      } else if (
        (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
        node.name &&
        COMPONENTS.has(node.name)
      ) {
        if (node.name === 'Figure') {
          const src = attribute(node, 'src');
          if (typeof src === 'string' && src && isEmpty(attribute(node, 'alt')) && attribute(node, 'decorative') !== true) {
            throw new Error(missingAltMessage(where, src, 'block'));
          }
        } else {
          const images = attribute(node, 'images');
          if (Array.isArray(images)) {
            for (const image of images) {
              if (image?.src && isEmpty(image.alt) && image.decorative !== true) {
                throw new Error(missingAltMessage(where, String(image.src), 'block'));
              }
            }
          }
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}
