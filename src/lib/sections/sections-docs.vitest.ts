import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueMarkdown, CATALOGUE_END, CATALOGUE_START, exampleYaml } from './catalogue';
import { definitions } from './definitions';

// docs/SECTIONS.md holds a catalogue written from the definitions. This keeps it from drifting: it fails when the document is stale.
// Rewrite it with:  UPDATE_SECTIONS_DOC=1 npx vitest run src/lib/sections/sections-docs

const FILE = 'docs/SECTIONS.md';
const between = (doc: string) => {
  const start = doc.indexOf(CATALOGUE_START);
  const end = doc.indexOf(CATALOGUE_END);
  if (start < 0 || end < 0) throw new Error(`${FILE} needs the two catalogue markers: ${CATALOGUE_START} and ${CATALOGUE_END}`);
  return { head: doc.slice(0, start + CATALOGUE_START.length), body: doc.slice(start + CATALOGUE_START.length, end), tail: doc.slice(end) };
};

describe('docs/SECTIONS.md', () => {
  it('has a catalogue that is exactly what the definitions say (regenerate with UPDATE_SECTIONS_DOC=1)', () => {
    const doc = readFileSync(FILE, 'utf8').replaceAll('\r\n', '\n');
    const { head, body, tail } = between(doc);
    const fresh = `\n\n${catalogueMarkdown()}\n\n`;
    if (process.env.UPDATE_SECTIONS_DOC) {
      writeFileSync(FILE, `${head}${fresh}${tail}`);
      return;
    }
    expect(body).toBe(fresh);
  });

  it('has a section and an example for every block', () => {
    const catalogue = catalogueMarkdown();
    for (const d of definitions) {
      expect(catalogue, d.id).toContain(`#### ${d.label} (\`${d.id}\`)`);
      expect(catalogue, d.id).toContain(exampleYaml(d));
    }
  });

  it('writes examples as the front matter a page holds: a real parse of each gives back the example', async () => {
    const { parseFrontmatter } = await import('@astrojs/markdown-remark');
    for (const d of definitions) {
      const { frontmatter } = parseFrontmatter(`---\n${exampleYaml(d)}\n---\n`);
      expect(frontmatter.sections, d.id).toEqual([{ type: d.id, ...d.example }]);
    }
  });

  it('is linked from the places a person or an agent starts', () => {
    expect(readFileSync('CLAUDE.md', 'utf8')).toContain('docs/SECTIONS.md');
    expect(readFileSync('docs/PUBLISHING.md', 'utf8')).toContain('SECTIONS.md');
    expect(readFileSync('docs/CONTENT_MODEL.md', 'utf8')).toContain('SECTIONS.md');
  });
});
