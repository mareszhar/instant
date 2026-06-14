#!/usr/bin/env node

/**
 * Runs a supported script command across the main demo and all sandbox demos.
 *
 * Maintainer intent:
 * - one entrypoint to fan out common demo-wide commands (`upi`, `typecheck`, `build`)
 * - predictable logging and failure behavior
 * - no resolution rewiring or refresh side effects (this script only runs commands)
 *
 * Usage:
 * - node scripts/command-demo-all.mjs --command upi
 * - node scripts/command-demo-all.mjs --command typecheck
 * - node scripts/command-demo-all.mjs --command build
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WORKSPACE_ROOT = path.resolve(__dirname, '..')
const MAIN_DEMO_ROOT = path.resolve(WORKSPACE_ROOT, 'idb-dux/demo')
const SANDBOX_ROOT = path.resolve(WORKSPACE_ROOT, 'sandbox')

const SUPPORTED_COMMANDS = new Set(['upi', 'typecheck', 'build'])

function parseArgs(argv) {
  let command = null

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--command') {
      command = argv[index + 1] ?? null
      index += 1
      continue
    }
  }

  return { command }
}

function printUsageAndExit() {
  console.error('Usage: node scripts/command-demo-all.mjs --command <upi|typecheck|build>')
  process.exit(1)
}

function isDirectory(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
}

function hasPackageJson(directoryPath) {
  return fs.existsSync(path.resolve(directoryPath, 'package.json'))
}

function getSandboxDemoRoots() {
  if (!isDirectory(SANDBOX_ROOT)) {
    return []
  }

  return fs
    .readdirSync(SANDBOX_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.resolve(SANDBOX_ROOT, entry.name))
    .filter(demoRoot => hasPackageJson(demoRoot))
    .sort()
}

function getAllDemoRoots() {
  const roots = []

  if (hasPackageJson(MAIN_DEMO_ROOT)) {
    roots.push(MAIN_DEMO_ROOT)
  }

  roots.push(...getSandboxDemoRoots())
  return roots
}

function runCommandForDemo(command, demoRoot) {
  console.log(`[demo-command:${command}] running in ${path.relative(WORKSPACE_ROOT, demoRoot)}`)

  const result = spawnSync('pnpm', ['--dir', demoRoot, 'run', command], {
    cwd: WORKSPACE_ROOT,
    stdio: 'inherit',
    encoding: 'utf8',
    env: {
      ...process.env,
    },
  })

  if (result.status === 0) {
    return
  }

  throw new Error(
    `${command} failed in ${path.relative(WORKSPACE_ROOT, demoRoot)} (exit ${result.status ?? 'unknown'})`,
  )
}

const { command } = parseArgs(process.argv.slice(2))
if (!command || SUPPORTED_COMMANDS.has(command) === false) {
  printUsageAndExit()
}

const demoRoots = getAllDemoRoots()
if (demoRoots.length === 0) {
  console.log(`[demo-command:${command}] no demos found; nothing to do.`)
  process.exit(0)
}

for (const demoRoot of demoRoots) {
  runCommandForDemo(command, demoRoot)
}

console.log(`[demo-command:${command}] complete (${demoRoots.length} demo${demoRoots.length === 1 ? '' : 's'})`)
