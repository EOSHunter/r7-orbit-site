// The block catalogue of docs/SECTIONS.md, written from the definitions so the document cannot drift from the library: each block's
// label, what it draws, where it sits, every field (box, required, limits, choices, the hint the editor shows) and the block's own
// example as it is written in a file. sections-docs.vitest.ts fails when the document's catalogue is not what this returns, and
// rewrites it with `UPDATE_SECTIONS_DOC=1 npx vitest run src/lib/sections/sections-docs`. Pure, no Astro.
import { definitions, GROUPS, type Definition, type Placement } from './definitions';
import { describeShape, type FieldInfo } from './describe';

export const CATALOGUE_START = '<!-- catalogue:start (generated: see "Regenerating the catalogue") -->';
export const CATALOGUE_END = '<!-- catalogue:end -->';

const PLACEMENT_TEXT: Record<Placement, string> = {
  prose: 'In the reading column, with the other text blocks.',
  wide: 'In a row of its own, the width of the page. It ends a picture-beside-text row.',
  full: 'Edge to edge of the window, in a row of its own.',
  band: 'A full-width section with its own spacing, in a row of its own.',
  portrait: 'A picture in a side column with the text beside it; the blocks after it stay beside it until a divider, a block that leaves the column, or another portrait.',
};

// ---- A small YAML writer for the examples (the shapes the examples use: strings, numbers, booleans, lists, rows) --------------------

function scalar(value: unknown): string {
  if (typeof value !== 'string') return String(value);
  if (/^[\w./][\w ./,'()+-]*$/.test(value) && !/^(true|false|null|\d.*)$/i.test(value) && !/: /.test(value) && !value.endsWith(' ')) return value;
  return JSON.stringify(value);
}

function yamlLines(value: unknown, indent: string): string[] {
  const lines: string[] = [];
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, v] of entries) {
    if (Array.isArray(v)) {
      if (!v.length) lines.push(`${indent}${key}: []`);
      else if (v.every((x) => typeof x !== 'object')) lines.push(`${indent}${key}: [${v.map(scalar).join(', ')}]`);
      else {
        lines.push(`${indent}${key}:`);
        for (const row of v as Record<string, unknown>[]) {
          const [first, ...rest] = yamlLines(row, `${indent}    `);
          lines.push(`${indent}  - ${first.trimStart()}`, ...rest);
        }
      }
    } else if (typeof v === 'string' && v.includes('\n')) {
      lines.push(`${indent}${key}: |-`, ...v.split('\n').map((l) => (l ? `${indent}  ${l}` : '')));
    } else lines.push(`${indent}${key}: ${scalar(v)}`);
  }
  return lines;
}

/** One block as it is written in a page's front matter. */
export function exampleYaml(definition: Definition): string {
  const [first, ...rest] = yamlLines({ type: definition.id, ...definition.example }, '    ');
  return ['sections:', `  - ${first.trimStart()}`, ...rest].join('\n');
}

// ---- The tables --------------------------------------------------------------------------------------------------------------

function boxOf(f: FieldInfo): string {
  switch (f.widget) {
    case 'string':
      return f.pattern ? 'One line (checked)' : 'One line';
    case 'text':
      return f.format === 'markdown' ? 'Several lines (Markdown)' : f.format === 'inline' ? 'Several lines (inline Markdown)' : 'Several lines';
    case 'markdown':
      return 'Markdown editor';
    case 'image':
      return 'Picture: choose or upload';
    case 'boolean':
      return 'Switch';
    case 'number':
      return 'Number';
    case 'select':
      return f.source === 'authors' ? 'Menu of the authors' : f.multiple ? 'Several choices' : 'Menu';
    case 'list':
      return `List of rows${f.min !== undefined || f.max !== undefined ? ` (${f.min ?? 0} to ${f.max ?? '…'})` : ''}`;
  }
}

function notesOf(f: FieldInfo): string {
  const parts: string[] = [];
  if (f.hint) parts.push(f.hint);
  if (f.options && !f.source) parts.push(`Choices: ${f.options.map((o) => `\`${o.value}\``).join(', ')}.`);
  if (f.hasDefault && f.default !== undefined && !(Array.isArray(f.default) && !f.default.length) && f.default !== '') parts.push(`Default \`${String(f.default)}\`.`);
  if (f.widget === 'number' && (f.min !== undefined || f.max !== undefined)) parts.push(`${f.min ?? ''} to ${f.max ?? ''}.`);
  if ((f.widget === 'string' || f.widget === 'text') && f.max) parts.push(`At most ${f.max} characters.`);
  return parts.join(' ').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function rows(fields: FieldInfo[], prefix = ''): string[] {
  return fields.flatMap((f) => [
    `| \`${prefix}${f.name}\` | ${boxOf(f)} | ${f.required ? 'yes' : 'no'} | ${notesOf(f)} |`,
    ...(f.widget === 'list' ? rows(f.fields ?? [], `${prefix}${f.name}[].`) : []),
  ]);
}

function blockSection(d: Definition): string {
  const placement = d.placementNote ?? PLACEMENT_TEXT[d.placement as Placement];
  const fields = describeShape(d.schema.shape);
  return [
    `#### ${d.label} (\`${d.id}\`)`,
    '',
    d.description,
    '',
    `Sits: ${placement}${d.previewNote ? ` In the editor preview: ${d.previewNote}` : ''}`,
    '',
    '| Field | Box | Required | Notes |',
    '| --- | --- | --- | --- |',
    ...rows(fields),
    '',
    '```yaml',
    exampleYaml(d),
    '```',
  ].join('\n');
}

/** The whole catalogue: one heading per group of the "Add section" menu, one section per block. */
export function catalogueMarkdown(): string {
  return GROUPS.map((group) => {
    const blocks = definitions.filter((d) => d.group === group);
    return [`### ${group}`, '', ...blocks.map(blockSection).flatMap((s) => [s, ''])].join('\n');
  })
    .join('\n')
    .trimEnd();
}
