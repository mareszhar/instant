/**
 * The shared prepublish gates (dux-spec-workspace.md §6). One place that runs
 * the common verification — build, lint, typecheck, test, baseline drift — so
 * every publish path is provably verified the same way.
 *
 * Each publish entry runs this once. The `publish:sdk:*` orchestrator runs it a
 * single time up front and then hands `skipVerify` to the demo + subtree steps
 * it drives in-process, so a release never re-verifies what it just verified.
 *
 * The only way past the gate is the deliberately awkward
 * `DUX_UNSAFE_PUBLISH_SKIP_CHECKS=1` — there is no `--skip-checks` flag, because
 * a one-keystroke way to drop the safety rails is too tempting on a tired night.
 */
import process from 'node:process'
import { createLogger, run } from './run-publish-step.mjs'
import { WORKSPACE_ROOT } from './resolve-publish-paths.mjs'

export const UNSAFE_SKIP_ENV = 'DUX_UNSAFE_PUBLISH_SKIP_CHECKS'

/** The shared gates, in dependency order (build first so type/test see deps). */
const GATES = [
  ['build', 'sdk:build:all'],
  ['lint', 'sdk:lint'],
  ['typecheck', 'sdk:typecheck'],
  ['test', 'sdk:test'],
  ['drift', 'sdk:check-baseline-drift'],
]

/**
 * Run the shared gates. Honors the unsafe skip env (with a loud warning).
 * Throws on the first failing gate.
 */
export function runPrepublishGates({ logger = createLogger('prepublish') } = {}) {
  if (process.env[UNSAFE_SKIP_ENV] === '1') {
    logger.warn('⚠️  shared gates SKIPPED via DUX_UNSAFE_PUBLISH_SKIP_CHECKS=1 — publishing UNVERIFIED.')
    return
  }

  logger.log(`running shared gates: ${GATES.map(([name]) => name).join(' · ')}`)
  for (const [name, script] of GATES) {
    logger.log(`gate: ${name}`)
    run('pnpm', ['run', script], { cwd: WORKSPACE_ROOT })
  }
  logger.log('shared gates green ✅')
}
