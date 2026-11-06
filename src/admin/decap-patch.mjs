// A fix to Decap, applied when /admin is bundled. Decap keeps the pictures added in an edit in a list it commits on Save, and it
// keys that list by each file's content (decap-cms-core, reducers/entryDraft.js, ADD_DRAFT_ENTRY_MEDIA_FILE): adding a file whose
// bytes match one already in the list replaces it. So the same picture chosen for two fields in one edit (the featured image in
// src/assets/blog and a cover in public/media/blog, say, or a body picture) was committed once, at the last path; the post named
// the other path, which never reached the repository, and the deploy failed (ImageNotFound, 2026-11-06). Keyed by content *and*
// path, both files are committed. The bundle fails if Decap's code changes so the fix no longer applies (tests/admin-images.spec.js
// "both files are committed" checks the result through the real editor).

export const ENTRY_DRAFT = /decap-cms-core[\\/]dist[\\/]esm[\\/]reducers[\\/]entryDraft\.js$/;

const ADD_BY_CONTENT = "mediaFiles.filterNot(file => file.get('id') === action.payload.id).insert(0, fromJS(action.payload))";
const ADD_BY_CONTENT_AND_PATH =
  "mediaFiles.filterNot(file => file.get('id') === action.payload.id && file.get('path') === action.payload.path).insert(0, fromJS(action.payload))";

/** Decap's entryDraft reducer with uploads keyed by content and path. Throws when the code to change is not there. */
export function patchEntryDraft(code) {
  if (!code.includes(ADD_BY_CONTENT)) {
    throw new Error(
      'src/admin/decap-patch.mjs: decap-cms-core changed and its reducers/entryDraft.js no longer has the line this fix replaces. ' +
        'Check whether Decap still drops a second upload of the same picture, then update or remove the fix.',
    );
  }
  return code.replace(ADD_BY_CONTENT, ADD_BY_CONTENT_AND_PATH);
}

/** The Vite (and Rolldown) plugin. `optimizeDeps` takes a copy for `astro dev`, where Decap is pre-bundled. */
export function decapUploadsByPath() {
  let patched = false;
  return {
    name: 'decap-uploads-by-path',
    transform(code, id) {
      if (!ENTRY_DRAFT.test(id.split('?')[0])) return null;
      patched = true;
      return { code: patchEntryDraft(code), map: null };
    },
    generateBundle(_options, bundle) {
      // The client bundle holds /admin; if Decap is in it and the reducer was never seen, the fix did not apply.
      if (this.environment && this.environment.name !== 'client') return;
      const hasDecap = Object.values(bundle).some(
        (chunk) => chunk.type === 'chunk' && Object.keys(chunk.modules ?? {}).some((m) => m.includes('decap-cms-core')),
      );
      if (hasDecap && !patched) this.error('decap-uploads-by-path: Decap is in the bundle but its entryDraft.js was not patched');
    },
  };
}
