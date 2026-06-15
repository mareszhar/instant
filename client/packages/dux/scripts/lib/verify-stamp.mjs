/**
 * The content-keyed verification receipt (dux-spec-workspace.md §6).
 *
 * The shared gate is expensive and a release runs several publish steps after
 * it. When a release dies mid-way and is resumed, re-running the gate is pure
 * waste *iff nothing it checks has changed* — but "nothing changed" must be
 * proven, not assumed on a timer. So the receipt is keyed to a digest of the
 * exact inputs the gate covers: identical inputs ⇒ a safe skip; any change ⇒
 * the digest differs and the gate runs again. No flags, no "trust me".
 *
 * The digest is the git tree-hash of the gate's source inputs, staged into a
 * throwaway index (the same plumbing publish-subtree uses to project a tree
 * without touching the worktree). Two churns a release makes legitimately —
 * the `@mszr/idb-dux` version bump and the demo's resolution-mode switch — must
 * NOT invalidate the receipt, because the gate tests neither: the version is
 * masked out of the package manifest and the demo is simply not an input.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { PKG_JSON, STATE_DIR, WORKSPACE_ROOT } from './resolve-publish-paths.mjs'
import { capture, run } from './run-publish-step.mjs'

const STAMP_FILE = path.join(STATE_DIR, 'verify-stamp.json')

/** Upstream packages the gate builds (and `drift` reads) — their sources count. */
const UPSTREAM_PKGS = ['version', 'core', 'vue', 'webhooks', 'platform', 'admin', 'resumable-stream']

/**
 * Repo-relative inputs the gate's verdict depends on (idb-dux's own manifest
 * is added separately, version-masked). The demo is intentionally absent.
 */
const VERIFICATION_PATHS = [
  'client/pnpm-lock.yaml',
  'client/packages/dux/eslint.config.mjs',
  'client/packages/dux/idb-dux/src',
  'client/packages/dux/idb-dux/tsconfig.json',
  'client/packages/dux/idb-dux/tsconfig.build.json',
  'client/packages/dux/idb-dux/tsconfig.dev.json',
  'client/packages/dux/idb-dux/vitest.config.ts',
  ...UPSTREAM_PKGS.flatMap(p => [`client/packages/${p}/src`, `client/packages/${p}/package.json`]),
]

const DEP_SECTIONS = ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies']

/**
 * Manifest with the release-churned bits neutralized: version dropped, every
 * Instant dep collapsed to a constant so the publish-time pin can't move it.
 */
function normalizedPkgManifest() {
  const pkg = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8'))
  delete pkg.version
  for (const section of DEP_SECTIONS) {
    const deps = pkg[section]
    if (!deps)
      continue
    for (const name of Object.keys(deps)) {
      if (name.startsWith('@instantdb/'))
        deps[name] = 'workspace:*'
    }
  }
  return `${JSON.stringify(pkg, null, 2)}\n`
}

/**
 * The digest of the gate's current inputs, or `null` if it can't be computed
 * (no git, etc.) — callers treat `null` as "can't prove it, so verify".
 */
export function computeInputsDigest() {
  const repoRoot = capture('git', ['rev-parse', '--show-toplevel'], { cwd: WORKSPACE_ROOT })
  if (!repoRoot)
    return null

  const present = VERIFICATION_PATHS.filter(p => fs.existsSync(path.join(repoRoot, p)))
  const indexFile = path.join(os.tmpdir(), `dux-verify-index-${process.pid}-${Date.now()}.index`)
  const env = { GIT_INDEX_FILE: indexFile }
  try {
    run('git', ['read-tree', '--empty'], { cwd: repoRoot, env })
    run('git', ['add', '-f', '--', ...present], { cwd: repoRoot, env })

    const blob = spawnSync('git', ['hash-object', '-w', '--stdin'], {
      cwd: repoRoot,
      input: normalizedPkgManifest(),
      encoding: 'utf8',
    })
    if (blob.status !== 0)
      return null
    run('git', ['update-index', '--add', '--cacheinfo', '100644', blob.stdout.trim(), 'client/packages/dux/idb-dux/package.json'], { cwd: repoRoot, env })

    const tree = capture('git', ['write-tree'], { cwd: repoRoot, env })
    return tree || null
  }
  catch {
    return null
  }
  finally {
    fs.rmSync(indexFile, { force: true })
  }
}

export function readStamp() {
  try {
    return JSON.parse(fs.readFileSync(STAMP_FILE, 'utf8'))
  }
  catch {
    return null
  }
}

export function writeStamp(digest) {
  if (!digest)
    return
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(STAMP_FILE, `${JSON.stringify({ digest, ranAt: new Date().toISOString() }, null, 2)}\n`)
}
