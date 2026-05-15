#!/usr/bin/env node

/**
 * Maintainer utility to inspect or set InstantDB dependency resolution mode for
 * Vue demos.
 *
 * Scope:
 * - updates only dependency specs in demo package manifests (and matching
 *   overrides/resolutions entries when present)
 * - keeps Nuxt/Vite link-mode compatibility config in sync per selected mode
 * - supports main demo (`idb-vux/demo`) and sandbox demos (`sandbox/*`)
 *
 * Out of scope:
 * - does not build SDK artifacts
 * - does not generate tarballs
 * - does not install dependencies
 * - does not clear caches or run Nuxt prep
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { patchDemoLinkModeViteConfig } from './patch-demo-link-mode-vite.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VUE_ROOT = path.resolve(__dirname, '..')
const MAIN_DEMO_ROOT = path.resolve(VUE_ROOT, 'idb-vux/demo')
const SANDBOX_ROOT = path.resolve(VUE_ROOT, 'sandbox')
const PACKS_DIR = path.resolve(VUE_ROOT, 'packs')

const MODE = {
  LINKS: 'links',
  TARBALLS: 'tarballs',
  NPM: 'npm',
}

const MODE_VALUES = new Set(Object.values(MODE))

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]
const RESOLUTION_FIELDS = ['overrides', 'resolutions']
const MANIFEST_FIELDS = [...DEPENDENCY_FIELDS, ...RESOLUTION_FIELDS]

const TRANSITIVE_IDB_DEPS = [
  '@instantdb/core',
  '@instantdb/version',
  '@instantdb/webhooks',
]

const RESOLUTION_RULES = {
  '@mszr/idb-vux': {
    tarballPattern: /^mszr-idb-vux-.*\.tgz$/,
    linkSpec: 'link:@mszr/idb-vux',
    npmSpec: 'npm:@mszr/idb-vux@latest',
  },
  '@instantdb/admin': {
    tarballPattern: /^instantdb-admin-.*\.tgz$/,
    linkSpec: 'link:@instantdb/admin',
    npmSpec: 'npm:@instantdb/admin@latest',
  },
  '@instantdb/core': {
    tarballPattern: /^instantdb-core-.*\.tgz$/,
    linkSpec: 'link:@instantdb/core',
    npmSpec: 'npm:@instantdb/core@latest',
  },
  '@instantdb/version': {
    tarballPattern: /^instantdb-version-.*\.tgz$/,
    linkSpec: 'link:@instantdb/version',
    npmSpec: 'npm:@instantdb/version@latest',
  },
  '@instantdb/webhooks': {
    tarballPattern: /^instantdb-webhooks-.*\.tgz$/,
    linkSpec: 'link:@instantdb/webhooks',
    npmSpec: 'npm:@instantdb/webhooks@latest',
  },
}

const TARGET_DEPENDENCIES = Object.keys(RESOLUTION_RULES)

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/')
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

function resolveDemoRoots(selector) {
  const sandboxDemoRoots = getSandboxDemoRoots()
  const demoByName = new Map(
    sandboxDemoRoots.map(demoRoot => [path.basename(demoRoot), demoRoot]),
  )

  if (selector === 'main') {
    return [MAIN_DEMO_ROOT]
  }

  if (selector === 'sandbox') {
    return sandboxDemoRoots
  }

  if (selector === 'all') {
    return [MAIN_DEMO_ROOT, ...sandboxDemoRoots]
  }

  const sandboxDemoRoot = demoByName.get(selector)
  if (sandboxDemoRoot) {
    return [sandboxDemoRoot]
  }

  throw new Error(
    `Unknown demo selector '${selector}'. Use main, sandbox, all, or one of: ${[...demoByName.keys()].join(', ') || '(no sandbox demos found)'}`,
  )
}

function findMatchingTarball(pattern) {
  const entries = fs
    .readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile() && pattern.test(entry.name))
    .map((entry) => {
      const fullPath = path.resolve(PACKS_DIR, entry.name)
      return {
        name: entry.name,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  return entries[0]?.name ?? null
}

function resolveTarballSpec(depName, demoRoot) {
  const rule = RESOLUTION_RULES[depName]
  const tarballName = findMatchingTarball(rule.tarballPattern)

  if (!tarballName) {
    throw new Error(
      `Missing local tarball for ${depName}. Expected a file matching ${rule.tarballPattern} in ${PACKS_DIR}. Run: pnpm run sdk:pack:all`,
    )
  }

  const tarballPath = path.resolve(PACKS_DIR, tarballName)
  const relativePath = toPosixPath(path.relative(demoRoot, tarballPath))

  return `file:${relativePath}`
}

function resolveSpec(mode, depName, demoRoot) {
  const rule = RESOLUTION_RULES[depName]

  if (mode === MODE.TARBALLS)
    return resolveTarballSpec(depName, demoRoot)
  if (mode === MODE.LINKS)
    return rule.linkSpec
  if (mode === MODE.NPM)
    return rule.npmSpec

  throw new Error(`Unsupported mode: ${mode}`)
}

function ensureRecordField(manifest, field) {
  if (!isRecord(manifest[field]))
    manifest[field] = {}
  return manifest[field]
}

function deleteFieldIfEmptyRecord(manifest, field) {
  if (!isRecord(manifest[field])) {
    return
  }

  if (Object.keys(manifest[field]).length === 0) {
    delete manifest[field]
  }
}

function collectTrackedEntries(manifest) {
  const entries = []

  for (const field of MANIFEST_FIELDS) {
    const map = manifest[field]
    if (!isRecord(map)) {
      continue
    }

    for (const depName of TARGET_DEPENDENCIES) {
      if (Object.hasOwn(map, depName)) {
        entries.push({
          field,
          depName,
          currentSpec: map[depName],
        })
      }
    }
  }

  return entries
}

function applyChange(manifest, changes, field, depName, nextSpec) {
  const map = ensureRecordField(manifest, field)
  const previous = map[depName]

  if (previous === nextSpec) {
    return
  }

  map[depName] = nextSpec
  changes.push({ field, depName, previous: previous ?? '(missing)', next: nextSpec })
}

function deleteDepKey(manifest, changes, field, depName) {
  const map = manifest[field]
  if (!isRecord(map) || !Object.hasOwn(map, depName)) {
    return
  }

  const previous = map[depName]
  delete map[depName]
  changes.push({ field, depName, previous, next: '(removed)' })
}

function hasAnyTrackedIdbDependency(manifest) {
  for (const field of DEPENDENCY_FIELDS) {
    const map = manifest[field]
    if (!isRecord(map)) {
      continue
    }

    if (TARGET_DEPENDENCIES.some(depName => Object.hasOwn(map, depName))) {
      return true
    }
  }

  return false
}

function applyModeToDemoManifest(demoRoot, mode) {
  const manifestPath = path.resolve(demoRoot, 'package.json')
  const lockPath = path.resolve(demoRoot, 'bun.lock')
  const manifest = readJson(manifestPath)
  const trackedEntries = collectTrackedEntries(manifest)
  const changes = []
  const hadFileBasedEntries = trackedEntries.some(entry => String(entry.currentSpec).startsWith('file:'))

  for (const entry of trackedEntries) {
    if (mode !== MODE.TARBALLS && RESOLUTION_FIELDS.includes(entry.field)) {
      continue
    }

    const nextSpec = resolveSpec(mode, entry.depName, demoRoot)
    applyChange(manifest, changes, entry.field, entry.depName, nextSpec)
  }

  if (mode === MODE.TARBALLS) {
    if (hasAnyTrackedIdbDependency(manifest)) {
      for (const field of RESOLUTION_FIELDS) {
        for (const depName of TRANSITIVE_IDB_DEPS) {
          applyChange(manifest, changes, field, depName, resolveSpec(mode, depName, demoRoot))
        }
      }
    }
  }
  else {
    for (const field of RESOLUTION_FIELDS) {
      for (const depName of TARGET_DEPENDENCIES) {
        deleteDepKey(manifest, changes, field, depName)
      }
    }
  }

  for (const field of RESOLUTION_FIELDS) {
    deleteFieldIfEmptyRecord(manifest, field)
  }

  if (mode !== MODE.TARBALLS && hadFileBasedEntries && fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath)
    console.log(`[demo-idb-resolution] removed bun.lock: ${path.relative(VUE_ROOT, lockPath)}`)
  }

  if (changes.length === 0) {
    console.log(`[demo-idb-resolution] already in '${mode}' mode: ${path.relative(VUE_ROOT, manifestPath)}`)
    return
  }

  writeJson(manifestPath, manifest)

  for (const change of changes) {
    console.log(
      `[demo-idb-resolution] ${path.relative(VUE_ROOT, manifestPath)} ${change.field}.${change.depName}: ${change.previous} -> ${change.next}`,
    )
  }

  console.log(`[demo-idb-resolution] updated ${changes.length} entr${changes.length === 1 ? 'y' : 'ies'} for ${path.relative(VUE_ROOT, demoRoot)}`)
}

function applyModeToDemoConfig(demoRoot, mode) {
  patchDemoLinkModeViteConfig({
    demoRoot,
    mode,
    vueRoot: VUE_ROOT,
  })
}

function detectEntryMode(depName, spec, demoRoot) {
  let tarballSpec = null
  try {
    tarballSpec = resolveTarballSpec(depName, demoRoot)
  }
  catch {
    tarballSpec = null
  }

  const linkSpec = resolveSpec(MODE.LINKS, depName, demoRoot)
  const npmSpec = resolveSpec(MODE.NPM, depName, demoRoot)

  if (tarballSpec && spec === tarballSpec) {
    return MODE.TARBALLS
  }
  if (spec === linkSpec) {
    return MODE.LINKS
  }
  if (spec === npmSpec) {
    return MODE.NPM
  }

  return 'custom'
}

function printDemoStatus(demoRoot) {
  const manifestPath = path.resolve(demoRoot, 'package.json')
  const manifest = readJson(manifestPath)
  const entries = collectTrackedEntries(manifest)

  console.log(`[demo-idb-resolution] manifest: ${path.relative(VUE_ROOT, manifestPath)}`)

  if (entries.length === 0) {
    console.log('[demo-idb-resolution] no tracked InstantDB deps found')
    return
  }

  const labels = []

  for (const entry of entries) {
    const label = detectEntryMode(entry.depName, entry.currentSpec, demoRoot)
    labels.push(label)
    console.log(`[demo-idb-resolution]   ${entry.field}.${entry.depName} = ${entry.currentSpec} (${label})`)
  }

  const allTarballs = labels.every(label => label === MODE.TARBALLS)
  const allLinks = labels.every(label => label === MODE.LINKS)
  const allNpm = labels.every(label => label === MODE.NPM)

  if (allTarballs)
    console.log(`[demo-idb-resolution]   overall mode: ${MODE.TARBALLS}`)
  else if (allLinks)
    console.log(`[demo-idb-resolution]   overall mode: ${MODE.LINKS}`)
  else if (allNpm)
    console.log(`[demo-idb-resolution]   overall mode: ${MODE.NPM}`)
  else
    console.log('[demo-idb-resolution]   overall mode: mixed/custom')
}

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

function printUsageAndExit() {
  console.error('Usage:')
  console.error('  node scripts/manage-demo-idb-resolution.mjs status --demo <main|sandbox|all|sandbox-demo-name>')
  console.error('  node scripts/manage-demo-idb-resolution.mjs set --demo <main|sandbox|all|sandbox-demo-name> --idb <links|tarballs|npm>')
  console.error('  node scripts/manage-demo-idb-resolution.mjs pick --demo <main|sandbox|all|sandbox-demo-name> [--idb <links|tarballs|npm>]')
  process.exit(1)
}

const argv = parseArgs(process.argv.slice(2))
const action = argv._[0]

if (!action || !new Set(['status', 'set', 'pick']).has(action)) {
  printUsageAndExit()
}

const demoSelector = typeof argv.demo === 'string' ? argv.demo : 'main'
const demoRoots = resolveDemoRoots(demoSelector)

if (action === 'status') {
  for (const demoRoot of demoRoots) {
    printDemoStatus(demoRoot)
  }
  process.exit(0)
}

const requestedMode = typeof argv.idb === 'string' ? argv.idb : null

if (action === 'pick' && !requestedMode) {
  for (const demoRoot of demoRoots) {
    printDemoStatus(demoRoot)
  }
  process.exit(0)
}

if (!requestedMode || !MODE_VALUES.has(requestedMode)) {
  console.error(`Missing or invalid --idb value: ${requestedMode ?? '(missing)'}`)
  console.error('Allowed values: links, tarballs, npm')
  process.exit(1)
}

for (const demoRoot of demoRoots) {
  applyModeToDemoManifest(demoRoot, requestedMode)
  applyModeToDemoConfig(demoRoot, requestedMode)
}
