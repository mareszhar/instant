#!/usr/bin/env node

/**
 * Publish `@mszr/idb-dux` to npm and orchestrate the release — from the fork
 * (dux-spec-workspace.md §6.2). This is the happy path:
 *
 *   pnpm run publish:sdk:patch | publish:sdk:minor | publish:sdk:major
 *   pnpm run publish:sdk:dry-run        # verify + packaging rehearsal, no publish
 *
 * Flow for a real release:
 *   1. prepublish:verify            shared gates, once
 *   2. read the fork's shared Instant version; prove each pinned dep is on npm
 *   3. bump @mszr/idb-dux's own version (persists)
 *   4. temporarily pin Instant workspace deps; build; npm publish --public
 *   5. restore the workspace deps (the bump stays)
 *   6. wait until npm view @mszr/idb-dux@<version> resolves
 *   7. prepare the demo: npm mode pinned to @<version> (not latest), refresh, build
 *   8. commit (version bump + demo pin) "🔖 release v<version>" and tag
 *   9. deploy the demo to production
 *  10. squash-publish the public subtree with "🔖 release v<version>"
 *
 * Verification runs ONCE (step 1); the demo + subtree steps are driven
 * in-process with skipVerify, so a release never re-runs gates it already ran.
 *
 * Any failure up to and including publish restores the original package.json.
 * After a successful publish the bump is permanent; a later step failing prints
 * how to resume with the ad-hoc commands (publish:demo:prod, publish:subtree:squash).
 */
import fs from 'node:fs'
import process from 'node:process'
import { assertInstantDepsOnNpm, assertPackageVersionOnNpm, pinInstantDeps, readSharedInstantVersion } from './lib/pin-instant-deps.mjs'
import { NPM_CACHE, PKG_DIR, PKG_JSON, PKG_NAME, WORKSPACE_ROOT } from './lib/resolve-publish-paths.mjs'
import { runPrepublishGates } from './lib/run-prepublish-gates.mjs'
import { capture, createLogger, run, sleep } from './lib/run-publish-step.mjs'
import { deployDemo, prepareDemoForNpm } from './publish-demo.mjs'
import { publishSubtree } from './publish-subtree.mjs'

const log = createLogger('sdk')

const VALID_TYPES = new Set(['patch', 'minor', 'major'])

/** Poll npm until the just-published version resolves (registry propagation). */
function waitForNpm(version, { timeoutMs = 180_000, intervalMs = 5_000 } = {}) {
  const deadline = Date.now() + timeoutMs
  log.log(`waiting for ${PKG_NAME}@${version} to resolve on npm…`)
  while (Date.now() < deadline) {
    try {
      assertPackageVersionOnNpm(PKG_NAME, version)
      log.log(`${PKG_NAME}@${version} is live on npm.`)
      return
    }
    catch {}
    sleep(intervalMs)
  }
  log.fail(`${PKG_NAME}@${version} did not appear on npm within ${timeoutMs / 1000}s. It may still be propagating; resume with: pnpm run publish:demo:prod && pnpm run publish:subtree:squash`)
}

const positional = process.argv.slice(2).filter(a => !a.startsWith('--'))
const dryRun = process.argv.includes('--dry-run')
const releaseType = positional[0]

if (dryRun && releaseType)
  log.fail('--dry-run takes no version (it rehearses packaging only).')
if (!dryRun && !VALID_TYPES.has(releaseType))
  log.fail('usage: publish-sdk.mjs <patch|minor|major> | --dry-run')

// 1) shared gate (once)
runPrepublishGates({ logger: log })

let sharedVersion
try {
  sharedVersion = readSharedInstantVersion()
}
catch (error) {
  log.fail(error instanceof Error ? error.message : String(error))
}
const originalRaw = fs.readFileSync(PKG_JSON, 'utf8')

// ── Dry run: pin → build → publish --dry-run → restore. No bump, no side effects.
if (dryRun) {
  log.log(`packaging rehearsal against shared Instant version ${sharedVersion}`)
  try {
    const pinned = JSON.parse(originalRaw)
    const pinnedNames = pinInstantDeps(pinned, sharedVersion)
    assertInstantDepsOnNpm(pinnedNames, sharedVersion)
    fs.writeFileSync(PKG_JSON, `${JSON.stringify(pinned, null, 2)}\n`)
    run('pnpm', ['run', 'sdk:build:ours'], { cwd: WORKSPACE_ROOT, env: { npm_config_cache: NPM_CACHE } })
    run('npm', ['publish', '--access', 'public', '--dry-run'], { cwd: PKG_DIR, env: { npm_config_cache: NPM_CACHE } })
  }
  finally {
    fs.writeFileSync(PKG_JSON, originalRaw)
  }
  log.log('dry-run complete (package.json restored; nothing published).')
  process.exit(0)
}

