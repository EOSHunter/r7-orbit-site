// Reads a block's Zod schema back into a plain description of its fields (name, label, box, required, choices, limits, defaults,
// nested rows). The schema is the one source (fields.ts); this is how the other things that need the field list get it:
//   - src/admin/sections-config.ts   the Decap form
//   - src/admin/sections-html.ts     the preview's defaults, and which boxes hold Markdown or a picture
//   - src/lib/sections/prepare.ts    which boxes to render as Markdown and which pictures to measure
//   - the drift test                 compares the form the admin really has against this
// It leans on Zod 4's `.def` and `.meta()`, so describe.vitest.ts pins what it reads.
import type { FieldMeta } from './fields';

export type Widget = 'string' | 'text' | 'markdown' | 'image' | 'boolean' | 'select' | 'number' | 'list';

export interface FieldInfo {
  name: string;
  label: string;
  hint?: string;
  widget: Widget;
  /** How the build reads the text: as Markdown, as one paragraph's inline Markdown, or (undefined) as typed. */
  format?: 'markdown' | 'inline';
  /** The author has to fill it in: not optional and no default. (A boolean or a menu with a default is not "required".) */
  required: boolean;
  optional: boolean;
  hasDefault: boolean;
  default?: unknown;
  /** Text length, number value or list length limits. */
  min?: number;
  max?: number;
  /** The pattern the text must match (a regular expression's source) and what to say when it does not. */
  pattern?: string;
  patternMessage?: string;
  /** For a menu: the choices, labelled, and whether several can be picked. */
  options?: { value: string | number; label: string }[];
  multiple?: boolean;
  source?: 'authors';
  /** For a list: its rows' fields, how a row reads when folded, and what one row is called. */
  fields?: FieldInfo[];
  summary?: string;
  itemLabel?: string;
}

/** A Zod schema as far as this file looks inside it. */
interface Node {
  def: {
    type: string;
    innerType?: Node;
    in?: Node;
    out?: Node;
    element?: Node;
    entries?: Record<string, string>;
    options?: Node[];
    values?: unknown[];
    defaultValue?: unknown;
    checks?: { _zod: { def: { check: string; pattern?: RegExp } } }[];
  };
  shape?: Record<string, Node>;
  minLength?: number | null;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  meta(): Record<string, unknown> | undefined;
}

const toNode = (schema: unknown) => schema as Node;

/** The shortest and longest an array may be (Zod keeps them as checks on the array). */
function listLimits(node: Node): { min?: number; max?: number } {
  const checks = (node.def.checks ?? []) as { _zod: { def: { check: string; minimum?: number; maximum?: number } } }[];
  return {
    min: checks.map((c) => c._zod.def).find((d) => d.check === 'min_length')?.minimum,
    max: checks.map((c) => c._zod.def).find((d) => d.check === 'max_length')?.maximum,
  };
}

/** Unwraps optional/default layers, collecting the metadata of every layer (the outermost wins). */
function unwrap(schema: Node) {
  let node = schema;
  let optional = false;
  let hasDefault = false;
  let fallback: unknown;
  const metas: Record<string, unknown>[] = [];
  for (;;) {
    const meta = node.meta();
    if (meta) metas.unshift(meta);
    const { type } = node.def;
    if (type === 'optional' && node.def.innerType) {
      optional = true;
      node = node.def.innerType;
    } else if (type === 'default' && node.def.innerType) {
      hasDefault = true;
      fallback = node.def.defaultValue;
      node = node.def.innerType;
    } else if (type === 'pipe' && node.def.out) {
      // A coerced number that must be one of a few: the pipe's meta sits on the outside, the choices on its `out`.
      node = node.def.out;
    } else break;
  }
  return { node, optional, hasDefault, fallback, meta: Object.assign({}, ...metas) as Partial<FieldMeta> };
}

/** A menu or a number with a default always has a value, so the form never leaves it blank. (A many-choice menu may be empty.) */
export const alwaysHasValue = (info: Pick<FieldInfo, 'hasDefault' | 'widget' | 'multiple'>): boolean =>
  info.hasDefault && !info.multiple && (info.widget === 'select' || info.widget === 'number');

