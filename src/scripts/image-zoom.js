/*
  Pictures in a post open larger in a <dialog> (ImageZoom.astro). Each picture of the post with alt text (the cover and the
  body's pictures) is wrapped in a button labelled "Enlarge: <alt>"; Enter, Space or a click opens it. In the dialog, Esc
  closes, Left and Right (or the buttons) step through the post's pictures, Tab wraps, and focus returns to the picture.
  Left alone: decorative pictures (alt=""), pictures already inside a link or a button (cards, the video and game posters,
  the project gallery, which has its own), avatars, the hero behind a headline, and small pictures. The large copy is the
  same srcset with a larger sizes (ZOOM_SIZES), so the browser fetches a bigger file only when the dialog opens. No network otherwise.
*/
(function () {
  'use strict';

  var dialog = document.querySelector('[data-zoom-dialog]');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var SKIP = 'a, button, [data-gallery], [data-play], .avatar, .author, .article-hero, .card, .lightbox';
  var MIN_WIDTH = 160; // px as drawn: smaller pictures are icons or thumbnails, not worth enlarging
  // The large copy: the screen's width on a wide screen; on a phone, where the dialog is no wider than the post, a 1600px copy
  // so that pinching to zoom shows the detail.
  var ZOOM_SIZES = '(min-width: 1200px) 100vw, 1600px';

  var stage = dialog.querySelector('[data-zoom-stage]');
  var caption = dialog.querySelector('[data-zoom-caption]');
  var count = dialog.querySelector('[data-zoom-count]');
  var nav = dialog.querySelector('[data-zoom-nav]');
  var prev = dialog.querySelector('[data-zoom-prev]');
  var next = dialog.querySelector('[data-zoom-next]');
  var closeBtn = dialog.querySelector('[data-zoom-close]');
  var main = document.getElementById('main');
  if (!main) return;

  var pictures = Array.prototype.filter.call(main.querySelectorAll('img'), function (img) {
    var alt = (img.getAttribute('alt') || '').trim();
    if (!alt || img.closest(SKIP)) return false;
    var drawn = img.getBoundingClientRect().width || Number(img.getAttribute('width')) || 0;
    return drawn >= MIN_WIDTH;
  });
  if (!pictures.length) return;

  var index = 0;
  var opener = null;

  function captionOf(img) {
    var figure = img.closest('figure');
    var text = figure && figure.querySelector('figcaption');
    return text ? text.textContent.trim() : '';
  }

  function show(i) {
    index = (i + pictures.length) % pictures.length;
    var img = pictures[index];
    var source = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : img;
    var copy = source.cloneNode(true);
    var copies = copy.tagName === 'PICTURE' ? copy.querySelectorAll('source, img') : [copy];
    Array.prototype.forEach.call(copies, function (el) {
      if (el.hasAttribute('srcset')) el.setAttribute('sizes', ZOOM_SIZES);
    });
    var big = copy.tagName === 'IMG' ? copy : copy.querySelector('img');
    big.removeAttribute('loading');
    big.removeAttribute('class');
    stage.replaceChildren(copy);
    caption.textContent = captionOf(img);
    count.textContent = pictures.length > 1 ? index + 1 + ' of ' + pictures.length : '';
    nav.hidden = pictures.length < 2;
  }

  pictures.forEach(function (img, i) {
    var target = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : img;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'zoom-btn';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-label', 'Enlarge: ' + img.getAttribute('alt').trim());
    target.parentNode.insertBefore(button, target);
    button.appendChild(target);
    button.addEventListener('click', function () {
      opener = button;
      show(i);
      dialog.showModal();
      closeBtn.focus();
    });
  });

  prev.addEventListener('click', function () { show(index - 1); });
  next.addEventListener('click', function () { show(index + 1); });
  closeBtn.addEventListener('click', function () { dialog.close(); });

  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' && pictures.length > 1) { e.preventDefault(); show(index - 1); }
    else if (e.key === 'ArrowRight' && pictures.length > 1) { e.preventDefault(); show(index + 1); }
    else if (e.key === 'Tab') {
      var items = Array.prototype.filter.call(dialog.querySelectorAll('button'), function (b) {
        return !b.disabled && !b.closest('[hidden]');
      });
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // A click on the backdrop is a click on the dialog element itself, outside its box.
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener('close', function () {
    stage.replaceChildren();
    if (opener) opener.focus();
  });
})();
