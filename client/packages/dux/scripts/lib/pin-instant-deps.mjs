/**
 * Rewrite fork-local Instant workspace deps to the concrete shared Instant
 * version for npm/public projections.
 */
import fs from 'node:fs'
import { NPM_CACHE, PKG_DIR, SHARED_VERSION_SRC } from './resolve-publish-paths.mjs'
import { capture } from './run-publish-step.mjs'

export const DEP_SECTIONS = ['dependencies', 'peerDependencies', 'devDependencies']

export function readSharedInstantVersion() {
  const src = fs.readFileSync(SHARED_VERSION_SRC, 'utf8')
  const match = src.match(/const\s+version\s*=\s*'v([^']+)'/)
  if (!match)
    throw new Error(`could not find a version in ${SHARED_VERSION_SRC} (expected: const version = 'vX.Y.Z')`)
  return match[1].trim()
}

export function pinInstantDeps(pkg, version) {
  const pinned = new Set()
  for (const section of DEP_SECTIONS) {
    const deps = pkg[section]
    if (!deps)
      continue
    for (const [name, spec] of Object.entries(deps)) {
      if (name.startsWith('@instantdb/') && typeof spec === 'string' && spec.startsWith('workspace:')) {
        deps[name] = version
        pinned.add(name)
      }
    }
  }
  return [...pinned].sort()
}

export function instantDepNames(pkg) {
  const names = new Set()
  for (const section of DEP_SECTIONS) {
    const deps = pkg[section]
    if (!deps)
      continue
    for (const name of Object.keys(deps)) {
      if (name.startsWith('@instantdb/'))
        names.add(name)
    }
  }
  return [...names].sort()
}

/**
 * Assert a concrete version is resolvable on npm. Pass `preferOnline` when
 * polling for a *just-published* version: without it `npm view` can serve a
 * packument cached by an earlier poll that predates propagation, so every later
 * poll reads the same stale "not found" and the wait times out against its own
 * cache. `--prefer-online` revalidates each call.
 */
export function assertPackageVersionOnNpm(pkg, version, { preferOnline = false } = {}) {
  const got = capture('npm', ['view', `${pkg}@${version}`, 'version', ...(preferOnline ? ['--prefer-online'] : [])], {
    cwd: PKG_DIR,
    env: { npm_config_cache: NPM_CACHE },
  })
  if (got !== version)
    throw new Error(`${pkg}@${version} is not on npm (got "${got || 'nothing'}").`)
}

export function assertInstantDepsOnNpm(names, version) {
  for (const name of names)
    assertPackageVersionOnNpm(name, version)
}
