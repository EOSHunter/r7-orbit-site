# The weekly newsletter routine

The brief for the scheduled Claude routine that writes each week's issue (created 2026-11-10; it runs in Anthropic's cloud on a fresh copy of this repository, Sundays at 5pm New York time). The routine's own prompt is one line, "Follow newsletter/ROUTINE.md", so changing this file changes what it does. You are the orchestrator; Mercury writes and Parallax checks, each as its own subagent.

## Steps

1. **The week.** Today is the send-eve. The issue covers the 7 days ending today, both included: `npm ci --ignore-scripts`, then `npm run newsletter:week -- <today minus 6 days> <today>` (dates as YYYY-MM-DD, UTC). If it says "Nothing went up in that range", stop: no file, no branch, no push. Say so in one line and end.
2. **Mercury writes it.** Start the `mercury` subagent (Agent tool, `subagent_type: "mercury"`) with: the week's list exactly as the script printed it, the range, and the file to write, `newsletter/issues/<today>.md`, copied from `newsletter/TEMPLATE.md` with `covers` set to the range. There are no notes from Hunter, so the "What's next" section is left out. Mercury returns the file and a claims table.
3. **Parallax checks it.** Start the `parallax` subagent (`subagent_type: "parallax"`) on the file and Mercury's claims table, without Mercury's reasoning. For an issue it checks that every line matches its post on r7orbit.io, that every link returns 200, and that nothing unpublished is in it (items 8 and 9 of its list are skipped). Send the failed rows back to Mercury to fix, then have Parallax recheck only those. At most two rounds.
4. **Mark it.** If Parallax passes: in the file's front matter set `status: ready` and `parallax: "pass, <n> rows checked"`. If it still fails after two rounds: leave `status: draft`, set `parallax: "fail, <n> fixes open"`, and add the open rows at the end of your final message.
5. **Check it is draftable.** `node scripts/newsletter-draft.mjs --check newsletter/issues/<today>.md`. With `status: ready` it must say "ready to become a Buttondown draft"; fix the front matter if it does not.
6. **Push it.** Commit only that one file on a new branch `claude/newsletter-<today>`, message `Newsletter issue for <today>`, and push the branch. Do not touch main, open a pull request, or change any other file. The push starts `.github/workflows/newsletter-draft.yml`, which makes the Buttondown draft from a ready issue (never a send).
7. **Report** in a few lines: the subject, how many items, Parallax's line, the branch, and anything Hunter should look at before he sends.

## Never

- Send, schedule or publish an email, or call Buttondown yourself: the workflow makes the draft, and Hunter sends it.
- Put a Buttondown key, or any secret, in a file, a commit or a message.
- Include anything not in the week's list, or write words for Hunter.
