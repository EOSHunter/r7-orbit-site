// The save check for pictures. Decap calls `preSave` just before it writes a post; a handler that throws stops the save and
// the editor shows the message ("Failed to persist entry: ..."). So the author hears about a missing alt text, a HEIC photo or
// an oversized file now, in the editor, rather than from a red build later. The build repeats the same rules
// (scripts/media.mjs, src/lib/markdown/remark-image-alt.mjs) because a file can also reach the repository another way.
// Pure functions here, run under Vitest (image-rules.vitest.ts); main.ts registers the listener.
import { IMAGE_ALT_PAIRS, isBlank, picturesMissingAlt } from '../lib/front-matter';
import { agentMissing } from '../lib/image-credit';
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
  // The pictures of the form itself (cover, featured image): the build stops on one with no alt key (src/lib/front-matter.ts).
  for (const { image } of picturesMissingAlt(data)) {
    problems.push(`${where}: the ${FIELD_LABELS[image] ?? image} has no alt text. Describe it in "${FIELD_LABELS[image] ?? image} alt text".`);
  }
  if (typeof data.featuredImage === 'string' && !isBlank(data.featuredImage) && agentMissing(data)) {
    problems.push(`${where}: the featured image is credited to an agent, but no agent is named. Fill in "Agent that made the featured image", or choose "Me".`);
  }
  problems.push(...lostUploadProblems(data, mediaFiles));
  return problems;
}

/** What the form calls each picture of a post, as in src/admin/config.ts. */
const FIELD_LABELS: Record<string, string> = { cover: 'cover image', featuredImage: 'featured image', poster: 'poster image', avatar: 'avatar' };

/** The pictures a post's form holds directly (not those in its body or sections). Each may be left empty. */
export const FORM_IMAGE_FIELDS = ['cover', 'featuredImage', 'poster', 'avatar'] as const;

const baseName = (path: string) => path.split('/').pop() ?? path;

/** The file in the repository that a picture field's value names: `/media/x.png` is public/media/x.png, `../../assets/blog/x.png`
 *  (the featured image, written relative to the post) is src/assets/blog/x.png. */
export function repositoryPath(value: string): string {
  const v = value.trim();
  if (v.startsWith('../../assets/')) return `src/assets/${v.slice('../../assets/'.length)}`;
  if (v.startsWith('/src/')) return v.slice(1);
  return `public${v.startsWith('/') ? '' : '/'}${v}`;
}

/**
 * Decap keys a new upload by its content (decap-cms-core, entryDraft.js, ADD_DRAFT_ENTRY_MEDIA_FILE), so the same picture uploaded
 * for two fields in one edit (the featured image, stored in src/assets/blog, and the cover, in public/media/blog) is committed once,
 * where the last upload went. The other field then names a file that never arrives, and the build stops ("ImageNotFound").
 * This names that field, before the save, while the author can still fix it.
 */
export function lostUploadProblems(data: Record<string, unknown>, mediaFiles: DraftMediaFile[]): string[] {
  const drafts = mediaFiles.filter((f) => f.draft).map((f) => String(f.path || f.name || '').replace(/^\/+/, ''));
  const problems: string[] = [];
  for (const key of FORM_IMAGE_FIELDS) {
    const value = data[key];
    if (typeof value !== 'string' || isBlank(value)) continue;
    const wanted = repositoryPath(value);
    const elsewhere = drafts.find((path) => baseName(path) === baseName(wanted) && path !== wanted);
    if (elsewhere && !drafts.includes(wanted)) {
      problems.push(
        `The ${FIELD_LABELS[key]} is the same picture as one uploaded for another field in this edit, and the editor keeps only one copy (${elsewhere}). ` +
          `Remove the ${FIELD_LABELS[key]}, save, then choose it again and save once more.`,
      );
    }
  }
  return problems;
}

/** The slice of Decap's (Immutable) entry data that the clean-up below uses. */
interface EntryData {
  get(key: string): unknown;
  has(key: string): boolean;
  delete(key: string): EntryData;
}

/**
 * The Decap `preSave` handler that keeps junk out of the file: an image field the author emptied (Decap writes `cover: ''`) is
 * left out, and so is the alt text of a picture that is not there. A real picture's alt text, '' (decorative) included, is kept.
 * Returns the tidied data, which Decap saves and hands to the next handler; undefined when there is nothing to tidy.
 * The schema reads the same values as "not set" (src/lib/front-matter.ts), so a file written another way builds too.
 */
export function dropEmptyImages({ entry }: { entry: { get(key: string): unknown } }): EntryData | undefined {
  const data = entry.get('data') as EntryData | undefined;
  if (!data || typeof data.delete !== 'function') return undefined;
  let out = data;
  for (const key of FORM_IMAGE_FIELDS) {
    if (out.has(key) && isBlank(out.get(key))) out = out.delete(key);
  }
  for (const [image, alt] of IMAGE_ALT_PAIRS) {
    if (out.has(alt) && (!out.has(image) || out.get(alt) === null)) out = out.delete(alt);
  }
  return out === data ? undefined : out;
}

/** The Decap `preSave` handler: throws one error listing every problem, or lets the save go ahead. */
export function imageSaveCheck({ entry }: { entry: { get(key: string): unknown } }): undefined {
  const data = (entry.get('data') as { toJS?: () => Record<string, unknown> } | undefined)?.toJS?.() ?? {};
  const files = (entry.get('mediaFiles') as { toJS?: () => DraftMediaFile[] } | undefined)?.toJS?.() ?? [];
  const problems = imageProblems(data, files);
  if (problems.length) throw new Error(`Not saved. ${problems.join(' ')}`);
  return undefined;
}
