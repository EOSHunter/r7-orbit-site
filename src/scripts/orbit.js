/*
  The R7 Orbit hub for the web: the mark, a ring seen at an angle, and a dot that goes round it, behind the R7 on the far
  side and in front of it on the near side. Ported from the app (src/renderer/components.tsx, Dial).

    <div class="orbit" data-orbit></div>              quiet: a slow drift
    <div class="orbit" data-orbit="busy"></div>       busy: a lap in about fourteen seconds
    <div class="orbit" data-orbit="busy waiting"></div>  the dot pulses

  Someone who asked their computer for less motion gets the dot placed and still.
*/
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var LOGO = [
    'M598 0H65L166 98.5H351.5L208 242V407.5L324.5 524V273.5L598 0Z',
    'M162 231.5L208 185.5H0C31.7749 216.5 95.9597 279.6 98.5 284C101.04 288.4 141.892 285.833 162 284V231.5Z',
    'M366.5 284L434.5 225L610 407.5H483L366.5 284Z',
  ];
  var RING = { cx: 112, cy: 112, rx: 100, ry: 34, tilt: (-24 * Math.PI) / 180 };
  var TAIL = 9;

  function ringPoint(a) {
    var ex = RING.rx * Math.cos(a), ey = RING.ry * Math.sin(a), c = Math.cos(RING.tilt), s = Math.sin(RING.tilt);
    return { x: RING.cx + ex * c - ey * s, y: RING.cy + ex * s + ey * c, near: Math.sin(a) > 0, depth: (Math.sin(a) + 1) / 2 };
  }
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function mount(host) {
    var flags = (host.getAttribute('data-orbit') || '').split(/\s+/);
    var state = { busy: flags.indexOf('busy') >= 0, waiting: flags.indexOf('waiting') >= 0 };
    host.classList.toggle('idle', !state.busy);
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', 'R7 Orbit');

    var svg = el('svg', { viewBox: '0 0 224 224', 'aria-hidden': 'true' }, host);
    el('ellipse', { class: 'orbit-ring', cx: RING.cx, cy: RING.cy, rx: RING.rx, ry: RING.ry, transform: 'rotate(-24 ' + RING.cx + ' ' + RING.cy + ')' }, svg);
    var back = el('g', {}, svg);
    var logo = el('g', { transform: 'translate(112 112) scale(0.155) translate(-305 -262)' }, svg);
    LOGO.forEach(function (d) { el('path', { class: 'orbit-logo', d: d }, logo); });
    var front = el('g', {}, svg);

    var dots = [];
    for (var i = 0; i <= TAIL; i++) dots.push(el('circle', { class: i === 0 ? 'orbit-dot' : 'orbit-tail' }, back));

    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var angle = 2.2, speed = 0.15, last = performance.now(), raf = 0;

    function draw(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Quiet: a slow drift. Busy: a lap in about fourteen seconds. The speed eases between the two.
      speed += ((state.busy ? 0.45 : 0.15) - speed) * Math.min(1, dt * 1.5);
      if (!still) angle += dt * speed;
      dots.forEach(function (d, i) {
        var p = ringPoint(angle - i * 0.085);
        var fade = i === 0 ? 1 : (1 - i / (TAIL + 1)) * 0.55;
        var pulse = i === 0 && state.waiting ? 1 + 0.3 * Math.sin(now / 280) : 1;
        d.setAttribute('cx', p.x.toFixed(2));
        d.setAttribute('cy', p.y.toFixed(2));
        d.setAttribute('r', ((i === 0 ? 3.1 : 2.1 * (1 - i / (TAIL + 2))) * (0.75 + 0.5 * p.depth) * pulse).toFixed(2));
        // The dot is fully solid whenever it is in front of the mark; the tail, and the dot while behind it, are dimmer
        d.setAttribute('opacity', (i === 0 && p.near ? 1 : fade * (p.near ? 1 : 0.4) * (state.busy || state.waiting ? 1 : 0.7)).toFixed(2));
        var want = p.near ? front : back;
        if (d.parentNode !== want) want.appendChild(d);
      });
      if (!still) raf = requestAnimationFrame(draw);
    }
    draw(performance.now());
    if (!still) raf = requestAnimationFrame(draw);

    // Stop drawing while the tab is hidden
    document.addEventListener('visibilitychange', function () {
      if (still) return;
      if (document.hidden) cancelAnimationFrame(raf);
      else { last = performance.now(); raf = requestAnimationFrame(draw); }
    });

    host.orbit = {
      set: function (next) {
        if (next.busy !== undefined) { state.busy = !!next.busy; host.classList.toggle('idle', !state.busy); }
        if (next.waiting !== undefined) state.waiting = !!next.waiting;
      },
    };
  }

  function init() { document.querySelectorAll('[data-orbit]').forEach(mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
