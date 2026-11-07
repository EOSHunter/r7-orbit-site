// The credit line under a blog post's featured image (docs/CONTENT_MODEL.md, `featuredImageBy`): "Image by <the site's owner>"
// (site.json `author.name`, not the post's author, who may be an agent), or "Image by <agent>" when an agent made it. Pure: the
// schema (src/content.config.ts), ArticlePage, the admin preview and the admin's save check (src/admin/image-rules.ts) read it.

/** Who made a featured image: the site's owner (`me`), or an agent named in `featuredImageAgent`. */
export const IMAGE_BY = ['me', 'agent'] as const;
export type ImageBy = (typeof IMAGE_BY)[number];

interface CreditFields {
  featuredImageBy?: unknown;
  featuredImageAgent?: unknown;
}

const agentOf = (data: CreditFields): string => (typeof data.featuredImageAgent === 'string' ? data.featuredImageAgent.trim() : '');

/** Who the credit names: the agent's name, or the owner's. An agent credit with no name falls back to the owner (the build refuses
 *  that file anyway). */
export function imageCreditName(data: CreditFields, ownerName: string): string {
  const agent = agentOf(data);
  return data.featuredImageBy === 'agent' && agent ? agent : ownerName;
}

/** The words shown under the picture. */
export function imageCredit(data: CreditFields, ownerName: string): string {
  return `Image by ${imageCreditName(data, ownerName)}`;
}

/** Where the credit's name links (2026-11-07): an agent's author page (matched by name), or the About page for the owner or an
 *  agent with no author file. */
export function imageCreditHref(data: CreditFields, ownerName: string, agents: { name: string; path: string }[]): string {
  const name = imageCreditName(data, ownerName);
  if (data.featuredImageBy !== 'agent' || name === ownerName) return '/about/';
  return agents.find((a) => a.name === name)?.path ?? '/about/';
}

/** True when the image is credited to an agent but no agent is named: the build and the editor's save both stop on it. */
export function agentMissing(data: CreditFields): boolean {
  return data.featuredImageBy === 'agent' && !agentOf(data);
}
