// The components in src/components/article/ that a post body may use without importing them, and that the admin
// offers as editor blocks (src/admin/blocks.ts). One list, so the two cannot drift apart.
export const ARTICLE_COMPONENT_NAMES = [
  'Figure',
  'Callout',
  'Quote',
  'ImageGallery',
  'TwoColumn',
  'VideoEmbed',
  'Divider',
  'Pullquote',
  'AgentCards',
  'OrbitDiagram',
  'StatDial',
] as const;

export type ArticleComponentName = (typeof ARTICLE_COMPONENT_NAMES)[number];
