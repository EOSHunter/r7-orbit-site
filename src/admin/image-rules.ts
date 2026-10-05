// The save check for pictures. Decap calls `preSave` just before it writes a post; a handler that throws stops the save and
// the editor shows the message ("Failed to persist entry: ..."). So the author hears about a missing alt text, a HEIC photo or
// an oversized file now, in the editor, rather than from a red build later. The build repeats the same rules
// (scripts/media.mjs, src/lib/markdown/remark-image-alt.mjs) because a file can also reach the repository another way.
// Pure functions here, run under Vitest (image-rules.vitest.ts); main.ts registers the listener.
import { bodyImagesMissingAlt, checkSourceFile, missingAltMessage } from '../lib/media-rules.mjs';

interface DraftMediaFile {
  name?: string;
  path?: string;
  size?: number;
  draft?: boolean;
}

/** What is wrong with the pictures in a post about to be saved. Each entry is one sentence naming the picture. */
export function imageProblems(data: Record<string, unknown>, mediaFiles: DraftMediaFile[] = []): string[] {
  const problems: string[] = [];
  // Only files added in this editing session (draft): the ones already in the repository were checked when they went in.
  for (const file of mediaFiles) {
    if (!file.draft) continue;
    const path = file.path || file.name || 'an uploaded file';
    for (const problem of checkSourceFile({ path, size: Number(file.size) || 0 })) {
      problems.push(`${problem} (Open the image picker, select it and press Delete to remove it from this post.)`);
    }
  }
  const where = String(data.title ?? '').trim() ? `"${String(data.title).trim()}"` : 'This post';
  for (const image of bodyImagesMissingAlt(typeof data.body === 'string' ? data.body : '')) {
    problems.push(missingAltMessage(where, image.src, image.form));
  }
  return problems;
}

/** The Decap `preSave` handler: throws one error listing every problem, or lets the save go ahead. */
export function imageSaveCheck({ entry }: { entry: { get(key: string): unknown } }): undefined {
  const data = (entry.get('data') as { toJS?: () => Record<string, unknown> } | undefined)?.toJS?.() ?? {};
  const files = (entry.get('mediaFiles') as { toJS?: () => DraftMediaFile[] } | undefined)?.toJS?.() ?? [];
  const problems = imageProblems(data, files);
  if (problems.length) throw new Error(`Not saved. ${problems.join(' ')}`);
  return undefined;
}
