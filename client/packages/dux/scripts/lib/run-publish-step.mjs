/**
 * Run and log shell steps for the publishing scripts.
 *
 * One `run`/`capture`/`sleep` so every publish script spawns the same way
 * (inherited stdio, merged env, uniform error text) and reads the same.
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'

/** Run a command, inheriting stdio by default; throw with context on failure. */
export function run(command, args, opts = {}) {
  const { env, ...rest } = opts
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    encoding: 'utf8',
    ...rest,
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) {
    const printable = [command, ...args].join(' ')
    const details = [result.error?.message, result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    const status = result.status ?? result.error?.code ?? '?'
    throw new Error(`Command failed (${status}): ${printable}${details ? `\n${details}` : ''}`)
  }
  return result
}

/** Run a command and return trimmed stdout (never throws; '' on failure). */
export function capture(command, args, opts = {}) {
  const { env, ...rest } = opts
  return spawnSync(command, args, {
    encoding: 'utf8',
    ...rest,
    env: { ...process.env, ...env },
  }).stdout?.trim() ?? ''
}

/** Run a command quietly and report only whether it exited successfully. */
export function succeeds(command, args, opts = {}) {
  const { env, ...rest } = opts
  return spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    ...rest,
    env: { ...process.env, ...env },
  }).status === 0
}

/** Block the event loop for `ms` (used by the npm-availability poll). */
export function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** A tagged console; `fail` prints and exits non-zero. */
export function createLogger(tag) {
  return {
    log: msg => console.log(`[${tag}] ${msg}`),
    warn: msg => console.warn(`[${tag}] ${msg}`),
    error: msg => console.error(`[${tag}] ${msg}`),
    fail: (msg) => {
      console.error(`[${tag}] ${msg}`)
      process.exit(1)
    },
  }
}
