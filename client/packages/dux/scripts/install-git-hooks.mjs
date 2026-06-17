#!/usr/bin/env node

/**
 * Install dux's tracked Git hooks for this checkout.
 *
 * Installing means pointing Git's local `core.hooksPath` at the versioned
 * `.githooks/` directory. By default, setup failures exit non-zero; pass
 * `--optional` to warn and continue when Git config cannot be updated.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIR, '..')
const HOOKS_DIR = path.join(WORKSPACE_ROOT, '.githooks')
const optional = process.argv.includes('--optional')

function capture(command, args, opts = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...opts })
  return result.status === 0 ? result.stdout.trim() : ''
}

const repoRoot = capture('git', ['rev-parse', '--show-toplevel'], { cwd: WORKSPACE_ROOT })
if (!repoRoot) {
  console.warn('[dux hooks] not inside a git checkout; skipping hook install.')
  process.exit(0)
}

const hooksPath = path.relative(repoRoot, HOOKS_DIR).split(path.sep).join('/')
const existing = capture('git', ['config', '--get', 'core.hooksPath'], { cwd: repoRoot })

if (existing === hooksPath) {
  console.log(`[dux hooks] core.hooksPath already set to ${hooksPath}`)
  process.exit(0)
}

const result = spawnSync('git', ['config', 'core.hooksPath', hooksPath], {
  cwd: repoRoot,
  encoding: 'utf8',
})
if (result.status !== 0) {
  const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  const message = `[dux hooks] could not set core.hooksPath${details ? `: ${details}` : '.'}`
  if (optional) {
    console.warn(`${message} Re-run without --optional when Git config is writable.`)
    process.exit(0)
  }
  console.error(message)
  process.exit(result.status ?? 1)
}

if (existing) {
  console.log(`[dux hooks] core.hooksPath changed from ${existing} to ${hooksPath}`)
  process.exit(0)
}

console.log(`[dux hooks] core.hooksPath set to ${hooksPath}`)
