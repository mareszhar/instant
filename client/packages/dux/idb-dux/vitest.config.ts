import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@test': fileURLToPath(new URL('./src/test-support', import.meta.url)),
    },
  },
  test: {
    globals: true,
    // Suites land with their roadmap phases; drop once the first one exists.
    passWithNoTests: true,
    // Runtime (*.test.ts) and editor-DX (*.dx.test.ts) planes — both match this glob.
    include: ['src/**/*.test.ts'],
    typecheck: {
      // The type-shape plane, run via --typecheck (wired into the test scripts).
      include: ['src/**/*.test-d.ts'],
    },
  },
})
