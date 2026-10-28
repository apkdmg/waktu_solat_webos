import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Run in a non-Malaysian time zone so date handling can't accidentally
    // depend on the machine being in Malaysia.
    env: { TZ: 'America/Los_Angeles' },
  },
});
