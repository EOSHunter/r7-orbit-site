import { describe, expect, it } from 'vitest';
import { buildCheckRuns, publishBlocker } from './publish-gate';

const NOW = Date.parse('2026-11-06T20:00:00Z');

describe('publishBlocker: Publish merges only a save whose "Site builds" check passed', () => {
  it('lets a passed build through', () => {
    expect(publishBlocker([{ status: 'completed', conclusion: 'success', started_at: '2026-11-06T19:55:00Z' }], NOW)).toBeUndefined();
  });

  it('refuses a failed build, says the live site is unchanged, and links the log', () => {
    const message = publishBlocker([{ status: 'completed', conclusion: 'failure', html_url: 'https://github.com/o/r/runs/1' }], NOW);
    expect(message).toMatch(/does not build with this save \("Site builds" failure\).*The live site is unchanged\. The error is at https:\/\/github\.com\/o\/r\/runs\/1/);
  });

  it('refuses while the check is running or not yet started, and when GitHub does not answer', () => {
    expect(publishBlocker([{ status: 'in_progress', started_at: '2026-11-06T19:58:00Z' }], NOW)).toMatch(/still checking .*started 2 min ago/);
    expect(publishBlocker([], NOW)).toMatch(/has not started/);
    expect(publishBlocker(undefined, NOW)).toMatch(/did not answer/);
  });

  it('goes by the newest run: a re-run that passed after a failure publishes', () => {
    const runs = [
      { status: 'completed', conclusion: 'failure', started_at: '2026-11-06T19:40:00Z' },
      { status: 'completed', conclusion: 'success', started_at: '2026-11-06T19:50:00Z' },
    ];
    expect(publishBlocker(runs, NOW)).toBeUndefined();
    expect(publishBlocker([...runs].reverse(), NOW)).toBeUndefined();
  });
});

describe('buildCheckRuns', () => {
  it('asks for the check by name on the branch, with the token', async () => {
    const asked: string[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      asked.push(`${url} ${(init.headers as Record<string, string>).Authorization}`);
      return new Response(JSON.stringify({ total_count: 1, check_runs: [{ status: 'completed', conclusion: 'success' }] }));
    }) as unknown as typeof fetch;
    expect(await buildCheckRuns({ repo: 'o/r', token: 't', branch: 'cms/blog/a-post', fetcher })).toEqual([{ status: 'completed', conclusion: 'success' }]);
    expect(asked).toEqual(['https://api.github.com/repos/o/r/commits/cms%2Fblog%2Fa-post/check-runs?check_name=Site%20builds token t']);
  });

  it('is undefined when GitHub refuses or cannot be reached', async () => {
    const refused = (async () => new Response('{}', { status: 403 })) as unknown as typeof fetch;
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await buildCheckRuns({ repo: 'o/r', token: 't', branch: 'b', fetcher: refused })).toBeUndefined();
    expect(await buildCheckRuns({ repo: 'o/r', token: 't', branch: 'b', fetcher: offline })).toBeUndefined();
  });
});
