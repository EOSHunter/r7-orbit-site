import { describe, expect, it } from 'vitest';
import { renderSectionMarkdown } from './section-markdown';

describe('renderSectionMarkdown', () => {
  it('keeps straight quotes straight, so the page shows exactly what was typed', async () => {
    const html = await renderSectionMarkdown(`It's not a person, it's an agent. R7's rules say "no".`);
    expect(html).toBe(`<p>It's not a person, it's an agent. R7's rules say "no".</p>`);
  });

  it('renders paragraphs and a bold lead-in', async () => {
    const html = await renderSectionMarkdown('First.\n\n**How a piece gets here:** I give R7 a topic.');
    expect(html).toBe('<p>First.</p>\n<p><strong>How a piece gets here:</strong> I give R7 a topic.</p>');
  });

  it('renders lists, links, headings and code', async () => {
    const html = await renderSectionMarkdown('## Title\n\n- a\n- b\n\n[site](https://example.com) and `code`');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<a href="https://example.com">site</a>');
    expect(html).toContain('<code>code</code>');
  });

  it('returns nothing for an empty box', async () => {
    expect(await renderSectionMarkdown('  \n ')).toBe('');
  });

  it('removes scripts, event handlers and script links, whatever the Markdown holds', async () => {
    const html = await renderSectionMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[go](javascript:alert(1))\n\n<a href="https://example.com" onclick="x()">ok</a>',
    );
    expect(html).not.toMatch(/<script|onerror|onclick|javascript:|<img/i);
    expect(html).toContain('href="https://example.com"');
  });
});
