#!/usr/bin/env node

/**
 * Publish the dux demo (the public starter) to the hosting platforms we support
 * — currently Vercel only, but the script and its commands are deliberately
 * vendor-neutral so a second platform (Netlify, …) is a one-entry addition, not
 * a rename (dux-spec-workspace.md §6.4).
 *
 * The demo resolves dux via link / tarball / npm modes; only **npm** mode is
 * buildable on a hosting platform (no bun links or local tarballs there). So a
 * deploy pins the demo to a concrete published `@mszr/idb-dux@<version>` (never
 * a floating `latest`), proves that version is on npm, refreshes + builds the
 * demo locally as a smoke test, then deploys.
 *
 * Runnable ad hoc:
 *   pnpm run publish:demo:prev     # preview
 *   pnpm run publish:demo:prod     # production
 * or driven by `publish:sdk:*` (which prepares the demo, commits it, then asks
 * this to deploy — without re-verifying).
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { DEMO_DIR, DEMO_PKG, NPM_CACHE, PKG_DIR, PKG_NAME, WORKSPACE_ROOT } from './lib/resolve-publish-paths.mjs'
import { runPrepublishGates } from './lib/run-prepublish-gates.mjs'
import { capture, createLogger, run } from './lib/run-publish-step.mjs'

const log = createLogger('demo')

const DEP_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']

// The platforms a demo deploy targets. Vendor names live here and nowhere in
// the command/script names. Add a platform = add an entry.
const PLATFORMS = [
  {
    name: 'vercel',
    deploy({ prod, passThrough }) {
      run('vercel', [...(prod ? ['--prod'] : []), ...passThrough], { cwd: DEMO_DIR })
    },
  },
]

/** The latest version of @mszr/idb-dux on npm (or '' if unpublished). */
function latestPublishedVersion() {
  return capture('npm', ['view', `${PKG_NAME}`, 'version'], { cwd: PKG_DIR, env: { npm_config_cache: NPM_CACHE } })
}

/** Assert a concrete version is resolvable on npm. */
function assertOnNpm(version) {
  const got = capture('npm', ['view', `${PKG_NAME}@${version}`, 'version'], { cwd: PKG_DIR, env: { npm_config_cache: NPM_CACHE } })
  if (got !== version)
    log.fail(`${PKG_NAME}@${version} is not on npm (got "${got || 'nothing'}"). Publish the SDK first.`)
}

/** Pin the demo's @mszr/idb-dux spec to an exact published version. */
function pinDemoToVersion(version) {
  const manifest = JSON.parse(fs.readFileSync(DEMO_PKG, 'utf8'))
  const field = DEP_FIELDS.find(f => manifest[f] && PKG_NAME in manifest[f])
  if (!field)
    log.fail(`the demo does not depend on ${PKG_NAME}.`)

  const spec = `npm:${PKG_NAME}@${version}`
  if (manifest[field][PKG_NAME] === spec) {
    log.log(`demo already pinned to ${spec}`)
    return
  }
  manifest[field][PKG_NAME] = spec
  fs.writeFileSync(DEMO_PKG, `${JSON.stringify(manifest, null, 2)}\n`)
  log.log(`pinned demo ${field}.${PKG_NAME} → ${spec}`)
}

/** Guard: the demo must be in npm mode before a platform build can resolve dux. */
function assertNpmMode() {
  const manifest = JSON.parse(fs.readFileSync(DEMO_PKG, 'utf8'))
  const spec = DEP_FIELDS.map(f => manifest[f]?.[PKG_NAME]).find(Boolean)
  if (typeof spec !== 'string' || !spec.startsWith('npm:'))
    log.fail(`demo is not in npm mode (${PKG_NAME} = ${spec ?? 'missing'}). A platform can't build link/tarball modes.`)
}

/**
 * Put the demo in npm mode pinned to `version` (default: latest published),
 * prove it on npm, then refresh + build it as a local smoke test.
 * @returns the resolved version it was pinned to.
 */
export function prepareDemoForNpm({ version, logger = log } = {}) {
  const resolved = version ?? latestPublishedVersion()
  if (!resolved)
    logger.fail(`no published version of ${PKG_NAME} found on npm — publish the SDK first.`)
  assertOnNpm(resolved)

  logger.log(`switching demo to npm mode @ ${resolved}`)
  run('pnpm', ['run', 'sdk:demo:main:idb:npm'], { cwd: WORKSPACE_ROOT })
  pinDemoToVersion(resolved)

  logger.log('refreshing demo (clean caches · install · prep)')
  run('pnpm', ['run', 'sdk:demo:main:refresh'], { cwd: WORKSPACE_ROOT })

  logger.log('building demo (smoke test)')
  run('pnpm', ['run', 'sdk:demo:main:build'], { cwd: WORKSPACE_ROOT })
  return resolved
}

/** Deploy the (already npm-pinned + built) demo to every supported platform. */
export function deployDemo({ prod = false, passThrough = [], logger = log } = {}) {
  assertNpmMode()
  for (const platform of PLATFORMS) {
    logger.log(`deploying via ${platform.name}${prod ? ' (production)' : ' (preview)'}`)
    platform.deploy({ prod, passThrough })
  }
}

/** Ad-hoc entry: verify, prepare, deploy. */
export function publishDemo({ version, prod = false, passThrough = [], skipVerify = false } = {}) {
  if (!skipVerify)
    runPrepublishGates({ logger: log })
  const resolved = prepareDemoForNpm({ version })
  deployDemo({ prod, passThrough })
  log.log(`done — demo deployed @ ${resolved}.`)
}

// CLI entry — only when invoked directly, not when imported by publish-sdk.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2)
  const dashIndex = argv.indexOf('--')
  const passThrough = dashIndex !== -1 ? argv.slice(dashIndex + 1) : []
  const flags = dashIndex !== -1 ? argv.slice(0, dashIndex) : argv
  const versionIndex = flags.indexOf('--version')
  const prev = flags.includes('--prev')
  const prod = flags.includes('--prod')
  if (prev === prod)
    log.fail('usage: publish-demo.mjs (--prev|--prod) [--version <version>] [-- <extra platform args>]')
  publishDemo({
    version: versionIndex !== -1 ? flags[versionIndex + 1] : undefined,
    prod,
    passThrough,
  })
}
