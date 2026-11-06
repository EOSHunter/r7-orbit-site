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

/** The words shown under the picture. An agent credit with no name falls back to the owner (the build refuses that file anyway). */
export function imageCredit(data: CreditFields, ownerName: string): string {
  const agent = agentOf(data);
  return `Image by ${data.featuredImageBy === 'agent' && agent ? agent : ownerName}`;
}

/** True when the image is credited to an agent but no agent is named: the build and the editor's save both stop on it. */
export function agentMissing(data: CreditFields): boolean {
  return data.featuredImageBy === 'agent' && !agentOf(data);
}
