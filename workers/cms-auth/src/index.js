// R7 Orbit CMS auth: the GitHub OAuth handshake that Decap CMS expects, as a Cloudflare Worker. Same shape as
// sveltia-cms-auth (https://github.com/sveltia/sveltia-cms-auth), written out in full so it has no dependencies.
//
//   GET /auth      Decap opens this in a popup (?provider=github&site_id=<the admin's hostname>). It checks the hostname
//                  against ALLOWED_DOMAINS, sets a one-time state cookie and sends the popup on to GitHub.
//   GET /callback  GitHub sends the popup back here with ?code=&state=. It checks the state cookie, trades the code for an
//                  access token (using the client secret, which is why this has to run on a server) and hands the token to
//                  the admin page that opened the popup with window.postMessage, in the format Decap listens for.
//
// Settings (see README.md): GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are Worker secrets, ALLOWED_DOMAINS is a plain
// variable in wrangler.toml, e.g. "r7orbit.io". Nothing is stored; the token is never logged.

const GITHUB = 'https://github.com';
const PROVIDER = 'github';
const COOKIE = 'cms-auth';
const COOKIE_TTL = 600; // seconds the sign-in may take

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return plain('Method not allowed', 405);
    switch (url.pathname) {
      case '/auth':
        return handleAuth(url, env);
      case '/callback':
        return handleCallback(request, url, env);
      case '/':
        return plain('R7 Orbit CMS auth. Nothing to see here; sign in from /admin/ on the site.');
      default:
        return plain('Not found', 404);
    }
  },
};

/** Step 1: check who is asking, then send the popup to GitHub. */
function handleAuth(url, env) {
  const { provider, site_id: site = '' } = Object.fromEntries(url.searchParams);
  const allowed = allowedDomains(env);

  // Only a site on the allow list gets the token posted back, so an unknown site gets text in the popup and nothing else.
  if (!allowed.length || !isAllowedSite(site, allowed)) {
    return popup({
      error: 'This site is not allowed to use the sign-in service (check ALLOWED_DOMAINS).',
      status: 403,
    });
  }
  if (provider !== PROVIDER) {
    return popup({ site, error: 'Only the GitHub backend is supported.', status: 400 });
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return popup({ site, error: 'The Worker is missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET.', status: 500 });
  }

  const state = crypto.randomUUID().replaceAll('-', '');
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/callback`,
    scope: 'repo',
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${GITHUB}/login/oauth/authorize?${params}`,
      // The site is kept next to the state so /callback knows which origin may receive the token.
      'Set-Cookie': cookie(`${state}.${site.toLowerCase()}`, COOKIE_TTL),
      'Cache-Control': 'no-store',
    },
  });
}

/** Step 2: GitHub is back with a code. Trade it for a token and give it to the admin page. */
async function handleCallback(request, url, env) {
  const { code, state, error, error_description: description } = Object.fromEntries(url.searchParams);
  const saved = request.headers.get('Cookie')?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9a-f]{32})\\.([a-z0-9.-]+)`));
  const [, savedState, site] = saved ?? [];

  if (!savedState || !site) {
    return popup({
      error: 'The sign-in expired or cookies are blocked. Close this window and try again.',
      status: 400,
    });
  }
  // The state must match the one this browser was given, or the request did not start here (CSRF).
  if (!state || state !== savedState) {
    return popup({ site, error: 'The sign-in could not be verified. Close this window and try again.', status: 400 });
  }
  // The site was checked when the sign-in started; check again in case ALLOWED_DOMAINS changed in between.
  if (!isAllowedSite(site, allowedDomains(env))) {
    return popup({ error: 'This site is not allowed to use the sign-in service.', status: 403 });
  }
  if (error || !code) {
    return popup({ site, error: description || error || 'GitHub did not send a sign-in code.', status: 400 });
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return popup({ site, error: 'The Worker is missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET.', status: 500 });
  }

  let result;
  try {
    const res = await fetch(`${GITHUB}/login/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'r7-orbit-cms-auth' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/callback`,
      }),
    });
    result = await res.json();
  } catch {
    return popup({ site, error: 'Could not reach GitHub to finish signing in. Try again.', status: 502 });
  }

  if (!result.access_token) {
    return popup({
      site,
      error: result.error_description || result.error || 'GitHub did not return a token.',
      status: 400,
    });
  }
  return popup({ site, token: result.access_token });
}

// ---- Allow list ---------------------------------------------------------------------------------------------------

/** `r7orbit.io` or `r7orbit.io, *.r7orbit.io` as a list. A `*.` entry matches subdomains only, not the bare domain. */
function allowedDomains(env) {
  return (env.ALLOWED_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedSite(site, allowed) {
  const host = site.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host)) return false;
  return allowed.some((d) =>
    d.startsWith('*.') ? host.length > d.length - 1 && host.endsWith(d.slice(1)) : host === d,
  );
}

// ---- Responses ----------------------------------------------------------------------------------------------------

function cookie(value, maxAge) {
  return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=${maxAge}`;
}

function plain(text, status = 200) {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** JSON that is safe to put inside an inline <script>. */
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * The popup's page. It tells the admin page that opened it that it is ready; the admin (Decap) answers with the same
 * words, and only then is the result posted, and only to the origin of the site that started the sign-in (`site`).
 * Without a known site nothing is posted: the person just reads the message.
 */
function popup({ site, token, error, status = 200 }) {
  const content = error ? { provider: PROVIDER, error } : { provider: PROVIDER, token };
  const message = `authorization:${PROVIDER}:${error ? 'error' : 'success'}:${JSON.stringify(content)}`;
  const notice = error
    ? `<p>${escapeHtml(error)}</p><p>You can close this window.</p>`
    : '<p>Signed in. This window will close by itself.</p>';
  const script = site
    ? `(() => {
      const message = ${scriptJson(message)};
      const origin = ${scriptJson(`https://${site}`)};
      window.addEventListener('message', (event) => {
        if (event.data === 'authorizing:${PROVIDER}' && event.origin === origin) event.source.postMessage(message, origin);
      });
      if (window.opener) window.opener.postMessage('authorizing:${PROVIDER}', '*');
    })();`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>R7 Orbit sign-in</title></head>
<body style="font:16px/1.6 system-ui,sans-serif;padding:2rem">
${notice}
<script>${script}</script>
</body></html>`;

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
      // The state cookie has done its job.
      'Set-Cookie': cookie('', 0),
    },
  });
}
