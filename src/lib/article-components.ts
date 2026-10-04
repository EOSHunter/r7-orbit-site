// The `components` map for rendering an MDX post body, so a post can write `<Callout>` with no `import` line (the
// admin never writes imports). Components are found by file name in src/components/article/; one that does not exist
// yet is simply absent, and the build only complains if a post actually uses it.
import { ARTICLE_COMPONENT_NAMES } from './article-component-names';

const modules = import.meta.glob<{ default: unknown }>('../components/article/*.astro', { eager: true });

export const articleComponents: Record<string, unknown> = Object.fromEntries(
  ARTICLE_COMPONENT_NAMES.flatMap((name) => {
    const mod = modules[`../components/article/${name}.astro`];
    return mod ? [[name, mod.default]] : [];
  }),
);
