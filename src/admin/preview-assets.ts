// The preview pane shows the post with the site's real styles. Most of them are plain CSS files that main.ts imports,
// but two things only exist inside .astro files: the hero's global <style> block and the icon sprite. main.ts imports those
// files as text (`?raw`) and these functions take the parts out, so the preview follows the components instead of copying them.

/** The CSS in a component's `<style is:global>` block, or '' when it has none. */
export function globalStyleOf(astroSource: string): string {
  return /<style\s+is:global>([\s\S]*?)<\/style>/.exec(astroSource)?.[1].trim() ?? '';
}

/** The `<svg>…</svg>` of IconSprite.astro (everything after its frontmatter). */
export function spriteOf(astroSource: string): string {
  const start = astroSource.indexOf('<svg');
  const end = astroSource.lastIndexOf('</svg>');
  return start >= 0 && end > start ? astroSource.slice(start, end + '</svg>'.length) : '';
}
