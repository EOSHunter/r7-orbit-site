// Turns a newsletter issue into a Buttondown **draft** (never a send): Hunter reads it in Buttondown and presses Send himself.
// Run by .github/workflows/newsletter-draft.yml when the weekly routine pushes an issue; by hand:
//
//   BUTTONDOWN_API_KEY=... node scripts/newsletter-draft.mjs newsletter/issues/2026-11-15.md
//   node scripts/newsletter-draft.mjs --check newsletter/issues/2026-11-15.md     (no key, no network: only says if it may)
//
// The key is a Buttondown API key (Settings > API); it lives only in the GitHub secret BUTTONDOWN_API_KEY or your shell, never
// in the repository. A key with draft permission only is enough. docs/NEWSLETTER.md, "Every week".
import { readFile } from 'node:fs/promises';
import { alreadyThere, draftPayload, issueProblems, parseIssue } from '../src/lib/newsletter-draft.mjs';

const API = 'https://api.buttondown.com/v1/emails';
const args = process.argv.slice(2);
const check = args.includes('--check');
const files = args.filter((a) => a !== '--check');
if (!files.length) {
  console.error('Usage: node scripts/newsletter-draft.mjs [--check] newsletter/issues/<date>.md [...]');
  process.exit(1);
}

const key = process.env.BUTTONDOWN_API_KEY?.trim();
if (!check && !key) {
  console.error(
    'BUTTONDOWN_API_KEY is not set. Make a key in Buttondown (Settings > API) and add it to GitHub: repository Settings > Secrets and variables > Actions > New repository secret, name BUTTONDOWN_API_KEY.',
  );
  process.exit(1);
}
const headers = { Authorization: `Token ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' };

let failed = false;
for (const file of files) {
  const issue = parseIssue(await readFile(file, 'utf8'));
  const problems = issueProblems(issue);
  if (problems.length) {
    console.error(`${file}: not sent to Buttondown: ${problems.join('; ')}.`);
    failed = true;
    continue;
  }
  const payload = draftPayload(issue);
  if (check) {
    console.log(`${file}: ready to become a Buttondown draft, "${payload.subject}".`);
    continue;
  }
  const list = await fetch(API, { headers });
  if (!list.ok) {
    console.error(
      `${file}: Buttondown answered ${list.status} when listing emails: ${(await list.text()).slice(0, 300)}`,
    );
    failed = true;
    continue;
  }
  const { results = [] } = await list.json();
  if (alreadyThere(results, payload.subject)) {
    console.log(`${file}: Buttondown already has an email titled "${payload.subject}"; no second draft made.`);
    continue;
  }
  const made = await fetch(API, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!made.ok) {
    console.error(`${file}: Buttondown answered ${made.status}: ${(await made.text()).slice(0, 300)}`);
    failed = true;
    continue;
  }
  const email = await made.json();
  console.log(
    `${file}: draft made in Buttondown, "${payload.subject}" (status ${email.status ?? 'draft'}). Open Buttondown > Emails to read and send it.`,
  );
}
process.exit(failed ? 1 : 0);
