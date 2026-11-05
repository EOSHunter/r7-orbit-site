// The home hero's moving background (fx/galaxy.ts; the home page's `background` setting, src/lib/site-pages.ts), started once
// the page has loaded and the browser is idle, so the headline is drawn first and the background never counts against it.
// Nothing happens without WebGL2, and the hero keeps its dot grid; `.on` is set only once the background is running.
const host = document.querySelector<HTMLElement>('[data-hero-fx="galaxy"]');

const start = async (host: HTMLElement) => {
  const wide = window.matchMedia('(min-width: 900px)').matches;
  const stop = (await import('./fx/galaxy')).mountGalaxy(host, { focal: wide ? [0.78, 0.55] : [0.5, 0.8] });
  if (stop) host.classList.add('on');
};

if (host && 'WebGL2RenderingContext' in window) {
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(() => start(host), { timeout: 1500 }) : setTimeout(() => start(host), 200));
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later, { once: true });
}
