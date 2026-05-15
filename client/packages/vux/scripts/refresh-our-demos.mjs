#!/usr/bin/env node

/**
 * Maintainer utility to refresh demo runtime state after SDK edits.
 *
 * Scope:
 * - clears runtime/build caches for selected demos (`.nuxt`, `.output`, Vite/Nuxt cache dirs)
 * - reinstalls dependencies for selected demos (`bun install --force`)
 * - regenerates Nuxt prep artifacts (`nuxt prepare` via each demo's `prep` script)
 *
 * Explicitly out of scope:
 * - does not change dependency resolution mode (links/tarballs/npm)
 * - does not build SDK packages
 * - does not generate tarballs
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VUE_ROOT = path.resolve(__dirname, '..')
const MAIN_DEMO_ROOT = path.resolve(VUE_ROOT, 'idb-vux/demo')
const SANDBOX_ROOT = path.resolve(VUE_ROOT, 'sandbox')

const RUNTIME_CACHE_PATHS = [
  '.nuxt',
  '.output',
  'node_modules/.cache/vite',
  'node_modules/.cache/nuxt',
]

function parseArgs(argv) {
  const result = {
    _: [],
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]

    if (!token.startsWith('--')) {
      result._.push(token)
      continue
    }

    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      result[key] = true
      continue
    }

    result[key] = next
    i++
  }

  return result
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

function resolveDemoRootByName(name) {
  if (name === 'main') {
    return MAIN_DEMO_ROOT
  }

  const sandboxDemoRoots = getSandboxDemoRoots()
  const match = sandboxDemoRoots.find(demoRoot => path.basename(demoRoot) === name)
  if (match) {
    return match
  }

  throw new Error(
    `Unknown demo '${name}'. Use main or one of: ${sandboxDemoRoots.map(root => path.basename(root)).join(', ') || '(no sandbox demos found)'}`,
  )
}

function getTargetDemoRoots(scope, pickedDemoName) {
  if (scope === 'main') {
    return [MAIN_DEMO_ROOT]
  }

  if (scope === 'sandbox') {
    return getSandboxDemoRoots()
  }

  if (scope === 'all') {
    return [MAIN_DEMO_ROOT, ...getSandboxDemoRoots()]
  }

  if (scope === 'pick') {
    if (typeof pickedDemoName !== 'string' || !pickedDemoName.trim()) {
      throw new Error('Missing --demo for scope "pick". Example: --demo main or --demo demo-preclean')
    }

    return [resolveDemoRootByName(pickedDemoName.trim())]
  }

  throw new Error(`Unsupported refresh scope '${scope}'`)
}

function pickWritableTempDir() {
  const candidates = [
    process.env.TMPDIR,
    '/private/tmp',
    path.resolve(VUE_ROOT, '.tmp'),
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      fs.mkdirSync(candidate, { recursive: true })
      fs.accessSync(candidate, fs.constants.W_OK)
      return candidate
    }
    catch {
      continue
    }
  }

  return undefined
}

function runOrThrow(command, args) {
  const tempDir = pickWritableTempDir()
  const env = {
    ...process.env,
  }

  if (tempDir) {
    env.TMPDIR = tempDir
    env.TMP = tempDir
    env.TEMP = tempDir
  }

  const result = spawnSync(command, args, {
    cwd: VUE_ROOT,
    stdio: 'inherit',
    encoding: 'utf8',
    env,
  })

  if (result.status === 0) {
    return
  }

  const printableCommand = [command, ...args].join(' ')
  throw new Error(`Command failed (${result.status ?? 'unknown'}): ${printableCommand}`)
}

function clearDemoCaches(demoRoot) {
  for (const relativeCachePath of RUNTIME_CACHE_PATHS) {
    const absoluteCachePath = path.resolve(demoRoot, relativeCachePath)
    fs.rmSync(absoluteCachePath, {
      recursive: true,
      force: true,
    })
  }
}

function refreshDemo(
  demoRoot,
  options = { install: true, prep: true },
) {
  if (!hasPackageJson(demoRoot)) {
    throw new Error(`No package.json found in demo path: ${demoRoot}`)
  }

  console.log(`[demo-refresh] clearing runtime caches: ${path.relative(VUE_ROOT, demoRoot)}`)
  clearDemoCaches(demoRoot)

  if (options.install) {
    console.log(`[demo-refresh] reinstalling dependencies: ${path.relative(VUE_ROOT, demoRoot)}`)
    runOrThrow('bun', ['install', '--cwd', demoRoot, '--force'])
  }

  if (options.prep) {
    console.log(`[demo-refresh] regenerating Nuxt prep artifacts: ${path.relative(VUE_ROOT, demoRoot)}`)
    runOrThrow('pnpm', ['--dir', demoRoot, 'run', 'prep'])
  }
}

function printUsageAndExit() {
  console.error('Usage:')
  console.error('  node scripts/refresh-our-demos.mjs <main|all|sandbox|pick> [--demo <main|sandbox-demo-name>] [--skip-install] [--skip-prep]')
  process.exit(1)
}

const argv = parseArgs(process.argv.slice(2))
const scope = argv._[0]

if (!scope || !new Set(['main', 'all', 'sandbox', 'pick']).has(scope)) {
  printUsageAndExit()
}

const demoRoots = getTargetDemoRoots(scope, argv.demo)

if (demoRoots.length === 0) {
  console.log('[demo-refresh] no demos matched this target; nothing to do.')
  process.exit(0)
}

for (const demoRoot of demoRoots) {
  refreshDemo(demoRoot, {
    install: !argv['skip-install'],
    prep: !argv['skip-prep'],
  })
}

console.log(
  `[demo-refresh] complete (${demoRoots.length} demo${demoRoots.length === 1 ? '' : 's'})`,
)
