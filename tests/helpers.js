// Shared setup: the theme is set the way the site does it (localStorage 'r7-theme', read by the inline
// script in BaseLayout.astro before first paint), and viewports are the two the brief checks.

export const themes = ['dark', 'light'];

export const viewports = [
  { name: '375', width: 375, height: 812 },
  { name: '1280', width: 1280, height: 800 },
];

/** Set the saved theme before any page script runs. */
export async function setTheme(context, theme) {
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('r7-theme', t);
    } catch {
      /* storage blocked */
    }
  }, theme);
}

/** Collect console errors, page errors, failed requests, bad responses and third-party requests. */
export function watchPage(page, baseURL) {
  const origin = new URL(baseURL).origin;
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`request failed: ${req.url()} (${req.failure()?.errorText})`));
  page.on('response', (res) => {
    if (res.status() >= 400 && res.request().resourceType() !== 'document') {
      problems.push(`bad response ${res.status()}: ${res.url()}`);
    }
  });
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return;
    if (new URL(url).origin !== origin) problems.push(`third-party request: ${url}`);
  });
  return problems;
}
