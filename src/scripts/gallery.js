/*
  Screenshot gallery: thumbnails open one <dialog> (showModal makes the rest of the page inert, so focus stays inside).
  Esc closes, Left and Right (or the buttons) step through, Tab wraps, focus returns to the thumbnail. No network.
*/
(function () {
  'use strict';

  function setup(root) {
    var dialog = root.querySelector('[data-gallery-dialog]');
    var thumbs = Array.prototype.slice.call(root.querySelectorAll('[data-gallery-open]'));
    if (!dialog || !thumbs.length || typeof dialog.showModal !== 'function') return;

    var stage = dialog.querySelector('[data-gallery-stage]');
    var caption = dialog.querySelector('[data-gallery-caption]');
    var count = dialog.querySelector('[data-gallery-count]');
    var prev = dialog.querySelector('[data-gallery-prev]');
    var next = dialog.querySelector('[data-gallery-next]');
    var closeBtn = dialog.querySelector('[data-gallery-close]');
    var index = 0;
    var opener = null;

    function show(i) {
      index = (i + thumbs.length) % thumbs.length;
      var thumb = thumbs[index];
      var media = thumb.querySelector('.media').cloneNode(true);
      media.removeAttribute('aria-hidden');
      media.setAttribute('role', 'img');
      media.setAttribute('aria-label', thumb.getAttribute('data-alt'));
      stage.replaceChildren(media);
      caption.textContent = thumb.getAttribute('data-caption') || '';
      count.textContent = index + 1 + ' of ' + thumbs.length;
      prev.disabled = next.disabled = thumbs.length < 2;
    }

    thumbs.forEach(function (thumb, i) {
      thumb.addEventListener('click', function () {
        opener = thumb;
        show(i);
        dialog.showModal();
        closeBtn.focus();
      });
    });

    prev.addEventListener('click', function () { show(index - 1); });
    next.addEventListener('click', function () { show(index + 1); });
    closeBtn.addEventListener('click', function () { dialog.close(); });

    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
      else if (e.key === 'Tab') {
        var items = Array.prototype.filter.call(dialog.querySelectorAll('button'), function (b) { return !b.disabled; });
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
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-gallery]'), setup);
})();