// ── Real release.
// 2) shared Instant version must be on npm before we pin to it.
log.log(`shared Instant version: ${sharedVersion}`)
try {
  const pinnedProbe = JSON.parse(originalRaw)
  const pinnedNames = pinInstantDeps(pinnedProbe, sharedVersion)
  assertInstantDepsOnNpm(pinnedNames, sharedVersion)
  log.log(`ok on npm: ${pinnedNames.map(dep => `${dep}@${sharedVersion}`).join(', ')}`)
}
catch (error) {
  log.fail(error instanceof Error ? error.message : String(error))
}

// 2b) npm auth — needed to publish.
if (!capture('npm', ['whoami'], { cwd: PKG_DIR, env: { npm_config_cache: NPM_CACHE } }))
  log.fail('not logged in to npm. Run `npm login` first (sessions expire — re-auth before each release).')

let releasedVersion
try {
  // 3) bump our own version (persists past restore).
  run('npm', ['version', releaseType, '--no-git-tag-version'], { cwd: PKG_DIR, stdio: 'pipe', env: { npm_config_cache: NPM_CACHE } })
  releasedVersion = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8')).version
  log.log(`${PKG_NAME} → v${releasedVersion}`)

  // Restore target: bumped version, workspace deps intact.
  const bumpedRaw = fs.readFileSync(PKG_JSON, 'utf8')

  // 4) pin Instant deps, build, publish.
  const pinned = JSON.parse(bumpedRaw)
  pinInstantDeps(pinned, sharedVersion)
  fs.writeFileSync(PKG_JSON, `${JSON.stringify(pinned, null, 2)}\n`)
  run('pnpm', ['run', 'sdk:build:ours'], { cwd: WORKSPACE_ROOT, env: { npm_config_cache: NPM_CACHE } })
  run('npm', ['publish', '--access', 'public'], { cwd: PKG_DIR, env: { npm_config_cache: NPM_CACHE } })
  log.log(`published ${PKG_NAME}@${releasedVersion}`)

  // 5) restore workspace deps (keep the bump).
  fs.writeFileSync(PKG_JSON, bumpedRaw)
}
catch (error) {
  fs.writeFileSync(PKG_JSON, originalRaw)
  log.fail(error instanceof Error ? error.message : String(error))
}

// Past this point the package is on npm; the bump must stand. On any failure we
// keep the bump and tell the maintainer how to resume from the ad-hoc commands.
try {
  // 6) wait for registry propagation.
  waitForNpm(releasedVersion)

  // 7) prepare the demo: npm mode pinned to the exact released version, refresh, build.
  prepareDemoForNpm({ version: releasedVersion, logger: log })

  // 8) commit the release (version bump + demo pin) and tag.
  run('git', ['add', PKG_DIR], { cwd: WORKSPACE_ROOT })
  run('git', ['commit', '-m', `🔖 release v${releasedVersion}`], { cwd: WORKSPACE_ROOT })
  run('git', ['tag', `v${releasedVersion}`], { cwd: WORKSPACE_ROOT })
  log.log(`committed "🔖 release v${releasedVersion}" and tagged v${releasedVersion}.`)

  // 9) deploy the demo to production (already verified, prepared, committed).
  deployDemo({ prod: true, logger: log })

  // 10) squash-publish the public subtree.
  publishSubtree({ message: `🔖 release v${releasedVersion}`, skipVerify: true, sharedVersion, skipDependencyCheck: true })
}
catch (error) {
  log.error(error instanceof Error ? error.message : String(error))
  log.error(`${PKG_NAME}@${releasedVersion} is published, but a later step failed.`)
  log.error('resume the rest with: pnpm run publish:demo:prod && pnpm run publish:subtree:squash')
  process.exit(1)
}

log.log(`release v${releasedVersion} complete. Review, then: git push && git push --tags`)
log.log('the demo is committed in npm mode — switch it back for dev with: pnpm run sdmil')
