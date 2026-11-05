/*
  R7 Orbit site kit: behaviour. Plain JS, no dependencies, no network.

    (b) mobile menu             [data-menu-toggle]       controls #site-nav
    (c) list filtering          [data-list]              home feed and archive: kind, tags, search, sort, count, empty state
    (d) copy buttons            [data-copy]              "#id" copies that element's text, "@url" copies this page's address, anything else is copied as is
    (f) table of contents       .toc a[href^="#"]        highlights the heading you are reading
    (g) video poster            [data-player]            loads an iframe on click when data-embed is set
    (h) search loader           [data-search-open], "/"   loads search.js (the dialog and /search/ page) on first use
    (i) reveal on scroll        .grid-cards > *, .sec-row  below the first screen, fade and rise in as they come into view

  Every piece does nothing if its markup is not on the page, and every piece survives missing storage or clipboard.
*/
(function () {
  'use strict';

  var root = document.documentElement;
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ------------------------------------------------------------------------------------------- (b) menu */
  var menuBtn = $('[data-menu-toggle]');
  var nav = menuBtn ? document.getElementById(menuBtn.getAttribute('aria-controls')) : null;

  function setMenu(open, returnFocus) {
    if (!menuBtn || !nav) return;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) nav.setAttribute('data-open', ''); else nav.removeAttribute('data-open');
    if (!open && returnFocus) menuBtn.focus();
  }

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') setMenu(false, true);
    });
    document.addEventListener('click', function (e) {
      if (menuBtn.getAttribute('aria-expanded') !== 'true') return;
      if (nav.contains(e.target) || menuBtn.contains(e.target)) { if (e.target.closest && e.target.closest('a')) setMenu(false); return; }
      setMenu(false);
    });
    if (window.matchMedia) {
      var wide = window.matchMedia('(min-width: 900px)');
      var onWide = function () { if (wide.matches) setMenu(false); };
      if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
    }
  }

  /* ----------------------------------------------------------------------------------- (c) list filtering */
  // Markup contract (see README):
  //   [data-list]                         the scope: holds everything below
  //     [data-filter="kind"] button[data-value]   a .seg: all | news | blog | vlog | project | repo
  //     [data-search]                     a text input
  //     [data-tags-filter] button[data-tag]       toggle chips; a post matches if it has ANY selected tag
  //     [data-sort] button[data-value]    newest | oldest
  //     [data-count][data-noun]           live region, e.g. "3 of 12 posts" ([data-noun-one] is the singular: "1 post")
  //     [data-items] > [data-item]        each item carries data-kind, data-date (YYYY-MM-DD), data-title, data-text, data-tags
  //     [data-empty] [data-clear]         empty state and its reset button
  //     [data-hide-filtered]              anything to hide while a filter is active (e.g. pagination)
  function initList(scope) {
    var host = $('[data-items]', scope);
    if (!host) return;
    var items = $$('[data-item]', host);
    var kindSeg = $('[data-filter="kind"]', scope);
    var sortSeg = $('[data-sort]', scope);
    var search = $('[data-search]', scope);
    var tagBox = $('[data-tags-filter]', scope);
    var count = $('[data-count]', scope);
    var empty = $('[data-empty]', scope);
    var state = { kind: 'all', q: '', tags: [], sort: 'newest' };
    var orderedBy = null;

    items.forEach(function (el, i) {
      el._i = i;
      el._date = el.getAttribute('data-date') || '';
      el._tags = (el.getAttribute('data-tags') || '').toLowerCase().split(/\s+/).filter(Boolean);
      el._hay = ((el.getAttribute('data-title') || '') + ' ' + (el.getAttribute('data-text') || '') + ' ' + el._tags.join(' ')).toLowerCase();
    });

    function press(buttons, test) {
      buttons.forEach(function (b) {
        var on = test(b);
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }

    function reorder() {
      if (orderedBy === state.sort) return;
      var dir = state.sort === 'oldest' ? 1 : -1;
      items.slice().sort(function (a, b) {
        return a._date < b._date ? -dir : a._date > b._date ? dir : a._i - b._i;
      }).forEach(function (el) { host.appendChild(el); });
      orderedBy = state.sort;
    }

    function render() {
      var words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      var shown = 0;
      items.forEach(function (el) {
        var ok = (state.kind === 'all' || el.getAttribute('data-kind') === state.kind) &&
          (!state.tags.length || state.tags.some(function (t) { return el._tags.indexOf(t) >= 0; })) &&
          words.every(function (w) { return el._hay.indexOf(w) >= 0; });
        el.hidden = !ok;
        if (ok) shown++;
      });
      reorder();

      var filtered = state.kind !== 'all' || state.tags.length > 0 || words.length > 0;
      if (count) {
        var noun = count.getAttribute('data-noun') || 'posts';
        var one = count.getAttribute('data-noun-one') || noun;
        count.textContent = shown === items.length ? items.length + ' ' + (items.length === 1 ? one : noun) : shown + ' of ' + items.length + ' ' + noun;
      }
      if (empty) empty.hidden = shown !== 0;
      $$('[data-hide-filtered]', scope).forEach(function (el) { el.hidden = filtered; });
    }

    if (kindSeg) {
      var kindBtns = $$('button', kindSeg);
      kindSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b || !kindSeg.contains(b)) return;
        state.kind = b.getAttribute('data-value') || 'all';
        press(kindBtns, function (x) { return x === b; });
        render();
      });
    }
    if (sortSeg) {
      var sortBtns = $$('button', sortSeg);
      sortSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b || !sortSeg.contains(b)) return;
        state.sort = b.getAttribute('data-value') || 'newest';
        press(sortBtns, function (x) { return x === b; });
        render();
      });
    }
    if (tagBox) {
      tagBox.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-tag]');
        if (!b) return;
        var t = b.getAttribute('data-tag').toLowerCase();
        var at = state.tags.indexOf(t);
        if (at >= 0) state.tags.splice(at, 1); else state.tags.push(t);
        press($$('button[data-tag]', tagBox), function (x) { return state.tags.indexOf(x.getAttribute('data-tag').toLowerCase()) >= 0; });
        render();
      });
    }
    if (search) {
      search.addEventListener('input', function () { state.q = search.value; render(); });
      var form = search.closest('form');
      if (form) form.addEventListener('submit', function (e) { e.preventDefault(); });
    }

    function clearAll() {
      state.kind = 'all'; state.q = ''; state.tags = [];
      if (kindSeg) press($$('button', kindSeg), function (b) { return (b.getAttribute('data-value') || 'all') === 'all'; });
      if (tagBox) press($$('button[data-tag]', tagBox), function () { return false; });
      if (search) search.value = '';
      render();
      if (search) search.focus();
    }
    $$('[data-clear]', scope).forEach(function (b) { b.addEventListener('click', clearAll); });

    // Start from the address: ?q=agents&tag=git
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }
    if (params) {
      if (search && params.get('q')) { search.value = params.get('q'); state.q = search.value; }
      if (tagBox && params.get('tag')) {
        state.tags = params.get('tag').toLowerCase().split(',').filter(Boolean);
        press($$('button[data-tag]', tagBox), function (x) { return state.tags.indexOf(x.getAttribute('data-tag').toLowerCase()) >= 0; });
      }
    }
    if (search && window.location.hash === '#search') search.focus();
    render();
  }
  $$('[data-list]').forEach(initList);

  /* -------------------------------------------------------------------------------------------- (d) copy */
  var liveRegion = null;
  function announce(msg) {
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.className = 'visually-hidden';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = '';
    window.setTimeout(function () { liveRegion.textContent = msg; }, 30);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  function pageUrl() {
    var c = $('link[rel="canonical"]');
    // The canonical is a placeholder in the templates, so while it still says example.com use the real address
    if (c && c.href && !/\/\/example\.com/.test(c.href)) return c.href;
    return window.location.href.split('#')[0];
  }

  $$('[data-copy]').forEach(function (btn) {
    var label = $('[data-copy-label]', btn) || $('span', btn);
    var original = label ? label.textContent : '';
    var timer = 0;
    btn.addEventListener('click', function () {
      var spec = btn.getAttribute('data-copy') || '';
      var text;
      if (spec === '@url') text = pageUrl();
      else if (spec.charAt(0) === '#') {
        var target = document.getElementById(spec.slice(1));
        text = target ? target.textContent.replace(/\s+$/, '') : '';
      } else text = spec;
      if (!text) return;
      copyText(text).then(function () {
        if (label) label.textContent = 'Copied';
        btn.setAttribute('data-copied', '');
        announce('Copied to the clipboard');
      }, function () {
        if (label) label.textContent = 'Press Ctrl+C';
        announce('Copy failed. Select the text and press Ctrl+C.');
      }).then(function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          if (label) label.textContent = original;
          btn.removeAttribute('data-copied');
        }, 1600);
      });
    });
  });

  /* ------------------------------------------------------------------------------ (f) table of contents */
  var tocLinks = $$('.toc a[href^="#"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var heads = tocLinks.map(function (a) { return document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); });
    var pairs = [];
    heads.forEach(function (h, i) { if (h) pairs.push({ h: h, a: tocLinks[i] }); });

    var mark = function () {
      // The current heading is the last one that has reached the upper part of the window
      var line = window.innerHeight * 0.35;
      var current = null;
      pairs.forEach(function (p) { if (p.h.getBoundingClientRect().top <= line) current = p; });
      pairs.forEach(function (p) {
        if (p === current) p.a.setAttribute('aria-current', 'true'); else p.a.removeAttribute('aria-current');
      });
    };
    // A band across the upper part of the window: a heading entering or leaving it is what changes the answer
    var io = new IntersectionObserver(mark, { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] });
    pairs.forEach(function (p) { io.observe(p.h); });
    mark();
  }

  /* ------------------------------------------------------------------------------------ (g) video poster */
  $$('[data-player]').forEach(function (player) {
    var note = $('[data-player-note]', player);

    function load(startSeconds) {
      var embed = player.getAttribute('data-embed');
      if (!embed) {
        if (note) { note.hidden = false; note.textContent = 'Placeholder poster. Put the embed address in data-embed on this element to load the real video.'; }
        return;
      }
      var url = embed + (embed.indexOf('?') >= 0 ? '&' : '?') + 'autoplay=1' + (startSeconds ? '&start=' + startSeconds : '');
      var frame = document.createElement('iframe');
      frame.src = url;
      frame.title = player.getAttribute('data-title') || 'Video';
      frame.loading = 'lazy';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allowFullscreen = true;
      $$('[data-poster]', player).forEach(function (n) { n.parentNode.removeChild(n); });
      var old = $('iframe', player);
      if (old) old.parentNode.removeChild(old);
      player.appendChild(frame);
    }

    var play = $('[data-player-play]', player);
    if (play) play.addEventListener('click', function () { load(0); });
    $$('a[data-start]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        load(parseInt(a.getAttribute('data-start'), 10) || 0);
        player.scrollIntoView({ block: 'center' });
      });
    });
  });

  /* ------------------------------------------------------------------------------------------- (h) search loader */
  // search.js (about 4 kB) is not needed to paint the page, so it loads on first use: a click on a [data-search-open]
  // button or the "/" key. The /search/ page needs it at once. Once loaded, search.js owns the listeners.
  var searchPanel = $('[data-search-page]') || $('[data-search-dialog]');
  var searchSrc = searchPanel ? searchPanel.getAttribute('data-search-src') : null;
  function injectSearch(done) {
    var tag = document.createElement('script');
    tag.type = 'module';
    tag.src = searchSrc;
    if (done) tag.addEventListener('load', done);
    document.head.appendChild(tag);
  }
  if (searchSrc && searchPanel.hasAttribute('data-search-page')) {
    injectSearch();
  } else if (searchSrc) {
    // The first click or "/" is replayed once search.js has attached its own listeners.
    var loadSearch = function (replay) {
      document.removeEventListener('click', onSearchClick);
      document.removeEventListener('keydown', onSearchKey);
      injectSearch(replay);
    };
    var onSearchClick = function (e) {
      var trigger = e.target instanceof Element && e.target.closest('[data-search-open]');
      if (!trigger || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      loadSearch(function () { trigger.click(); });
    };
    var onSearchKey = function (e) {
      if (e.key !== '/' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      var t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
      if ($('dialog[open]')) return;
      e.preventDefault();
      loadSearch(function () {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
      });
    };
    document.addEventListener('click', onSearchClick);
    document.addEventListener('keydown', onSearchKey);
  }

  // ---------------------------------------------------------------------------------------------- (i) reveal on scroll
  // Cards and section rows that start below the first screen fade and rise in once as they come into view; cards in a row
  // follow each other by a beat (--reveal-i). Anything on screen when the page opens is left alone, so nothing above the fold
  // blinks, and the classes go once the move is over, so a card's own hover is untouched. Off under reduced motion, without
  // IntersectionObserver, and for automated browsers (navigator.webdriver: full-page screenshots and axe see every card;
  // tests/reveal.spec.js turns it back on).
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still && 'IntersectionObserver' in window && !navigator.webdriver) {
    var fold = window.innerHeight;
    var pending = $$('main .grid-cards > *, main .sections > .sec-row').filter(function (el) {
      return !el.querySelector('.grid-cards') && el.getBoundingClientRect().top > fold;
    });
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        seen.unobserve(el);
        el.classList.add('revealed');
        setTimeout(function () {
          el.classList.remove('reveal', 'revealed');
          el.style.removeProperty('--reveal-i');
        }, 900);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    pending.forEach(function (el) {
      var parent = el.parentElement;
      var beat = parent && parent.classList.contains('grid-cards') ? Array.prototype.indexOf.call(parent.children, el) % 3 : 0;
      el.style.setProperty('--reveal-i', String(beat));
      el.classList.add('reveal');
      seen.observe(el);
    });
  }
})();
