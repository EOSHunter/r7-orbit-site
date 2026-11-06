// Publish only a save that builds. Each save in /admin is a pull request from a cms/<collection>/<slug> branch, and GitHub runs the
// check "Site builds" on it (.github/workflows/build.yml: the same `npm run build` Cloudflare runs). Before Decap merges the pull
// request (its `prePublish` event, which it awaits; a throw stops the merge and shows "Failed to publish: <message>"), this asks
// GitHub how that check went on the branch's latest commit, and lets the merge go ahead only when it passed. So a save that would
// fail to deploy cannot reach the live site, whatever the cause, including ones the save checks do not know about.
//
// GitHub would enforce this itself with a ruleset, but not on a private repository on the free plan (2026-11-06), so the editor,
// the only way the author publishes, does it. Anything uncertain (the check not started or still running, GitHub not answering)
// refuses with what to do, rather than publishing a build no one has seen pass.

export const BUILD_CHECK = 'Site builds';

interface CheckRun {
  status?: string;
  conclusion?: string | null;
  html_url?: string;
  started_at?: string;
}

/** Why the merge may not go ahead yet, or undefined when the check passed on the branch's latest commit. */
export function publishBlocker(runs: CheckRun[] | undefined, now = Date.now()): string | undefined {
  if (!runs) return 'GitHub did not answer about the build check of this save, so it is not published. Try Publish again in a moment.';
  // The newest run first (a re-run adds one).
  const run = [...runs].sort((a, b) => Date.parse(b.started_at ?? '') - Date.parse(a.started_at ?? ''))[0];
  if (!run) {
    return `GitHub has not started the "${BUILD_CHECK}" check of this save yet. Wait a minute, then press Publish again.`;
  }
  if (run.status !== 'completed') {
    const minutes = run.started_at ? Math.max(0, Math.round((now - Date.parse(run.started_at)) / 60_000)) : undefined;
    return (
      `GitHub is still checking that the site builds with this save${minutes !== undefined ? ` (started ${minutes} min ago; it takes about 4)` : ''}. ` +
      'Wait for it, then press Publish again.'
    );
  }
  if (run.conclusion === 'success') return undefined;
  return (
    `The site does not build with this save ("${BUILD_CHECK}" ${run.conclusion ?? 'failed'}), so publishing it would fail the deploy. ` +
    `The live site is unchanged. ${run.html_url ? `The error is at ${run.html_url} . ` : ''}Fix the post and save again.`
  );
}

/** The check runs named BUILD_CHECK on the latest commit of a branch, or undefined when GitHub cannot be asked. */
export async function buildCheckRuns(
  { repo, token, branch, fetcher = fetch }: { repo: string; token: string; branch: string; fetcher?: typeof fetch },
): Promise<CheckRun[] | undefined> {
  try {
    const url = `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}/check-runs?check_name=${encodeURIComponent(BUILD_CHECK)}`;
    const response = await fetcher(url, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { check_runs?: CheckRun[] };
    return body.check_runs ?? [];
  } catch {
    return undefined;
  }
}

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

/** The Decap `prePublish` handler. Skipped with the local proxy (`npm run cms`): nothing is merged on GitHub there. */
export function publishGate({ repo, local }: { repo: string; local: boolean }) {
  return async ({ entry }: { entry: Entry }): Promise<undefined> => {
    if (local) return undefined;
    const token = signedInToken();
    const collection = String(entry.get('collection') ?? '');
    const slug = String(entry.get('slug') ?? '');
    if (!token || !collection || !slug) {
      throw new Error('Could not tell which save this is, so it is not published. Reload the page and press Publish again.');
    }
    const blocker = publishBlocker(await buildCheckRuns({ repo, token, branch: `cms/${collection}/${slug}` }));
    if (blocker) throw new Error(blocker);
    return undefined;
  };
}
