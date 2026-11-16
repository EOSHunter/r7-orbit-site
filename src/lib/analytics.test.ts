import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyticsBeacon, CLOUDFLARE_ANALYTICS_TOKEN } from './analytics.ts';

const production = { CF_PAGES: '1', CF_PAGES_BRANCH: 'main' };

test('the beacon is on public pages of the production build', () => {
  assert.deepEqual(JSON.parse(analyticsBeacon(production, false) ?? '{}'), { token: CLOUDFLARE_ANALYTICS_TOKEN });
});

test('noindex pages never get the beacon', () => {
  assert.equal(analyticsBeacon(production, true), undefined);
});

test('local builds, test runs and branch previews never get the beacon', () => {
  assert.equal(analyticsBeacon({}, false), undefined);
  assert.equal(analyticsBeacon({ CF_PAGES: '1', CF_PAGES_BRANCH: 'feat/x' }, false), undefined);
  assert.equal(analyticsBeacon({ CF_PAGES_BRANCH: 'main' }, false), undefined);
});
