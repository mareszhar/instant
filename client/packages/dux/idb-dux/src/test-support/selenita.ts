/**
 * The selenita project for editor-DX suites, wired once.
 *
 * The package tsconfig already maps `@mszr/idb-dux` (and subpaths) onto
 * `src/`, so snippets read exactly like userland code — including
 * `declare module '@mszr/idb-dux'` registration, which stays isolated to the
 * test file's own TypeScript program.
 */
import { resolve } from 'node:path'
import process from 'node:process'
import { defineProject } from '@mszr/selenita'
import '@mszr/selenita/vitest'

// Resolve from cwd (the package dir under vitest) rather than import.meta.url:
// the jsdom environment rewrites import.meta.url to a non-file scheme, which
// would break `fileURLToPath` at module load for every test that touches the
// `@test` barrel — including the non-selenita ones.
function tsconfigPath() {
  return resolve(process.cwd(), 'tsconfig.json')
}

/** Call at module scope (it registers `beforeAll`/`afterAll`). */
// Annotated via ReturnType because selenita doesn't export its Project class.
export function duxProject(): ReturnType<typeof defineProject> {
  return defineProject({
    tsconfig: tsconfigPath(),
    // `@baseline` reaches the internal vue baseline (never a package export) so
    // parity dx snippets can compare it against official `@instantdb/vue`.
    aliases: { '@baseline': './src/vue/baseline/index.ts' },
  })
}

/**
 * The canonical registration block for dx snippets — import the canonical
 * schema and register it, exactly as `instant.schema.ts` would.
 */
export const registration = `
import { schema } from '@test/app'

declare module '@mszr/idb-dux' {
  interface IdbRegister { schema: typeof schema }
}
`
