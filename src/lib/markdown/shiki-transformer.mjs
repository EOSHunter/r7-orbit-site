// Shiki transformer: marks the <pre> as a site code block (class "code", title and language for the bar)
// and tags diff lines so the styles can colour them from tokens.

function textOf(node) {
  if (node.type === 'text') return node.value;
  return Array.isArray(node.children) ? node.children.map(textOf).join('') : '';
}

/** @type {import('shiki').ShikiTransformer} */
export const siteCodeTransformer = {
  name: 'site-code',
  pre(node) {
    const meta = this.options.meta?.__raw ?? '';
    const title = /title=(?:"([^"]*)"|'([^']*)')/.exec(meta);
    delete node.properties.style;
    node.properties.class = 'code';
    node.properties['data-code-block'] = '';
    node.properties['data-lang'] = this.options.lang === 'plaintext' ? 'text' : this.options.lang;
    if (title) node.properties['data-title'] = title[1] ?? title[2];
  },
  line(node) {
    if (this.options.lang !== 'diff') return;
    const first = textOf(node)[0];
    if (first === '+') this.addClassToHast(node, 'add');
    else if (first === '-') this.addClassToHast(node, 'del');
  },
};
