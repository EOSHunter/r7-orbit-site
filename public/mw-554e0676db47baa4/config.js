// The page and its API are one site behind Cloudflare Access (docs/MOVIE_WHEEL.md), so there is no Worker address or passphrase to enter.
window.MW_CONFIG = {
  api: '/api/movie-wheel'
};
// Starting list. It loads once, on a browser that has no list yet and nothing saved online. After that every device shares one list.
window.MW_SEED = 'movies-seed.json';
