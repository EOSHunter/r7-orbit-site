// The Decap form of the block library, generated from the block definitions (src/lib/sections/definitions.ts): `sectionsField()` is
// the whole `sections` list (a variable-type list: "Add section" offers every block), and each block's fields are read back from its
// Zod schema, so a field exists in the form exactly when it exists in the schema, with the schema's label, hint, limits, pattern,
// choices and default. Nothing here lists a block or a field by name. To attach the library to another collection, put
// `sectionsField()` in its fields (and `sectionsSchema` in its schema).
//
// A list of blocks is written as `- type: <id>` followed by the block's fields, which is the shape the schema reads.
import type { CmsField } from 'decap-cms-core';
import { IMAGE_LIBRARY } from '../lib/media-rules.mjs';
import { alwaysHasValue, definitions, describeShape, MAX_SECTIONS, type FieldInfo } from '../lib/sections';
import { authorOptions } from './authors';

const field = (f: Record<string, unknown>) => f as unknown as CmsField;

/** What the Markdown boxes offer: no headings (the Heading block is for those) and no editor components. */
export const MARKDOWN_BUTTONS = ['bold', 'italic', 'code', 'link', 'bulleted-list', 'numbered-list'];

/** The menus the form fills in from what the site knows (an author's slug and name). */
export interface Sources {
  authors: { label: string; value: string }[];
}
const defaultSources = (): Sources => ({ authors: authorOptions });

type Config = Record<string, unknown>;

/** One field of a block as Decap's config. */
export function decapField(info: FieldInfo, sources: Sources = defaultSources()): CmsField {
  const config: Config = { name: info.name, label: info.label, widget: info.widget };
  if (info.hint) config.hint = info.hint;

  // Decap reads "required" as true unless told otherwise. A switch, a many-choice menu and anything the schema fills in by
  // default may be left as it is; a menu or a number with a default always has a value.
  if (!info.required && !alwaysHasValue(info)) config.required = false;
  if (info.hasDefault && info.default !== undefined) config.default = info.default;

  switch (info.widget) {
    case 'markdown':
      Object.assign(config, { modes: ['rich_text', 'raw'], buttons: MARKDOWN_BUTTONS, editor_components: [] });
      break;
    case 'image':
      // `media_library` carries the upload size limit (docs/IMAGES.md), which Decap only reads on the widget.
      Object.assign(config, { choose_url: false, media_library: IMAGE_LIBRARY });
      break;
    case 'number':
      Object.assign(config, { value_type: 'int', ...(info.min !== undefined && { min: info.min }), ...(info.max !== undefined && { max: info.max }) });
      break;
    case 'select': {
      const options = info.source === 'authors' ? sources.authors : (info.options ?? []);
      config.options = options;
      if (info.multiple) config.multiple = true;
      break;
    }
    case 'list':
      Object.assign(config, {
        fields: (info.fields ?? []).map((f) => decapField(f, sources)),
        summary: info.summary,
        ...(info.min !== undefined && { min: info.min }),
        ...(info.max !== undefined && { max: info.max }),
        ...(info.itemLabel && { label_singular: info.itemLabel }),
      });
      break;
  }

  // The schema's pattern (an address, a tag, an id) is the form's, with the same words when it does not match. A length limit
  // with no pattern becomes one, so the form says "at most 120 characters" as the build does.
  if ((info.widget === 'string' || info.widget === 'text') && info.source !== 'authors') {
    if (info.pattern) config.pattern = [info.pattern, info.patternMessage ?? 'Check this value'];
    else if (info.max) config.pattern = [`^[\\s\\S]{1,${info.max}}$`, `${info.max} characters at most`];
  }
  return field(config);
}

/** The `types` of the variable-type list: one entry per block, in the library's order. */
export function sectionTypes(sources: Sources = defaultSources()) {
  return definitions.map((def) => ({
    name: def.id,
    label: def.label,
    widget: 'object',
    summary: def.summary,
    fields: describeShape(def.schema.shape).map((info) => decapField(info, sources)),
  }));
}

export interface SectionsFieldOptions {
  name?: string;
  label?: string;
  hint?: string;
}

