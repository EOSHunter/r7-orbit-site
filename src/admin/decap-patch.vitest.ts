import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENTRY_DRAFT, patchEntryDraft } from './decap-patch.mjs';

const FILE = 'node_modules/decap-cms-core/dist/esm/reducers/entryDraft.js';

describe('the fix to Decap that keeps two uploads of the same picture (decap-patch.mjs)', () => {
  it('applies to the installed Decap: an upload is replaced only by one with the same content and the same path', () => {
    expect(ENTRY_DRAFT.test(FILE)).toBe(true);
    expect(ENTRY_DRAFT.test('C:\\x\\node_modules\\decap-cms-core\\dist\\esm\\reducers\\entryDraft.js')).toBe(true);
    const patched = patchEntryDraft(readFileSync(FILE, 'utf8'));
    expect(patched).toContain("file.get('id') === action.payload.id && file.get('path') === action.payload.path");
  });

  it('stops the bundle, with a reason, when Decap no longer has the line it replaces', () => {
    expect(() => patchEntryDraft('export default {}')).toThrow(/decap-cms-core changed/);
  });
});
