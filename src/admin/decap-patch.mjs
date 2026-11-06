// Fixes to Decap, applied when /admin is bundled (no fork, no new dependency). Each replaces one line of Decap's published code;
// the bundle fails if a Decap update changes that line, so a fix can never silently stop applying. tests/admin-images.spec.js
// ("both files are committed") and src/admin/decap-patch.vitest.ts check them.
//
// 1. Two uploads of the same picture. Decap keeps the pictures added in an edit in a list it commits on Save, keyed by each file's
//    content (decap-cms-core, reducers/entryDraft.js, ADD_DRAFT_ENTRY_MEDIA_FILE): adding a file whose bytes match one already in
//    the list replaced it. So the same picture chosen for two fields in one edit was committed once, at the last path; the post
//    named the other path, which never reached the repository, and the deploy failed (ImageNotFound, 2026-11-06). Keyed by content
//    *and* path, both files are committed.
//
// 2. A draft whose branch is gone. The editor remembers which posts have a draft on GitHub (a cms/ branch and pull request) and, on
//    Save, updates that branch (decap-cms-backend-github, API.js, editorialWorkflowGit). When the branch no longer exists (the draft
//    was published, or closed, from another tab or before the page was reloaded), GitHub answered the first request with 404 and
//    every save failed with "Failed to persist entry: API_ERROR: Not Found" (2026-11-06). Now a missing branch makes the save a new
//    draft: a new branch and pull request, as for a post with no draft.

export const PATCHES = [
  {
    name: 'two uploads of the same picture',
    file: /decap-cms-core[\\/]dist[\\/]esm[\\/]reducers[\\/]entryDraft\.js$/,
    from: "mediaFiles.filterNot(file => file.get('id') === action.payload.id).insert(0, fromJS(action.payload))",
    to: "mediaFiles.filterNot(file => file.get('id') === action.payload.id && file.get('path') === action.payload.path).insert(0, fromJS(action.payload))",
  },
  {
    name: 'a draft whose branch is gone',
    file: /decap-cms-backend-github[\\/]dist[\\/]esm[\\/]API\.js$/,
    from: 'const unpublished = options.unpublished || false;',
    to:
      'const unpublished = (options.unpublished || false) && (await this.getBranch(branch).then(() => true, error => { ' +
      'if (error && error.status === 404) return false; throw error; }));',
  },
];

/** Decap's code with one fix applied. Throws when the code to change is not there. */
export function applyPatch(patch, code) {
  if (!code.includes(patch.from)) {
    throw new Error(
      `src/admin/decap-patch.mjs ("${patch.name}"): Decap changed and no longer has the line this fix replaces. ` +
        'Check whether Decap still has the bug, then update or remove the fix.',
    );
  }
  return code.replace(patch.from, patch.to);
}

/** The first fix, by its old name (kept for the tests). */
export const ENTRY_DRAFT = PATCHES[0].file;
export const patchEntryDraft = (code) => applyPatch(PATCHES[0], code);

/** The Vite (and Rolldown) plugin. `optimizeDeps` takes a copy for `astro dev`, where Decap is pre-bundled. */
export function decapUploadsByPath() {
  const applied = new Set();
  return {
    name: 'decap-fixes',
    transform(code, id) {
      const path = id.split('?')[0];
      const patch = PATCHES.find((p) => p.file.test(path));
      if (!patch) return null;
      applied.add(patch.name);
      return { code: applyPatch(patch, code), map: null };
    },
    generateBundle(_options, bundle) {
      // The client bundle holds /admin; if Decap is in it, every fix must have been applied.
      if (this.environment && this.environment.name !== 'client') return;
      const hasDecap = Object.values(bundle).some(
        (chunk) => chunk.type === 'chunk' && Object.keys(chunk.modules ?? {}).some((m) => m.includes('decap-cms-core')),
      );
      const missing = PATCHES.filter((p) => !applied.has(p.name)).map((p) => p.name);
      if (hasDecap && missing.length) this.error(`decap-fixes: Decap is in the bundle but these fixes did not apply: ${missing.join(', ')}`);
    },
  };
}
