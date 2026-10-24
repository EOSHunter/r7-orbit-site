// Every word the game draws, in a file of its own so a page can print them (the 404 page's poster, at build time) without
// importing index.ts, which pulls in three.js. index.ts re-exports RUNNER_TEXT, so `import { RUNNER_TEXT } from './index'` works.

/** Every word the game draws. The look pass and the 404 page may restyle them; changing the words is the author's call. */
export const RUNNER_TEXT = {
  canvasLabel: 'Endless runner game',
  title: 'Off course',
  play: { keys: 'Press space to play', touch: 'Tap to play' },
  again: { keys: 'Press space to try again', touch: 'Tap to try again' },
  paused: { keys: 'Paused. Press space to continue', touch: 'Paused. Tap to continue' },
  best: 'Best',
  score: 'Score',
  pickups: 'Pickups',
  noWebGL: 'This game needs WebGL.',
  gameOver: (score: number) => `Game over, score ${score}`,
};
