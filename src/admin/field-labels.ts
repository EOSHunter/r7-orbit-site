// The label of each top-level field of a collection, as the form shows it, so a save check can name the box ("Part number in the
// series") rather than the key in the file (seriesOrder). A file collection (Pages) merges the fields of all its files.
import type { CmsConfig } from 'decap-cms-core';

type Loose = { name?: string; label?: string; fields?: Loose[]; files?: Loose[] };

export function fieldLabels(config: Pick<CmsConfig, 'collections'>): (collection: string) => Record<string, string> {
  return (name) => {
    const collection = (config.collections as unknown as Loose[]).find((c) => c.name === name);
    const fields = [...(collection?.fields ?? []), ...(collection?.files ?? []).flatMap((f) => f.fields ?? [])];
    return Object.fromEntries(fields.filter((f) => f.name).map((f) => [f.name!, f.label ?? f.name!]));
  };
}
