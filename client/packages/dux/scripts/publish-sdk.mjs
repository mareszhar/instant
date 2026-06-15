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
 * Verification runs ONCE (step 1) and leaves a content-keyed receipt, so the
 * demo + subtree steps it drives — and any later resume — don't re-verify
 * unchanged inputs.
 *
 * Any failure up to and including publish restores the original package.json and
 * leaves no release state. Once published the bump is permanent, so the release
 * is recorded; a later step failing keeps that record and the maintainer simply
 * re-runs the same `publish:sdk:<type>` — the orchestrator resumes from the
 * first incomplete post-publish step instead of re-bumping or re-doing work.
 */
import fs from 'node:fs'
import process from 'node:process'
import { assertInstantDepsOnNpm, assertPackageVersionOnNpm, pinInstantDeps, readSharedInstantVersion } from './lib/pin-instant-deps.mjs'
import { clearReleaseState, loadReleaseState, saveReleaseState } from './lib/release-state.mjs'
import { NPM_CACHE, PKG_DIR, PKG_JSON, PKG_NAME, WORKSPACE_ROOT } from './lib/resolve-publish-paths.mjs'
import { runPrepublishGates } from './lib/run-prepublish-gates.mjs'
import { capture, createLogger, run, sleep } from './lib/run-publish-step.mjs'
import { deployDemo, prepareDemoForNpm } from './publish-demo.mjs'
import { publishSubtree } from './publish-subtree.mjs'

const log = createLogger('sdk')

const VALID_TYPES = new Set(['patch', 'minor', 'major'])

/**
 * Bump a clean `x.y.z` version by release type. Done by hand rather than with
 * `npm version`: this package lives inside the fork's pnpm workspace, and
 * `npm version` detects that workspace root and tries to reify the whole
 * monorepo tree (`updateWorkspaces` → arborist), which crashes on the
 * pnpm-managed layout. A direct write matches how the rest of this script
 * already edits package.json (snapshot/restore, dep-pinning) and never invokes
 * npm's workspace machinery.
 */
function bumpVersion(current, type) {
  const core = current.split('-')[0].split('+')[0]
  const parts = core.split('.').map(n => Number.parseInt(n, 10))
  if (parts.length !== 3 || parts.some(Number.isNaN))
    throw new Error(`cannot bump non-semver version "${current}"`)
  const [major, minor, patch] = parts
  if (type === 'major')
    return `${major + 1}.0.0`
  if (type === 'minor')
    return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

/**
 * Poll npm until the just-published version resolves (registry propagation).
 * `preferOnline` is essential here: each poll must revalidate, or npm serves a
 * packument cached by the first poll (taken before propagation) and the wait
 * times out against its own stale cache. First-publish propagation is also
 * slower than a republish, hence the generous budget.
 */
function waitForNpm(version, { timeoutMs = 300_000, intervalMs = 5_000 } = {}) {
  const deadline = Date.now() + timeoutMs
  log.log(`waiting for ${PKG_NAME}@${version} to resolve on npm…`)
  while (Date.now() < deadline) {
    try {
      assertPackageVersionOnNpm(PKG_NAME, version, { preferOnline: true })
      log.log(`${PKG_NAME}@${version} is live on npm.`)
      return
    }
    catch {}
    sleep(intervalMs)
  }
  log.fail(`${PKG_NAME}@${version} did not appear on npm within ${timeoutMs / 1000}s. It may still be propagating; re-run the same publish:sdk command to resume.`)
}

/**
 * Commit the release (version bump + demo pin) and tag it — idempotently, so a
 * resume that already committed/tagged on a prior run is a no-op rather than a
 * "nothing to commit" / "tag exists" failure.
 */
function ensureReleaseCommitAndTag(version) {
  run('git', ['add', PKG_DIR], { cwd: WORKSPACE_ROOT })
  if (capture('git', ['diff', '--cached', '--name-only'], { cwd: WORKSPACE_ROOT })) {
    run('git', ['commit', '-m', `🔖 release v${version}`], { cwd: WORKSPACE_ROOT })
    log.log(`committed "🔖 release v${version}".`)
  }
  else {
    log.log('release commit already present — nothing new to commit.')
  }
  if (capture('git', ['tag', '--list', `v${version}`], { cwd: WORKSPACE_ROOT })) {
    log.log(`tag v${version} already exists.`)
  }
  else {
    run('git', ['tag', `v${version}`], { cwd: WORKSPACE_ROOT })
    log.log(`tagged v${version}.`)
  }
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

// ── Real release. Resume an in-flight one if its package is already on npm.
const existing = loadReleaseState()
const resuming = Boolean(existing?.steps?.published && existing.version === JSON.parse(originalRaw).version)

let releasedVersion
let state

if (resuming) {
  state = existing
  releasedVersion = state.version
  sharedVersion = state.sharedVersion ?? sharedVersion
  log.log(`resuming release v${releasedVersion} (already on npm) — continuing the remaining steps.`)
}
else {
  if (existing)
    log.warn(`discarding a stale release record (v${existing.version}); starting a fresh ${releaseType} release.`)

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

  try {
    // 3) bump our own version (persists past restore) — written directly, no npm.
    const bumped = JSON.parse(originalRaw)
    releasedVersion = bumpVersion(bumped.version, releaseType)
    bumped.version = releasedVersion
    fs.writeFileSync(PKG_JSON, `${JSON.stringify(bumped, null, 2)}\n`)
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

  // Published — record the release so a later failure resumes here, never re-publishes.
  state = {
    version: releasedVersion,
    releaseType,
    sharedVersion,
    steps: { published: true, committed: false, deployed: false, subtreePushed: false },
  }
  saveReleaseState(state)
}

// Past this point the package is on npm; the bump must stand. Each step is
// guarded by the release record, so a resume skips whatever already completed.
try {
  // 6) wait for registry propagation (safe to repeat).
  waitForNpm(releasedVersion)

  // 7+8) prepare the demo (npm mode, exact pin), then commit + tag the release.
  if (!state.steps.committed) {
    prepareDemoForNpm({ version: releasedVersion, logger: log })
    ensureReleaseCommitAndTag(releasedVersion)
    state.steps.committed = true
    saveReleaseState(state)
  }

  // 9) deploy the demo to production (already verified, prepared, committed).
  if (!state.steps.deployed) {
    deployDemo({ prod: true, logger: log })
    state.steps.deployed = true
    saveReleaseState(state)
  }

  // 10) squash-publish the public subtree.
  if (!state.steps.subtreePushed) {
    publishSubtree({ message: `🔖 release v${releasedVersion}`, skipVerify: true, sharedVersion, skipDependencyCheck: true })
    state.steps.subtreePushed = true
    saveReleaseState(state)
  }
}
catch (error) {
  log.error(error instanceof Error ? error.message : String(error))
  log.error(`${PKG_NAME}@${releasedVersion} is published, but a later step failed.`)
  log.error(`resume from where it stopped by re-running: pnpm run publish:sdk:${state.releaseType}`)
  process.exit(1)
}

clearReleaseState()
log.log(`release v${releasedVersion} complete. Review, then: git push && git push --tags`)
log.log('the demo is committed in npm mode — switch it back for dev with: pnpm run sdmil')
