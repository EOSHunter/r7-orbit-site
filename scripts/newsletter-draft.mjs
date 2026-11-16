// Sends a newsletter issue to every Buttondown subscriber (Hunter's call, 2026-11-16: the weekly issue goes out on its own once
// Parallax passes it). Run by .github/workflows/newsletter-draft.yml when the weekly routine pushes an issue; by hand:
//
//   BUTTONDOWN_API_KEY=... node scripts/newsletter-draft.mjs newsletter/issues/2026-11-15.md           (sends it)
//   BUTTONDOWN_API_KEY=... node scripts/newsletter-draft.mjs --draft newsletter/issues/2026-11-15.md   (only a draft)
//   node scripts/newsletter-draft.mjs --check newsletter/issues/2026-11-15.md     (no key, no network: only says if it may)
//
// Only an issue marked `status: ready` with a Parallax pass goes anywhere. An issue whose subject Buttondown already has (sent,
// scheduled or a draft) is skipped, so a rerun never sends twice. If Buttondown refuses the send, the issue is made a draft
// instead and the run fails, so it shows red in GitHub and Hunter can send it from Buttondown.
//
// The key is a Buttondown API key (Settings > API) that may send emails; it lives only in the GitHub secret BUTTONDOWN_API_KEY
// or your shell, never in the repository. docs/NEWSLETTER.md, "Every week".
import { readFile } from 'node:fs/promises';
import { alreadyThere, draftPayload, issueProblems, parseIssue, sendPayload } from '../src/lib/newsletter-draft.mjs';

const API = 'https://api.buttondown.com/v1/emails';
const args = process.argv.slice(2);
const check = args.includes('--check');
const draftOnly = args.includes('--draft');
const files = args.filter((a) => a !== '--check' && a !== '--draft');
if (!files.length) {
  console.error('Usage: node scripts/newsletter-draft.mjs [--check | --draft] newsletter/issues/<date>.md [...]');
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

/** @param {object} payload */
const create = (payload) => fetch(API, { method: 'POST', headers, body: JSON.stringify(payload) });

let failed = false;
for (const file of files) {
  const issue = parseIssue(await readFile(file, 'utf8'));
  const problems = issueProblems(issue);
  if (problems.length) {
    console.error(`${file}: not sent to Buttondown: ${problems.join('; ')}.`);
    failed = true;
    continue;
  }
  const draft = draftPayload(issue);
  if (check) {
    console.log(`${file}: ready to go to Buttondown, "${draft.subject}".`);
    continue;
  }
  // Ask only for emails whose subject contains this one, so an older email on a later page is never missed.
  const list = await fetch(`${API}?subject=${encodeURIComponent(draft.subject)}`, { headers });
  if (!list.ok) {
    console.error(
      `${file}: Buttondown answered ${list.status} when listing emails, so nothing was sent: ${(await list.text()).slice(0, 300)}`,
    );
    failed = true;
    continue;
  }
  const { results = [] } = await list.json();
  if (alreadyThere(results, draft.subject)) {
    console.log(`${file}: Buttondown already has an email titled "${draft.subject}"; nothing sent or drafted again.`);
    continue;
  }
  if (draftOnly) {
    const made = await create(draft);
    if (!made.ok) {
      console.error(`${file}: Buttondown answered ${made.status}: ${(await made.text()).slice(0, 300)}`);
      failed = true;
      continue;
    }
    console.log(`${file}: draft made in Buttondown, "${draft.subject}". Open Buttondown > Emails to read and send it.`);
    continue;
  }
  const sent = await create(sendPayload(issue));
  if (sent.ok) {
    const email = await sent.json();
    console.log(
      `${file}: sent to Buttondown for every subscriber, "${draft.subject}" (status ${email.status ?? 'about_to_send'}). Buttondown > Emails shows it going out.`,
    );
    continue;
  }
  failed = true;
  console.error(`${file}: Buttondown refused the send (${sent.status}): ${(await sent.text()).slice(0, 300)}`);
  if (sent.status >= 500) continue; // the email may or may not exist; do not risk a second copy
  const made = await create(draft);
  console.error(
    made.ok
      ? `${file}: made it a draft instead. Open Buttondown > Emails > Drafts and press Send.`
      : `${file}: the draft failed too (${made.status}): ${(await made.text()).slice(0, 300)}`,
  );
}
process.exit(failed ? 1 : 0);
