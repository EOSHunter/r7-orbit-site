// Hover clips on cards (docs/IMAGES.md "Hover clips"). A card whose post has `coverMotion` carries a hidden <video> over its still.
// Pointing at the card or focusing it fetches the clip (the first time only: nothing loads with the page), plays it once from the
// start and fades it in over the still; it holds its last frame. Leaving fades back to the still. Nothing happens on a device
// without a fine pointer that can hover (a phone) unless the card is focused from a keyboard, and nothing at all with reduced motion
// (the CSS also hides the video then). No inline handlers; bundled by Astro from CardMedia.astro.

const canHover = matchMedia('(hover: hover) and (pointer: fine)');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

function attach(video) {
  const media = video.closest('.card-media');
  const card = video.closest('.card') ?? media;
  if (!media || !card || video.dataset.ready) return;
  video.dataset.ready = '1';
  let wanted = false;

  const load = () => {
    if (video.querySelector('source')) return;
    for (const [src, type] of [
      [video.dataset.webm, 'video/webm'],
      [video.dataset.mp4, 'video/mp4'],
    ]) {
      if (!src) continue;
      const s = document.createElement('source');
      s.src = src;
      s.type = type;
      video.append(s);
    }
    video.load();
  };
  const start = (fromKeyboard) => {
    if (reduce.matches || (!fromKeyboard && !canHover.matches) || wanted) return;
    wanted = true;
    load();
    video.currentTime = 0;
    const p = video.play();
    if (p) p.catch(() => {});
  };
  const stop = () => {
    wanted = false;
    media.classList.remove('is-playing');
    setTimeout(() => {
      if (!wanted) video.pause();
    }, 300);
  };
  video.addEventListener('playing', () => {
    if (wanted) media.classList.add('is-playing');
    else video.pause();
  });
  card.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') start(false);
  });
  // A scroll can move the card out from under a still mouse; that must not stop a clip the keyboard started.
  card.addEventListener('pointerleave', () => {
    if (!card.matches(':focus-visible')) stop();
  });
  // Keyboard focus plays it even without a hover pointer; a tap's focus on a phone does not (:focus-visible tells them apart).
  card.addEventListener('focusin', () => start(card.matches(':focus-visible')));
  card.addEventListener('focusout', (e) => {
    if (!card.contains(e.relatedTarget)) stop();
  });
}

function init() {
  for (const v of document.querySelectorAll('video.card-motion')) attach(v);
}

init();
