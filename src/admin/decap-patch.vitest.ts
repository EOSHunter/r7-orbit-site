import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyPatch, ENTRY_DRAFT, PATCHES, patchEntryDraft } from './decap-patch.mjs';

const FILE = 'node_modules/decap-cms-core/dist/esm/reducers/entryDraft.js';

describe('the fix to Decap that keeps two uploads of the same picture (decap-patch.mjs)', () => {
  it('applies to the installed Decap: an upload is replaced only by one with the same content and the same path', () => {
    expect(ENTRY_DRAFT.test(FILE)).toBe(true);
    expect(ENTRY_DRAFT.test('C:\\x\\node_modules\\decap-cms-core\\dist\\esm\\reducers\\entryDraft.js')).toBe(true);
    const patched = patchEntryDraft(readFileSync(FILE, 'utf8'));
    expect(patched).toContain("file.get('id') === action.payload.id && file.get('path') === action.payload.path");
  });

  it('stops the bundle, with a reason, when Decap no longer has the line it replaces', () => {
    expect(() => patchEntryDraft('export default {}')).toThrow(/Decap changed and no longer has the line/);
  });
});

describe('the fix to Decap for a draft whose branch is gone (decap-patch.mjs)', () => {
  const FILE_API = 'node_modules/decap-cms-backend-github/dist/esm/API.js';
  const patch = PATCHES.find((p) => p.name === 'a draft whose branch is gone')!;

  it('applies to the installed Decap: an "unpublished" save first checks that its branch exists', () => {
    expect(patch.file.test(FILE_API)).toBe(true);
    const patched = applyPatch(patch, readFileSync(FILE_API, 'utf8'));
    expect(patched).toContain('await this.getBranch(branch).then(() => true');
  });

  it('turns a 404 for the branch into a new draft, and lets any other error through', async () => {
    // The patched line, run on its own: `this` is Decap's API, `branch` the draft's branch.
    const line = (patch.to as string).replace('const unpublished = ', 'return ');
    const run = new Function('options', 'branch', `return (async () => { ${line} }).call(this);`) as (
      this: unknown,
      options: { unpublished?: boolean },
      branch: string,
    ) => Promise<boolean>;
    const api = (answer: () => Promise<unknown>) => ({ getBranch: answer });
    const gone = api(() => Promise.reject(Object.assign(new Error('Not Found'), { status: 404 })));
    const there = api(() => Promise.resolve({ name: 'cms/blog/a' }));
    const down = api(() => Promise.reject(Object.assign(new Error('Server Error'), { status: 500 })));
    expect(await run.call(gone, { unpublished: true }, 'cms/blog/a')).toBe(false);
    expect(await run.call(there, { unpublished: true }, 'cms/blog/a')).toBe(true);
    expect(await run.call(there, { unpublished: false }, 'cms/blog/a')).toBe(false);
    await expect(run.call(down, { unpublished: true }, 'cms/blog/a')).rejects.toThrow('Server Error');
  });
});
