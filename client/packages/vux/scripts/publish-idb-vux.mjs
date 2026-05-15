#!/usr/bin/env node

/**
 * Maintainer publish utility for `@mszr/idb-vux`.
 *
 * Why this exists:
 * - local workspace package manifests use `workspace:*` for Instant dependencies
 * - `pnpm pack` rewrites `workspace:*` to the current workspace package version
 * - in this repo that baseline is often `0.0.0`, which is not publishable for
 *   external consumers
 *
 * What this script does:
 * 1) reads the monorepo's shared JS version source (`packages/version/src/version.ts`)
 * 2) temporarily pins `@instantdb/core` and `@instantdb/version` in
 *    `idb-vux/package.json` to that exact version
 * 3) verifies those versions exist on npm registry
 * 4) builds, packs, and publishes `@mszr/idb-vux`
 * 5) restores the original `package.json` even on failure
 *
 * This keeps publish-time dependency pins aligned to the local repo state while
 * preserving `workspace:*` for day-to-day local development.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VUE_ROOT = path.resolve(__dirname, '..')
const IDB_VUE_ROOT = path.resolve(VUE_ROOT, 'idb-vux')
const IDB_VUE_PACKAGE_JSON_PATH = path.resolve(IDB_VUE_ROOT, 'package.json')
const SHARED_VERSION_SOURCE_PATH = path.resolve(VUE_ROOT, '../version/src/version.ts')
const NPM_CACHE_PATH = path.resolve(VUE_ROOT, '.npm-cache')

const TARGET_DEPS = ['@instantdb/core', '@instantdb/version']

function runOrThrow(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? IDB_VUE_ROOT,
    stdio: options.stdio ?? 'inherit',
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_cache: NPM_CACHE_PATH,
      ...options.env,
    },
  })

  if (result.status === 0) {
    return result
  }

  const printableCommand = [command, ...args].join(' ')
  const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  throw new Error(
    details
      ? `Command failed (${result.status ?? 'unknown'}): ${printableCommand}\n${details}`
      : `Command failed (${result.status ?? 'unknown'}): ${printableCommand}`,
  )
}

function parseSharedVersionFromSource(sourceText) {
  const match = sourceText.match(/const\s+version\s*=\s*'v([^']+)'\s*;/)
  if (!match) {
    throw new Error(
      `Could not find shared version in ${SHARED_VERSION_SOURCE_PATH}. Expected: const version = 'vX.Y.Z'`,
    )
  }

  const version = match[1]?.trim()
  if (!version) {
    throw new Error(`Resolved empty shared version from ${SHARED_VERSION_SOURCE_PATH}`)
  }

  const isSemverLike = /^\d+\.\d+\.\d+(?:[-+][0-9a-z.-]+)?$/i.test(version)
  if (!isSemverLike) {
    throw new Error(
      `Resolved shared version '${version}' is not semver-like. Source: ${SHARED_VERSION_SOURCE_PATH}`,
    )
  }

  return version
}

function loadSharedRepoVersion() {
  const sourceText = fs.readFileSync(SHARED_VERSION_SOURCE_PATH, 'utf8')
  return parseSharedVersionFromSource(sourceText)
}

function writePackageJson(packageJsonPath, value) {
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(value, null, 2)}\n`)
}

function pinInstantDeps(packageJson, pinnedVersion) {
  const next = { ...packageJson }
  const dependencies = {
    ...(next.dependencies ?? {}),
  }

  for (const depName of TARGET_DEPS) {
    dependencies[depName] = pinnedVersion
  }

  next.dependencies = dependencies
  return next
}

function assertRegistryVersionExists(packageName, version) {
  const result = runOrThrow(
    'npm',
    ['view', `${packageName}@${version}`, 'version', '--json'],
    {
      cwd: IDB_VUE_ROOT,
      stdio: 'pipe',
    },
  )

  const output = `${result.stdout ?? ''}`.trim()
  const normalized = output.replace(/^"|"$/g, '')
  if (normalized !== version) {
    throw new Error(
      `Registry check returned unexpected version for ${packageName}: expected ${version}, got ${output || '(empty)'}.
If this repo is stale, rebase and retry.`,
    )
  }
}

function cleanupLocalTarballs() {
  for (const entry of fs.readdirSync(IDB_VUE_ROOT, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.tgz')) {
      fs.unlinkSync(path.resolve(IDB_VUE_ROOT, entry.name))
    }
  }
}

function findNewestLocalTarball() {
  const tarballs = fs
    .readdirSync(IDB_VUE_ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tgz'))
    .map((entry) => {
      const tarballPath = path.resolve(IDB_VUE_ROOT, entry.name)
      return {
        name: entry.name,
        path: tarballPath,
        mtimeMs: fs.statSync(tarballPath).mtimeMs,
      }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  return tarballs[0] ?? null
}

function publishIdbVue() {
  const pinnedVersion = loadSharedRepoVersion()
  const originalPackageJsonRaw = fs.readFileSync(IDB_VUE_PACKAGE_JSON_PATH, 'utf8')
  const originalPackageJson = JSON.parse(originalPackageJsonRaw)
  const pinnedPackageJson = pinInstantDeps(originalPackageJson, pinnedVersion)

  console.log(`[idb-vux publish] using shared repo version: ${pinnedVersion}`)
  console.log('[idb-vux publish] verifying registry availability for pinned Instant dependencies...')
  for (const depName of TARGET_DEPS) {
    assertRegistryVersionExists(depName, pinnedVersion)
    console.log(`[idb-vux publish]   ok: ${depName}@${pinnedVersion}`)
  }

  let wrotePinnedManifest = false

  try {
    if (JSON.stringify(originalPackageJson) !== JSON.stringify(pinnedPackageJson)) {
      writePackageJson(IDB_VUE_PACKAGE_JSON_PATH, pinnedPackageJson)
      wrotePinnedManifest = true
      console.log('[idb-vux publish] temporarily pinned Instant deps in idb-vux/package.json')
    }

    runOrThrow('pnpm', ['run', 'build'])
    cleanupLocalTarballs()
    runOrThrow('pnpm', ['pack', '--pack-destination', '.'])

    const tarball = findNewestLocalTarball()
    if (!tarball) {
      throw new Error('Could not find packed tarball after `pnpm pack`.')
    }

    runOrThrow('npm', ['publish', tarball.name, '--access', 'public'])
    console.log(`[idb-vux publish] published ${tarball.name}`)
  }
  finally {
    if (wrotePinnedManifest) {
      fs.writeFileSync(IDB_VUE_PACKAGE_JSON_PATH, originalPackageJsonRaw)
      console.log('[idb-vux publish] restored original idb-vux/package.json')
    }
  }
}

try {
  publishIdbVue()
}
catch (error) {
  console.error(
    `[idb-vux publish] failed: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
}
