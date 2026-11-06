// The last check before a post is saved: every picture the post names must reach the repository. Each one is either uploaded in
// this edit (Decap holds it as a draft media file and commits it with the post) or already in the repository. A post that names
// any other picture saves fine and then fails the deploy (ImageNotFound), as on 2026-11-06, when Decap dropped one of two uploads
// of the same picture (fixed in src/admin/decap-patch.mjs; this check would catch any other way a picture goes missing).
//
// "Already in the repository" is asked of GitHub, with the editor's own sign-in: on main, then on the post's own cms/ branch (an
// unpublished edit can hold a picture an earlier save of it uploaded). Only a definite "not found" from both refuses the save: when
// GitHub cannot be asked (offline, rate limit), the save goes ahead, and the build is the check.
import { repositoryPath } from './image-rules';

interface DraftMediaFile {
  name?: string;
  path?: string;
  draft?: boolean;
}

/** A picture of this site named in a post: the featured image (`../../assets/…`), a body picture (`/src/assets/…`), an upload in
 *  public/media (`/media/…`). Not preceded by a host or a word character, so https://example.org/media/x.png is not one. */
const PICTURE = /(?<![\w.:/-])(?:\.\.\/\.\.\/assets\/|\/src\/assets\/|\/media\/)[^\s)"'<>\]]+?\.(?:png|jpe?g|webp|gif|avif|svg)(?![\w.])/gi;

/** Every picture of this site a post names anywhere in its data (form fields, body, sections), as repository paths. */
export function picturesNamed(data: unknown): string[] {
  const found = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(PICTURE)) found.add(repositoryPath(match[0]));
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(data);
  return [...found];
}

/** true: in the repository; false: definitely not; undefined: could not tell. */
export type Exists = (path: string) => Promise<boolean | undefined>;

/** The pictures a post names that are neither uploaded in this edit nor (as far as GitHub says) in the repository. */
export async function missingPictures(data: unknown, mediaFiles: DraftMediaFile[], exists: Exists): Promise<string[]> {
  const drafts = new Set(mediaFiles.filter((f) => f.draft).map((f) => String(f.path || f.name || '').replace(/^\/+/, '')));
  const missing: string[] = [];
  for (const path of picturesNamed(data)) {
    if (drafts.has(path)) continue;
    if ((await exists(path)) === false) missing.push(path);
  }
  return missing;
}

export function missingPicturesMessage(missing: string[]): string {
  const list = missing.join(', ');
  return (
    `Not saved. ${missing.length === 1 ? 'This picture is' : 'These pictures are'} named in the post but not uploaded and not in the ` +
    `repository, so the site would fail to build: ${list}. Choose ${missing.length === 1 ? 'it' : 'them'} again in the image field ` +
    `(or remove ${missing.length === 1 ? 'it' : 'them'} from the post), then save.`
  );
}

/** Asks GitHub whether a file is on any of the branches, with the signed-in editor's token. */
export function githubExists({ repo, token, branches, fetcher = fetch }: {
  repo: string;
  token: string;
  branches: string[];
  fetcher?: typeof fetch;
}): Exists {
  return async (path) => {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    let unsure = false;
    for (const branch of branches) {
      try {
        const response = await fetcher(
          `https://api.github.com/repos/${repo}/contents/${encoded}?ref=${encodeURIComponent(branch)}`,
          { method: 'HEAD', headers: { Authorization: `token ${token}` }, cache: 'no-store' },
        );
        if (response.ok) return true;
        if (response.status !== 404) unsure = true;
      } catch {
        unsure = true;
      }
    }
    return unsure ? undefined : false;
  };
}

/** The editor's GitHub token, as Decap keeps it after sign-in; undefined when signed out or not on GitHub. */
function signedInToken(): string | undefined {
  try {
    const user = JSON.parse(localStorage.getItem('decap-cms-user') ?? 'null') as { backendName?: string; token?: string } | null;
    return user?.backendName === 'github' && user.token ? user.token : undefined;
  } catch {
    return undefined;
  }
}

interface Entry {
  get(key: string): unknown;
}

/** The Decap `preSave` handler. Skipped with the local proxy (`npm run cms`), where the files are on disk and the build is near. */
export function pictureSaveCheck({ repo, branch, local }: { repo: string; branch: string; local: boolean }) {
  return async ({ entry }: { entry: Entry }): Promise<undefined> => {
    if (local) return undefined;
    const token = signedInToken();
    if (!token) return undefined;
    const data = (entry.get('data') as { toJS?: () => unknown } | undefined)?.toJS?.() ?? {};
    const files = (entry.get('mediaFiles') as { toJS?: () => DraftMediaFile[] } | undefined)?.toJS?.() ?? [];
    const slug = String(entry.get('slug') ?? '');
    const collection = String(entry.get('collection') ?? '');
    const branches = [branch, ...(slug && collection ? [`cms/${collection}/${slug}`] : [])];
    const missing = await missingPictures(data, files, githubExists({ repo, token, branches }));
    if (missing.length) throw new Error(missingPicturesMessage(missing));
    return undefined;
  };
}
