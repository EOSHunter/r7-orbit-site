// The words the game draws (prototype wording; the author reviews the copy before the game has a public page). Apart from
// index.ts so a page can print them without loading three.js.

export const ASCENT_TEXT = {
  title: 'R7: Ascent',
  canvasLabel: 'R7: Ascent, a climbing game',
  play: 'Click or press Space to play',
  playTouch: 'Tap to play',
  paused: 'Paused. Click or press Space to continue',
  pausedFullscreen: 'Paused. Click or press Space to continue, or press Escape to leave full screen',
  pausedTouch: 'Paused',
  clickToLook: 'Click to look around with the mouse',
  hint: 'WASD or arrows to move · Space to jump · mouse to look · Q and E to turn · Esc to pause',
  hintTouch: 'Left thumb to move · drag on the right to look · tap Jump',
  altitude: 'Altitude',
  time: 'Time',
  best: 'Best',
  falls: 'Falls',
  jumps: 'Jumps',
  fell: 'You fell. Back to the start.',
  fellToBeacon: 'You fell. Back to your last beacon.',
  noWebGL: 'This game needs WebGL.',

  // The pause menu and the ready screen
  menuLabel: 'Game menu',
  resume: 'Resume',
  restart: 'Restart',
  restartConfirm: 'Restart from the floor?',
  assist: 'Assist mode',
  assistNote: 'Beacons along the climb: fall too far and you return to the last one you touched.',
  settings: 'Settings',
  leave: 'Leave',
  back: 'Back',
  continueClimb: 'Continue',
  newClimb: 'New climb',
  loading: 'Loading the climb…',

  // The finish
  finishTitle: 'You reached orbit',
  finishAssisted: 'Climbed with assist mode.',
  climbAgain: 'Climb again',
  credits: 'Credits',

  // Settings
  settingsLabel: 'Settings',
  sensitivity: 'Look speed',
  invertY: 'Invert looking up and down',
  motion: 'Motion',
  motionSystem: 'As the system asks',
  motionReduce: 'Reduced',
  motionFull: 'Full',

  // Touch
  jump: 'Jump',
  pause: 'Pause',
  rotate: 'Turn your phone sideways to play',
} as const;
