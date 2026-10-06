// The site shows no email address and links to none (docs/DECISIONS.md, "No email, no RSS"). This is the check: it looks for a
// `mailto:` link or anything shaped like an email address in the text of a built page. Plain JavaScript, so scripts/no-contact.mjs
// (run by `npm run build`), the Playwright spec and Vitest all use the one rule.

/** The folders of dist/ that are not public pages: the editor (it has its own settings) and the tests' fixtures. */
export const NOT_PUBLIC = ['admin', 'styleguide'];

/** File types that are read as text. */
export const TEXT_EXTENSIONS = ['.html', '.xml', '.txt', '.webmanifest', '.json'];

const MAILTO = /mailto:/i;
const ADDRESS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

/** What is wrong in one file's text: an empty list when it has no mailto: link and no email address. */
export function contactProblems(text) {
  const problems = [];
  const mailto = MAILTO.exec(text);
  if (mailto) problems.push(`a mailto: link ("${snippet(text, mailto.index)}")`);
  const address = ADDRESS.exec(text);
  if (address) problems.push(`an email address ("${address[0]}")`);
  return problems;
}

const snippet = (text, at) => text.slice(at, at + 40).replace(/\s+/g, ' ');

/** Whether a path inside dist/ (as `blog/x/index.html`) is a public page this check looks at. */
export function isPublicFile(path) {
  const parts = path.split(/[\\/]/);
  return !NOT_PUBLIC.includes(parts[0]) && TEXT_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
}
