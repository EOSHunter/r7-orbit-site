/*
  Site search: the dialog (opened by "/" or [data-search-open]) and the /search/ page, one script for both.

  The index is Pagefind's, built by `npm run build` into dist/pagefind/ and loaded from our own origin the first
  time search is used. Under `npm run dev` there is no index: the panel says so instead of failing.
  Nothing here talks to another origin.
*/
const PAGEFIND_URL = '/pagefind/pagefind.js';
const KINDS = {
  news: { label: 'News', icon: 'news' },
  blog: { label: 'Blog', icon: 'blog' },
  vlogs: { label: 'Vlog', icon: 'vlog' },
  projects: { label: 'Project', icon: 'project' },
  repos: { label: 'Repo', icon: 'repo' },
};
const SVG_NS = 'http://www.w3.org/2000/svg';

let pagefind = null;
let loading = null;

function loadPagefind() {
  if (!loading) {
    // The URL is a variable so the bundler leaves the import alone: the file only exists after a full build.
    loading = import(/* @vite-ignore */ PAGEFIND_URL).then((mod) => {
      pagefind = mod;
      return mod.options({ excerptLength: 22 }).then(() => mod);
    });
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

function kindOf(url) {
  const first = new URL(url, location.origin).pathname.split('/').filter(Boolean)[0];
  return KINDS[first] || { label: 'Page', icon: 'link' };
}

function resultItem(data) {
  const kind = kindOf(data.url);
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.className = 'card link search-result';
  a.href = data.url;

  const body = document.createElement('div');
  body.className = 'card-body';

  const label = document.createElement('span');
  label.className = 'kind';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'ico sm');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', '#i-' + kind.icon);
  svg.appendChild(use);
  label.append(svg, kind.label);

  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = (data.meta && data.meta.title) || data.url;

  const excerpt = document.createElement('p');
  excerpt.className = 'card-text';
  // Pagefind escapes the page text and adds only <mark> around the matched words.
  excerpt.innerHTML = data.excerpt;

  body.append(label, title, excerpt);
  a.appendChild(body);
  li.appendChild(a);
  return li;
}

function setup(root) {
  const input = root.querySelector('[data-search-input]');
  const form = root.querySelector('[data-search-form]');
  const status = root.querySelector('[data-search-status]');
  const list = root.querySelector('[data-search-results]');
  const isPage = root.hasAttribute('data-search-page');
  const limit = isPage ? 20 : 8;
  let run = 0;

  function show(message, results) {
    status.textContent = message;
    list.replaceChildren(...(results || []));
  }

  async function search() {
    const q = input.value.trim();
    const id = ++run;
    if (isPage) {
      const url = new URL(location.href);
      if (q) url.searchParams.set('q', q);
      else url.searchParams.delete('q');
      history.replaceState(null, '', url);
    }
    if (!q) return show('Type to search…');
    let pf;
    try {
      pf = pagefind || (await loadPagefind());
    } catch {
      return show('Search needs a built site. Run npm run build, then npm run preview.');
    }
    const found = await pf.debouncedSearch(q, {}, 150);
    if (found === null || id !== run) return; // a newer keystroke took over
    if (!found.results.length) return show('Nothing found for “' + q + '”. Try fewer or different words.');
    const items = await Promise.all(found.results.slice(0, limit).map((r) => r.data()));
    if (id !== run) return;
    const total = found.results.length;
    show(
      (total === 1 ? '1 result' : total + ' results') + (total > limit ? ', showing the first ' + limit : ''),
      items.map(resultItem),
    );
  }

  input.addEventListener('input', search);
  form.addEventListener('submit', (e) => e.preventDefault());
  // Move through the results with the arrow keys; ArrowUp from the first goes back to the field.
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = Array.from(list.querySelectorAll('a'));
    if (!links.length) return;
    const at = links.indexOf(document.activeElement);
    let next;
    if (e.key === 'ArrowDown') next = at < 0 ? links[0] : links[Math.min(at + 1, links.length - 1)];
    else next = at <= 0 ? input : links[at - 1];
    e.preventDefault();
    next.focus();
  });
  input.addEventListener('focus', () => loadPagefind().catch(() => {}), { once: true });

  return { input, search };
}

const dialog = document.querySelector('[data-search-dialog]');
const page = document.querySelector('[data-search-page]');
const dialogUi = dialog && setup(dialog);
const pageUi = page && setup(page);
let opener = null;

function open(trigger) {
  if (pageUi) {
    pageUi.input.focus();
    return;
  }
  if (!dialog || dialog.open) return;
  opener = trigger || document.activeElement;
  dialog.showModal(); // modal: focus stays inside, Esc closes
  dialogUi.input.focus();
  dialogUi.input.select();
  loadPagefind().catch(() => {});
}

function close() {
  if (dialog && dialog.open) dialog.close();
}

if (dialog) {
  dialog.addEventListener('close', () => {
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  });
  // A click on the backdrop (the dialog element itself, outside the panel) closes it.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  // A search field clears itself on the first Esc; here Esc always closes the dialog.
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    close();
  });
  dialog.querySelector('[data-search-close]').addEventListener('click', close);
}

if (dialog || pageUi) {
  document.addEventListener('click', (e) => {
    const trigger = e.target instanceof Element && e.target.closest('[data-search-open]');
    if (!trigger || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    open(trigger);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const t = e.target;
    if (t instanceof Element && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    open();
  });
}

if (pageUi) {
  const q = new URLSearchParams(location.search).get('q');
  if (q) {
    pageUi.input.value = q;
    pageUi.search();
  }
}
