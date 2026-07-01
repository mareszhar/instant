import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

function local(path: string) {
  return fileURLToPath(new URL(path, import.meta.url))
}

export default defineConfig({
  resolve: {
    alias: {
      '@test': local('./src/test-support'),
      // Tests import the package the way userland does; the tsconfig paths
      // carry the same mapping for the type planes.
      '@mszr/idb-dux/vue': local('./src/vue/index.ts'),
      '@mszr/idb-dux/perms': local('./src/perms/index.ts'),
      '@mszr/idb-dux/admin': local('./src/admin/index.ts'),
      '@mszr/idb-dux/webhooks': local('./src/webhooks/index.ts'),
      '@mszr/idb-dux/server': local('./src/server/index.ts'),
      '@mszr/idb-dux/h3-v1': local('./src/h3-v1/index.ts'),
      '@mszr/idb-dux': local('./src/index.ts'),
    },
  },
  test: {
    globals: true,
    // Selenita spins up and queries a TypeScript language service for the
    // editor-DX suites; CI runners can exceed Vitest's default budgets.
    hookTimeout: 30_000,
    testTimeout: 30_000,
    // Runtime (*.test.ts) and editor-DX (*.dx.test.ts) planes — both match this glob.
    include: ['src/**/*.test.ts'],
    typecheck: {
      // The type-shape plane, run via --typecheck (wired into the test scripts).
      include: ['src/**/*.test-d.ts'],
    },
  },
})
