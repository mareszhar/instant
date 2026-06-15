#!/usr/bin/env node

/**
 * Mirror the published package + its one demo to the public repo as a SINGLE
 * SQUASHED commit (dux-spec-workspace.md §6.3).
 *
 * The fork keeps the granular commit history; the public face of the SDK stays
 * clean — one snapshot commit per push. We build that commit with plumbing:
 * the tree of `client/packages/dux/idb-dux` at HEAD, parented on the current
 * remote tip, pushed fast-forward. No subtree history is replayed publicly.
 *
 * Runnable ad hoc (`pnpm run publish:subtree:squash`) or driven by
 * `publish:sdk:*`. Ad hoc it runs the shared gate first and opens $GIT_EDITOR to
 * compose the squash message — prefilled with the convention-following default
 * (`🔖 release v<version>` from the package), so saving as-is is one keystroke
 * and editing is right there. Pass `--message` to skip the editor:
 *
 *   pnpm run publish:subtree:squash -- --message "🔖 release v0.1.0"
 *
 * An automatic version-derived message is the happy path's job, not the ad-hoc
 * one's: the `publish:sdk:*` orchestrator always passes `--message`, so a
 * release never opens an editor; a maintainer running the push by hand picks
 * the message. (Spawning the IDE editor can trip its workspace-trust prompt —
 * that's the IDE guarding external file-opens, harmless to allow.)
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  assertInstantDepsOnNpm,
  assertPackageVersionOnNpm,
  DEP_SECTIONS,
  instantDepNames,
  pinInstantDeps,
  readSharedInstantVersion,
} from './lib/pin-instant-deps.mjs'
import { PKG_NAME, WORKSPACE_ROOT } from './lib/resolve-publish-paths.mjs'
import { runPrepublishGates } from './lib/run-prepublish-gates.mjs'
import { capture, createLogger, run } from './lib/run-publish-step.mjs'

const DEFAULT_REMOTE = 'https://github.com/mareszhar/idb-dux.git'
const PREFIX = 'client/packages/dux/idb-dux'
const DEMO_RESOLUTION_FIELDS = ['overrides', 'resolutions']

const log = createLogger('subtree')

function writeGitBlob(repoRoot, content) {
  const result = spawnSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: repoRoot,
    input: content,
    encoding: 'utf8',
  })
  if (result.status !== 0)
    throw new Error(`git hash-object failed: ${result.stderr || result.stdout || 'no output'}`)
  return result.stdout.trim()
}

function publicTree(repoRoot, sourceTree, sharedVersion) {
  const rawPkg = capture('git', ['show', `HEAD:${PREFIX}/package.json`], { cwd: repoRoot })
  if (!rawPkg)
    log.fail(`could not read ${PREFIX}/package.json at HEAD.`)

  const pkg = JSON.parse(rawPkg)
  const pinnedNames = pinInstantDeps(pkg, sharedVersion)
  const duxVersion = pkg.version
  const pinnedPkgBlob = writeGitBlob(repoRoot, `${JSON.stringify(pkg, null, 2)}\n`)
  const rawDemoPkg = capture('git', ['show', `HEAD:${PREFIX}/demo/package.json`], { cwd: repoRoot })
  const demoPkg = rawDemoPkg ? JSON.parse(rawDemoPkg) : null
  const demoPins = demoPkg ? pinPublicDemoDeps(demoPkg, duxVersion, sharedVersion) : []
  const pinnedDemoPkgBlob = demoPkg ? writeGitBlob(repoRoot, `${JSON.stringify(demoPkg, null, 2)}\n`) : null
  const indexFile = path.join(os.tmpdir(), `dux-public-tree-${process.pid}-${Date.now()}.index`)

  try {
    run('git', ['read-tree', sourceTree], { cwd: repoRoot, env: { GIT_INDEX_FILE: indexFile } })
    run('git', ['update-index', '--cacheinfo', '100644', pinnedPkgBlob, 'package.json'], {
      cwd: repoRoot,
      env: { GIT_INDEX_FILE: indexFile },
    })
    if (pinnedDemoPkgBlob) {
      run('git', ['update-index', '--cacheinfo', '100644', pinnedDemoPkgBlob, 'demo/package.json'], {
        cwd: repoRoot,
        env: { GIT_INDEX_FILE: indexFile },
      })
    }
    const tree = capture('git', ['write-tree'], { cwd: repoRoot, env: { GIT_INDEX_FILE: indexFile } })
    if (!tree)
      log.fail('git write-tree produced no public tree.')
    log.log(`public package.json pins: ${pinnedNames.map(name => `${name}@${sharedVersion}`).join(', ')}`)
    if (demoPins.length)
      log.log(`public demo package.json pins: ${demoPins.join(', ')}`)
    return tree
  }
  finally {
    fs.rmSync(indexFile, { force: true })
  }
}

function pinPublicDemoDeps(pkg, duxVersion, sharedVersion) {
  const pins = []
  for (const section of DEP_SECTIONS) {
    const deps = pkg[section]
    if (!deps)
      continue
    for (const name of Object.keys(deps)) {
      if (name === PKG_NAME) {
        deps[name] = `npm:${PKG_NAME}@${duxVersion}`
        pins.push(`${PKG_NAME}@${duxVersion}`)
      }
      else if (name.startsWith('@instantdb/')) {
        deps[name] = `npm:${name}@${sharedVersion}`
        pins.push(`${name}@${sharedVersion}`)
      }
    }
  }

  for (const field of DEMO_RESOLUTION_FIELDS) {
    const deps = pkg[field]
    if (!deps)
      continue
    for (const name of Object.keys(deps)) {
      if (name === PKG_NAME || name.startsWith('@instantdb/'))
        delete deps[name]
    }
    if (Object.keys(deps).length === 0)
      delete pkg[field]
  }

  return pins.sort()
}

/** The default squash message — `🔖 release v<version>` from the package at HEAD. */
function defaultSubtreeMessage(repoRoot) {
  const rawPkg = capture('git', ['show', `HEAD:${PREFIX}/package.json`], { cwd: repoRoot })
  const version = rawPkg ? JSON.parse(rawPkg).version : undefined
  return version ? `🔖 release v${version}` : '🔖 publish idb-dux'
}

