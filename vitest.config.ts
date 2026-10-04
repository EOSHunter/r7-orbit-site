import { defineConfig } from 'vitest/config';

// Vitest unit tests (*.vitest.ts) live next to the code; main's node:test files (*.test.ts) run separately. Playwright specs (phase 7) live in tests/ and are not picked up here.
export default defineConfig({ test: { include: ['src/**/*.vitest.ts'] } });
