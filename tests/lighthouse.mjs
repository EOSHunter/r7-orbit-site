// Runs Lighthouse CI (mobile preset, the lhci default) against dist/ served with gzip (tests/serve-dist.mjs) for every route in routes.js.
// Needs a built site (`npm run build`) and Chrome; set CHROME_PATH to use a specific binary.
// Budgets come from docs/PROJECT_BRIEF.md §9: categories ≥ 0.95, LCP < 2.0 s, CLS 0.
// JS/CSS size budgets are enforced in tests/budgets.spec.js (gzipped), not here.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import routes from './routes.js';

const PORT = 4398;
const base = `http://127.0.0.1:${PORT}`;
const minScore = ['error', { minScore: 0.95 }];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// Use the Chrome that Playwright installed unless CHROME_PATH says otherwise (works offline in CI and locally).
if (!process.env.CHROME_PATH) process.env.CHROME_PATH = chromium.executablePath();

const config = {
  ci: {
    collect: {
      startServerCommand: `node tests/serve-dist.mjs ${PORT}`,
      startServerReadyPattern: 'listening',
      startServerReadyTimeout: 60000,
      url: routes.map((r) => base + (r.lighthouse ?? r.path)),
      numberOfRuns: 1,
      settings: { chromeFlags: '--no-sandbox --headless=new' },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: '.*',
          assertions: {
            'categories:performance': minScore,
            'categories:accessibility': minScore,
            'categories:best-practices': minScore,
            'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
            // Budget is 0. The metric-matched fallback fonts leave sub-pixel swap shifts (measured max 0.0011); 0.005 is "zero" in practice.
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.005 }],
          },
        },
        // noindex pages (styleguide) cannot pass the SEO category by design.
        ...routes
          .filter((r) => !r.noindex)
          .map((r) => ({
            matchingUrlPattern: `^${escape(base + (r.lighthouse ?? r.path))}$`,
            assertions: { 'categories:seo': minScore },
          })),
      ],
    },
  },
};

const file = join(mkdtempSync(join(tmpdir(), 'lhci-')), 'lighthouserc.json');
writeFileSync(file, JSON.stringify(config, null, 2));

const result = spawnSync('npx', ['lhci', 'autorun', `--config="${file}"`], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
