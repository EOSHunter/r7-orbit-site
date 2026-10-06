import { expect, test } from '@playwright/test';
import { findContactProblems } from '../scripts/no-contact.mjs';

// The author does not want to be contacted: no built public page may hold a mailto: link or an email address (docs/DECISIONS.md).
// The build stops on the same rule (scripts/no-contact.mjs); this keeps it in the test run too.
test('no public page has a mailto: link or an email address', async () => {
  expect(await findContactProblems()).toEqual([]);
});