const humanize = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1').toLowerCase();

function patternOf(node: Node): string | undefined {
  const regexes = (node.def.checks ?? []).map((c) => c._zod.def).filter((d) => d.check === 'string_format' && d.pattern);
  return regexes.at(-1)?.pattern?.source;
}

function describeField(name: string, schema: Node): FieldInfo {
  const { node, optional, hasDefault, fallback, meta } = unwrap(schema);
  const type = node.def.type;
  const common = {
    name,
    label: meta.label ?? humanize(name),
    hint: meta.hint,
    optional,
    hasDefault,
    default: hasDefault ? fallback : undefined,
  };
  const labelOf = (value: string | number) => meta.options?.[String(value)] ?? String(value);

  if (type === 'array') {
    const element = node.def.element as Node;
    const rowType = element.def.type;
    if (rowType === 'enum') {
      const values = Object.keys(element.def.entries ?? {});
      return {
        ...common,
        widget: 'select',
        required: false,
        multiple: true,
        options: values.map((value) => ({ value, label: labelOf(value) })),
      };
    }
    return {
      ...common,
      widget: 'list',
      required: !optional && !hasDefault,
      ...listLimits(node),
      fields: describeShape(element.shape ?? {}),
      summary: meta.summary,
      itemLabel: meta.itemLabel,
    };
  }
  if (type === 'enum') {
    const values = Object.keys(node.def.entries ?? {});
    return { ...common, widget: 'select', required: !optional && !hasDefault, options: values.map((value) => ({ value, label: labelOf(value) })) };
  }
  if (type === 'union') {
    const values = (node.def.options ?? []).map((o) => (o.def.values ?? [])[0] as number);
    return { ...common, widget: 'select', required: !optional && !hasDefault, options: values.map((value) => ({ value, label: labelOf(value) })) };
  }
  if (type === 'boolean') return { ...common, widget: 'boolean', required: false };
  if (type === 'number') {
    return { ...common, widget: 'number', required: !optional && !hasDefault, min: node.minValue ?? undefined, max: node.maxValue ?? undefined };
  }
  if (type === 'string') {
    return {
      ...common,
      widget: (meta.widget ?? 'string') as Widget,
      format: meta.format,
      required: !optional && !hasDefault,
      min: node.minLength ?? undefined,
      max: node.maxLength ?? undefined,
      pattern: meta.pattern ?? patternOf(node),
      patternMessage: meta.patternMessage,
      source: meta.source,
    };
  }
  throw new Error(`Block field "${name}" is a ${type}: describeShape does not know how to draw that. Add it to src/lib/sections/describe.ts.`);
}

/** The fields of an object schema's shape, in order, without the `type` key. */
export function describeShape(shape: Record<string, unknown>): FieldInfo[] {
  return Object.entries(shape)
    .filter(([name]) => name !== 'type')
    .map(([name, schema]) => describeField(name, toNode(schema)));
}

/** Every value in `data` whose field matches, rows included: `{ widget: 'image' }` finds the pictures, `{ format: 'markdown' }` the Markdown boxes. */
export function valuesWhere(
  fields: readonly FieldInfo[],
  data: Record<string, unknown>,
  match: { widget?: Widget; format?: 'markdown' | 'inline' },
): { field: FieldInfo; value: string }[] {
  const found: { field: FieldInfo; value: string }[] = [];
  for (const field of fields) {
    const value = data[field.name];
    if (field.widget === 'list' && Array.isArray(value)) {
      for (const row of value) {
        if (row && typeof row === 'object') found.push(...valuesWhere(field.fields ?? [], row as Record<string, unknown>, match));
      }
    } else if (
      typeof value === 'string' &&
      value &&
      (match.widget === undefined || field.widget === match.widget) &&
      (match.format === undefined || field.format === match.format)
    ) {
      found.push({ field, value });
    }
  }
  return found;
}
