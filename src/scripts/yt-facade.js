/*
  YouTube click-to-load facade. Nothing is requested from YouTube until the visitor presses play (or a chapter).
  Then a youtube-nocookie.com iframe is added and chapters seek it with the iframe API's postMessage commands: no
  third-party script is ever loaded. Without JavaScript the chapters are plain links to the video on YouTube.
*/
(function () {
  'use strict';

  var HOST = 'https://www.youtube-nocookie.com';

  function embedUrl(id, start) {
    var q = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1', enablejsapi: '1', origin: location.origin });
    if (start > 0) q.set('start', String(start));
    return HOST + '/embed/' + id + '?' + q.toString();
  }

  function command(frame, func, args) {
    frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), HOST);
  }

  function setup(root) {
    var id = root.getAttribute('data-yt-id');
    var frame = null;
    var loaded = false;

    function load(start) {
      frame = document.createElement('iframe');
      frame.title = root.getAttribute('data-yt-title') || 'Video';
      frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      frame.setAttribute('allowfullscreen', '');
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.addEventListener('load', function () { loaded = true; });
      frame.src = embedUrl(id, start);
      var player = root.querySelector('.player');
      Array.prototype.forEach.call(player.querySelectorAll('[data-yt-facade]'), function (n) { n.remove(); });
      player.appendChild(frame);
      frame.focus();
    }

    function seek(start) {
      if (!frame) load(start);
      else if (!loaded) frame.src = embedUrl(id, start);
      else {
        command(frame, 'seekTo', [start, true]);
        command(frame, 'playVideo');
      }
    }

    var play = root.querySelector('[data-yt-play]');
    if (play) play.addEventListener('click', function () { if (!frame) load(0); });

    Array.prototype.forEach.call(root.querySelectorAll('[data-yt-start]'), function (link) {
      link.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
        e.preventDefault();
        seek(Number(link.getAttribute('data-yt-start')) || 0);
        Array.prototype.forEach.call(root.querySelectorAll('[data-yt-start]'), function (n) {
          if (n === link) n.setAttribute('aria-current', 'true');
          else n.removeAttribute('aria-current');
        });
        var box = root.querySelector('.player').getBoundingClientRect();
        if (box.top < 0 || box.bottom > window.innerHeight) root.querySelector('.player').scrollIntoView({ block: 'center' });
        frame.focus();
      });
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-yt]'), setup);
})();
