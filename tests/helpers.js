// Shared setup: the viewports the brief checks, and a watcher for page problems.

export const viewports = [
  { name: '375', width: 375, height: 812 },
  { name: '1280', width: 1280, height: 800 },
];

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
