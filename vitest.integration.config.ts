/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

// Integration tests only. Real network to a DESIGNATED test Supabase project.
// They self-skip unless the TOGO_TEST_* env vars are present.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/integration/**/*.itest.ts'],
  },
});
