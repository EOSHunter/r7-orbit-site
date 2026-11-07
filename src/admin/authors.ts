// The authors the admin offers on every post (the `author` select) and the names the blog preview shows. Read from
// src/content/authors/*.json when the admin is built, so a new author file appears in the list after the next deploy
// (immediately under `npm run dev`). A person without a name is read from site.json, like on the site (lib/authors.ts).
import site from '../data/site.json';
import { DEFAULT_AUTHOR, resolveAuthor, sortAuthors, type AuthorData } from '../lib/authors';

export { DEFAULT_AUTHOR };

const files = import.meta.glob('../content/authors/*.json', { eager: true, import: 'default' }) as Record<string, AuthorData>;

export const adminAuthors = sortAuthors(Object.values(files).map((data) => resolveAuthor(data, site.author)));

/** Options for the `author` select: the name (and subtitle) shown, the slug stored. */
export const authorOptions = adminAuthors.map((a) => ({ label: a.subtitle ? `${a.name} · ${a.subtitle}` : a.name, value: a.slug }));

/** Options for the image credit (`featuredImageAgent`): every agent, its name stored (the credit line prints the name). */
export const agentNameOptions = adminAuthors.filter((a) => a.kind === 'agent').map((a) => ({ label: a.subtitle ? `${a.name} · ${a.subtitle}` : a.name, value: a.name }));

/** slug -> name, for the preview pane. */
export const authorNames: Record<string, string> = Object.fromEntries(adminAuthors.map((a) => [a.slug, a.name]));
