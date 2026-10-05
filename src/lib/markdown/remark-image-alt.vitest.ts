import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { compile } from '@mdx-js/mdx';
import { describe, expect, it } from 'vitest';
import remarkImageAlt from './remark-image-alt.mjs';

const post = new URL('file:///C:/site/src/content/blog/a-post.mdx');

async function markdown(source: string, fileURL: URL | null = post) {
  const processor = await createMarkdownProcessor({ remarkPlugins: [remarkImageAlt] });
  return (await processor.render(source, fileURL ? { fileURL } : undefined)).code;
}

const mdx = (source: string, path = '/site/src/content/blog/a-post.mdx') =>
  compile({ value: source, path }, { remarkPlugins: [remarkImageAlt], jsx: true });

describe('remark-image-alt: Markdown images', () => {
  it('stops the build on an image with no alt text, naming the post, the image and what to write', async () => {
    const error = await markdown('![](/media/a.jpg)').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('src/content/blog/a-post.mdx');
    expect(message).toContain('"/media/a.jpg" has no alt text');
    expect(message).toContain('![what the picture shows](/media/a.jpg)');
    expect(message).toContain('"decorative"');
  });

  it('lets an image with alt text through', async () => {
    expect(await markdown('![A chart of stars](/media/a.jpg)')).toContain('alt="A chart of stars"');
  });

  it('lets a decorative image through with an empty alt and no title', async () => {
    const html = await markdown('![](/media/a.jpg "decorative")');
    expect(html).toMatch(/<img [^>]*alt/);
    expect(html).not.toContain('title=');
  });

  it("only checks the author's posts (files under src/content), not other Markdown", async () => {
    expect(await markdown('![](/x.jpg)', new URL('file:///C:/site/src/pages/x.md'))).toContain('<img');
    expect(await markdown('![](/x.jpg)', null)).toContain('<img');
  });
});

describe('remark-image-alt: article components in MDX', () => {
  it('stops on a Figure with no alt, or an empty one, but not on decorative or a placeholder', async () => {
    await expect(mdx('<Figure src="/media/a.jpg" />')).rejects.toThrow(/has no alt text/);
    await expect(mdx('<Figure src="/media/a.jpg" alt="" />')).rejects.toThrow(/Alt text/);
    await expect(mdx('<Figure src="/media/a.jpg" alt="A chart" />')).resolves.toBeDefined();
    await expect(mdx('<Figure src="/media/a.jpg" decorative />')).resolves.toBeDefined();
    await expect(mdx('<Figure src="/media/a.jpg" decorative={true} />')).resolves.toBeDefined();
    await expect(mdx('<Figure alt="" />')).resolves.toBeDefined();
  });

  it('stops on a gallery image with no alt', async () => {
    await expect(
      mdx('<ImageGallery images={[{"src":"/media/a.jpg","alt":"A"},{"src":"/media/b.jpg","alt":""}]} />'),
    ).rejects.toThrow(/"\/media\/b\.jpg" has no alt text/);
    await expect(
      mdx('<ImageGallery images={[{"src":"/media/a.jpg","alt":"A"},{"src":"/media/b.jpg","alt":"B"}]} />'),
    ).resolves.toBeDefined();
  });

  it('does not check files outside src/content', async () => {
    await expect(mdx('<Figure src="/media/a.jpg" alt="" />', '/site/src/components/demo.mdx')).resolves.toBeDefined();
  });
});
