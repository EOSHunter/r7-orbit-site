// The words the game draws (prototype wording; the author reviews the copy before the game has a public page). Apart from
// index.ts so a page can print them without loading three.js.

export const ASCENT_TEXT = {
  title: 'R7: Ascent',
  canvasLabel: 'R7: Ascent, a climbing game',
  play: 'Click or press Space to play',
  paused: 'Paused. Click or press Space to continue',
  pausedFullscreen: 'Paused. Click or press Space to continue, or press Escape to leave full screen',
  clickToLook: 'Click to look around with the mouse',
  hint: 'WASD or arrows to move · Space to jump · mouse to look · Q and E to turn · Esc to pause',
  altitude: 'Altitude',
  best: 'Best',
  falls: 'Falls',
  fell: 'You fell. Back to the start.',
  noWebGL: 'This game needs WebGL.',
} as const;
