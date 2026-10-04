import { defineConfig } from 'vitest/config';

// Unit tests live next to the code they test. Playwright specs (phase 7) live in tests/ and are not picked up here.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
