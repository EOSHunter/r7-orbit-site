// Optional defaults for the chat view and list sync. You can also type these into Chat > Connection settings.
window.MW_CONFIG = {
  workerUrl: '' // for example 'https://r7-movie-wheel-chat.your-name.workers.dev'
};
// Starting list. It loads once, on a browser that has no list yet. Once sync is set up, every device shares one list.
window.MW_SEED = 'movies-seed.json';
