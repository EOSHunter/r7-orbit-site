/*
  Playable project facade. Nothing is requested from the game's address until the visitor presses Play. Then a sandboxed
  iframe replaces the poster, keyboard focus moves into it, and a Fullscreen button appears. The address comes from the
  page (data-play-url), never from this file. Without JavaScript the poster is hidden and the page shows a plain link.
*/
(function () {
  'use strict';

  function setup(root) {
    var url = root.getAttribute('data-play-url');
    var title = root.getAttribute('data-play-title') || 'Game';
    var stage = root.querySelector('.play-stage');
    var start = root.querySelector('[data-play-start]');
    var fullscreen = root.querySelector('[data-play-fullscreen]');
    var label = root.querySelector('[data-play-fullscreen-label]');
    var status = root.querySelector('[data-play-status]');
    var frame = null;

    function announce(text) {
      if (status) status.textContent = text;
    }

    function load() {
      if (frame) return;
      frame = document.createElement('iframe');
      frame.title = title + ' (playable game)';
      // The game gets its own origin's storage and scripts and pointer lock, and nothing else: no popups, no forms, no
      // navigating this page. Fullscreen is not a sandbox flag (Chrome logs 'allow-fullscreen' as invalid): the allow
      // attribute below grants it.
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
      frame.setAttribute('allow', 'fullscreen; gamepad; autoplay');
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.addEventListener('load', function () {
        // Keyboard focus goes into the game so it can be played at once.
        frame.focus();
        try {
          frame.contentWindow.focus();
        } catch (e) {
          /* the game's own origin: focusing the window is allowed, anything else is not needed */
        }
        announce(title + ' loaded. Keyboard focus is in the game. Press Escape to leave fullscreen, Tab to move back to the page.');
      });
      frame.src = url;
      Array.prototype.forEach.call(stage.querySelectorAll('[data-play-facade], .media-ph'), function (n) { n.remove(); });
      stage.appendChild(frame);
      frame.focus();
      announce('Loading ' + title + '.');
      if (fullscreen && document.fullscreenEnabled) fullscreen.hidden = false;
    }

    if (start) start.addEventListener('click', load);

    if (fullscreen) {
      fullscreen.addEventListener('click', function () {
        if (!frame) return;
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          var request = frame.requestFullscreen && frame.requestFullscreen();
          if (request && request.catch) request.catch(function () {});
        }
      });
      document.addEventListener('fullscreenchange', function () {
        var on = document.fullscreenElement === frame;
        if (label) label.textContent = on ? 'Exit fullscreen' : 'Fullscreen';
        // Leaving fullscreen puts focus back in the game, where the player was.
        if (!on && frame) frame.focus();
      });
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-play]'), setup);
})();
