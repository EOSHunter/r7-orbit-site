/*
  Waitlist forms ([data-waitlist], src/components/WaitlistForm.astro). Plain JS, no dependencies.

  Nothing is requested from Cloudflare when the page loads. Turnstile's script (data-script) is added the first time the reader
  focuses, touches or points at a form, or scrolls with one near the screen; then each form gets an invisible widget
  (appearance: interaction-only) that only shows, floating over the page, if Cloudflare needs the reader to tick it.

  Sending: the address, the source, the honeypot and the Turnstile token go to data-endpoint with fetch. The button is marked
  busy while it waits (aria-disabled, so keyboard focus stays on it). The status line (role="status") says data-success only
  when the server answers { ok: true }; a 400 shows the server's own short message (a mistyped address, a failed spam check);
  anything else shows data-error. The token is used once: the widget is reset after every answer.
*/
(function () {
  'use strict';

  var forms = Array.prototype.slice.call(document.querySelectorAll('[data-waitlist]'));
  if (!forms.length) return;

  var TOKEN_WAIT = 30000;
  var loading = null;

  /** Loads Turnstile once for the page; resolves with window.turnstile. */
  function loadTurnstile(src) {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      if (window.turnstile) return resolve(window.turnstile);
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () {
        if (window.turnstile) resolve(window.turnstile);
        else reject(new Error('Turnstile did not start'));
      };
      script.onerror = function () {
        loading = null;
        reject(new Error('Turnstile could not be loaded'));
      };
      document.head.appendChild(script);
    });
    return loading;
  }

  function setup(root) {
    var form = root.querySelector('[data-waitlist-form]');
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector('button[type="submit"]');
    var slot = form.querySelector('[data-waitlist-challenge]');
    var status = root.querySelector('[data-waitlist-status]');
    var widget = null;
    var token = '';
    var waiting = [];
    var sending = false;

    function say(text, tone) {
      status.textContent = text;
      if (tone) status.setAttribute('data-tone', tone);
      else status.removeAttribute('data-tone');
    }

    function settle(error, value) {
      var list = waiting;
      waiting = [];
      list.forEach(function (w) { if (error) w.reject(error); else w.resolve(value); });
    }

    /** Adds the script (once) and this form's widget (once). */
    function prepare() {
      return loadTurnstile(root.getAttribute('data-script')).then(function (turnstile) {
        if (widget !== null) return turnstile;
        widget = turnstile.render(slot, {
          sitekey: root.getAttribute('data-sitekey'),
          action: root.getAttribute('data-action'),
          appearance: 'interaction-only',
          theme: 'dark',
          size: form.clientWidth < 330 ? 'compact' : 'normal',
          'response-field': false,
          callback: function (value) { token = value; settle(null, value); },
          'expired-callback': function () { token = ''; },
          'error-callback': function () {
            token = '';
            settle(new Error('Turnstile failed'));
            return true;
          },
          'before-interactive-callback': function () { slot.setAttribute('data-open', ''); },
          'after-interactive-callback': function () { slot.removeAttribute('data-open'); },
        });
        return turnstile;
      });
    }

    /** A fresh token: the one the widget already has, or the next one it makes (up to 30 seconds). */
    function getToken() {
      return prepare().then(function () {
        if (token) return token;
        return new Promise(function (resolve, reject) {
          var entry = { resolve: resolve, reject: reject };
          waiting.push(entry);
          setTimeout(function () {
            var at = waiting.indexOf(entry);
            if (at === -1) return;
            waiting.splice(at, 1);
            reject(new Error('No Turnstile token in time'));
          }, TOKEN_WAIT);
        });
      });
    }

    function startEarly() {
      prepare().catch(function () { /* said when the reader sends; a later send tries again */ });
    }

    form.addEventListener('focusin', startEarly, { once: true });
    form.addEventListener('pointerenter', startEarly, { once: true });
    form.addEventListener('touchstart', startEarly, { once: true, passive: true });
    if ('IntersectionObserver' in window) {
      // Only after the reader scrolls, so a form that is on screen when the page opens (the home page's) waits for them too.
      window.addEventListener('scroll', function () {
        var seen = new IntersectionObserver(function (entries) {
          if (!entries.some(function (e) { return e.isIntersecting; })) return;
          seen.disconnect();
          startEarly();
        }, { rootMargin: '400px 0px' });
        seen.observe(root);
      }, { once: true, passive: true });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (sending) return;
      sending = true;
      button.setAttribute('aria-disabled', 'true');
      form.setAttribute('aria-busy', 'true');
      say('');
      var error = root.getAttribute('data-error');

      getToken()
        .then(function (value) {
          var body = new URLSearchParams(new FormData(form));
          body.set('cf-turnstile-response', value);
          return fetch(root.getAttribute('data-endpoint'), {
            method: 'POST',
            body: body,
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
          });
        })
        .then(function (response) {
          return response.json().then(
            function (data) { return { status: response.status, data: data }; },
            function () { return { status: response.status, data: null }; }
          );
        })
        .then(function (answer) {
          var data = answer.data;
          if (answer.status === 200 && data && data.ok === true) {
            input.value = '';
            say(root.getAttribute('data-success'), 'ok');
          } else if (answer.status === 400 && data && typeof data.message === 'string' && data.message) {
            say(data.message, 'error');
          } else {
            say(error, 'error');
          }
        })
        .catch(function () { say(error, 'error'); })
        .then(function () {
          sending = false;
          button.removeAttribute('aria-disabled');
          form.removeAttribute('aria-busy');
          token = '';
          if (widget !== null && window.turnstile) window.turnstile.reset(widget);
        });
    });
  }

  forms.forEach(setup);
})();
