import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  // .wrangler/ is wrangler's local state and bundles from trying the waitlist locally (docs/WAITLIST.md).
  {
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'templates/',
      'brand/',
      'public/',
      'src/scripts/',
      'workers/',
      '.wrangler/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
];