/** Resolve the configured git editor on a prefilled template; return the message. */
function composeMessageInEditor(repoRoot) {
  const editor = capture('git', ['var', 'GIT_EDITOR'], { cwd: repoRoot }) || process.env.EDITOR || 'vi'
  const file = path.join(os.tmpdir(), `dux-subtree-msg-${Date.now()}.txt`)
  fs.writeFileSync(
    file,
    [
      defaultSubtreeMessage(repoRoot),
      '',
      '# Squash commit message for the public idb-dux repo. The line above is a',
      '# convention-following default — keep it, or replace it with your own.',
      '# Lines starting with "#" are ignored; an empty message aborts.',
      '',
    ].join('\n'),
  )

  const result = spawnSync(`${editor} "${file}"`, { stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    fs.rmSync(file, { force: true })
    log.fail('editor exited non-zero — aborting.')
  }

  const message = fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => !line.startsWith('#'))
    .join('\n')
    .trim()
  fs.rmSync(file, { force: true })

  if (!message)
    log.fail('empty commit message — aborting.')
  return message
}

/**
 * Push the prefix as one squashed commit to `remote`/`branch`.
 * @returns the pushed commit sha.
 */
export function publishSubtree({
  remote = DEFAULT_REMOTE,
  branch = 'main',
  message,
  dryRun = false,
  skipVerify = false,
  sharedVersion,
  skipDependencyCheck = false,
} = {}) {
  const repoRoot = capture('git', ['rev-parse', '--show-toplevel'], { cwd: WORKSPACE_ROOT })
  if (!repoRoot)
    log.fail('not inside a git repository.')

  if (capture('git', ['status', '--porcelain'], { cwd: repoRoot }))
    log.fail('working tree is not clean. Commit first (the squash snapshots HEAD).')

  if (!skipVerify)
    runPrepublishGates({ logger: log })

  const squashMessage = message ?? composeMessageInEditor(repoRoot)
  const version = sharedVersion ?? (() => {
    try {
      return readSharedInstantVersion()
    }
    catch (error) {
      log.fail(error instanceof Error ? error.message : String(error))
    }
  })()

  // The tree object for the prefix as it stands at HEAD — the squash payload.
  const sourceTree = capture('git', ['rev-parse', `HEAD:${PREFIX}`], { cwd: repoRoot })
  if (!sourceTree)
    log.fail(`could not resolve a committed tree at ${PREFIX}.`)

  const publicSnapshotTree = publicTree(repoRoot, sourceTree, version)
  if (!skipDependencyCheck) {
    const rawPkg = capture('git', ['show', `${publicSnapshotTree}:package.json`], { cwd: repoRoot })
    const rawDemoPkg = capture('git', ['show', `${publicSnapshotTree}:demo/package.json`], { cwd: repoRoot })
    try {
      assertInstantDepsOnNpm(instantDepNames(JSON.parse(rawPkg)), version)
      assertPackageVersionOnNpm(PKG_NAME, JSON.parse(rawPkg).version)
      if (rawDemoPkg)
        assertInstantDepsOnNpm(instantDepNames(JSON.parse(rawDemoPkg)), version)
    }
    catch (error) {
      log.fail(error instanceof Error ? error.message : String(error))
    }
  }

  // Parent = the current remote tip, so the push fast-forwards (empty on first push).
  let parent = ''
  if (capture('git', ['ls-remote', '--heads', remote, branch], { cwd: repoRoot })) {
    run('git', ['fetch', remote, branch], { cwd: repoRoot })
    parent = capture('git', ['rev-parse', 'FETCH_HEAD'], { cwd: repoRoot })
  }

  log.log(`squashing ${PREFIX} → ${remote} (${branch})${parent ? '' : ' [first push]'}`)
  log.log(`message: ${squashMessage.split('\n')[0]}`)

  if (dryRun) {
    log.log('--dry-run: would commit-tree the snapshot and push it; stopping here.')
    return null
  }

  const commit = capture('git', [
    'commit-tree',
    publicSnapshotTree,
    ...(parent ? ['-p', parent] : []),
    '-m',
    squashMessage,
  ], { cwd: repoRoot })
  if (!commit)
    log.fail('git commit-tree produced no commit.')

  run('git', ['push', remote, `${commit}:refs/heads/${branch}`], { cwd: repoRoot })
  log.log(`pushed ${commit.slice(0, 10)} to ${branch}.`)
  return commit
}

// CLI entry — only when invoked directly, not when imported by publish-sdk.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2)
  const valueOf = (name) => {
    const i = argv.indexOf(name)
    return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined
  }
  publishSubtree({
    remote: valueOf('--remote'),
    branch: valueOf('--branch'),
    message: valueOf('--message'),
    dryRun: argv.includes('--dry-run'),
  })
}