/** The `sections` field: the list of blocks the author adds, removes and drags into order. */
export function sectionsField({
  name = 'sections',
  label = 'Page sections',
  hint = 'The page, top to bottom. Use "Add section" to choose a block. Drag a block by its handle to move it, open it with the arrow to edit it, and use the cross to remove it. Check the preview on the right.',
}: SectionsFieldOptions = {}): CmsField {
  return field({
    name,
    label,
    widget: 'list',
    required: false,
    default: [],
    typeKey: 'type',
    label_singular: 'section',
    max: MAX_SECTIONS,
    // Each block starts as one line (its summary), so the whole page can be seen and dragged into order at a glance.
    collapsed: true,
    hint,
    types: sectionTypes(),
  });
}

// ---- Drift ---------------------------------------------------------------------------------------------------------------

type Loose = Record<string, unknown>;

/** What Decap's `required` comes to for a field: true unless the config says `required: false`. */
const isRequired = (f: Loose) => f.required !== false;

function fieldDrift(info: FieldInfo, f: Loose, path: string, out: string[]): void {
  const say = (what: string) => out.push(`${path}: ${what}`);
  if (f.name !== info.name) {
    say(`the form has "${String(f.name)}" where the schema has "${info.name}"`);
    return;
  }
  if (f.widget !== info.widget) say(`the form draws a ${String(f.widget)} box, the schema is a ${info.widget}`);
  if (f.label !== info.label) say(`the form's label is "${String(f.label)}", the schema's is "${info.label}"`);
  if ((f.hint ?? undefined) !== info.hint) say('the form\'s hint is not the schema\'s');
  if (isRequired(f) !== (info.required || alwaysHasValue(info))) say(`the form says ${isRequired(f) ? 'required' : 'optional'}, the schema says ${info.required ? 'required' : 'optional'}`);
  if (info.hasDefault && JSON.stringify(f.default) !== JSON.stringify(info.default)) say(`the form defaults to ${JSON.stringify(f.default)}, the schema to ${JSON.stringify(info.default)}`);
  if (info.widget === 'select' && info.source !== 'authors') {
    const options = (f.options as { value: unknown; label: string }[] | undefined) ?? [];
    if (JSON.stringify(options) !== JSON.stringify(info.options)) say('the form offers different choices than the schema accepts');
    if ((f.multiple === true) !== (info.multiple === true)) say('the form and the schema disagree on one choice or several');
  }
  if (info.widget === 'string' || info.widget === 'text') {
    const pattern = f.pattern as [string, string] | undefined;
    if (info.pattern && pattern?.[0] !== info.pattern) say(`the form's pattern is not the schema's (${info.pattern})`);
    if (!info.pattern && !info.max && pattern) say('the form has a pattern the schema does not');
  }
  if (info.widget === 'number' || info.widget === 'list') {
    if (info.min !== undefined && f.min !== info.min) say(`the form's minimum is ${String(f.min)}, the schema's is ${info.min}`);
    if (info.max !== undefined && f.max !== info.max) say(`the form's maximum is ${String(f.max)}, the schema's is ${info.max}`);
  }
  if (info.widget === 'list') {
    const rows = (f.fields as Loose[] | undefined) ?? [];
    const expected = info.fields ?? [];
    if (rows.length !== expected.length) say(`a row has ${rows.length} fields in the form and ${expected.length} in the schema`);
    expected.forEach((child, i) => rows[i] && fieldDrift(child, rows[i], `${path}.${child.name}`, out));
  }
}

/**
 * Where the admin's form and the schema disagree, as sentences (empty: they agree). `types` is the `types` of a `sections` list as
 * the editor has it. Run by sections-config.vitest.ts over the real config, and over deliberately broken copies to show it notices.
 */
export function sectionsDrift(types: Loose[]): string[] {
  const out: string[] = [];
  const ids = definitions.map((d) => d.id as string);
  const named = types.map((t) => String(t.name));
  if (JSON.stringify(named) !== JSON.stringify(ids)) out.push(`the form offers [${named.join(', ')}] but the library has [${ids.join(', ')}]`);
  for (const def of definitions) {
    const t = types.find((x) => x.name === def.id);
    if (!t) continue;
    if (t.label !== def.label) out.push(`${def.id}: the form calls it "${String(t.label)}", the library "${def.label}"`);
    if (t.summary !== def.summary) out.push(`${def.id}: the form's summary is not the library's`);
    const infos = describeShape(def.schema.shape);
    const fields = (t.fields as Loose[] | undefined) ?? [];
    if (fields.length !== infos.length) out.push(`${def.id}: the form has ${fields.length} fields, the schema ${infos.length}`);
    infos.forEach((info, i) => fields[i] && fieldDrift(info, fields[i], `${def.id}.${info.name}`, out));
  }
  return out;
}
