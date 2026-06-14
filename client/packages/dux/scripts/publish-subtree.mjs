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
 * `publish:sdk:*`. Ad hoc it runs the shared gate first and opens $GIT_EDITOR
 * for the squash message; pass `--message` (or let the orchestrator pass one)
 * to skip the editor:
 *
 *   pnpm run publish:subtree:squash -- --message "🔖 release v0.1.0"
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { WORKSPACE_ROOT } from './lib/paths.mjs'
import { capture, createLogger, run } from './lib/proc.mjs'
import { verify } from './lib/verify.mjs'

const DEFAULT_REMOTE = 'https://github.com/mareszhar/idb-dux.git'
const PREFIX = 'client/packages/dux/idb-dux'

const log = createLogger('subtree')

/** Resolve the configured git editor on a prefilled template; return the message. */
function composeMessageInEditor(repoRoot) {
  const editor = capture('git', ['var', 'GIT_EDITOR'], { cwd: repoRoot }) || process.env.EDITOR || 'vi'
  const file = path.join(os.tmpdir(), `dux-subtree-msg-${Date.now()}.txt`)
  fs.writeFileSync(
    file,
    [
      '',
      '# Write the squash commit message for the public idb-dux repo.',
      '# Lines starting with "#" are ignored. An empty message aborts.',
      `# e.g. 🔖 release v0.1.0`,
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
} = {}) {
  const repoRoot = capture('git', ['rev-parse', '--show-toplevel'], { cwd: WORKSPACE_ROOT })
  if (!repoRoot)
    log.fail('not inside a git repository.')

  if (capture('git', ['status', '--porcelain'], { cwd: repoRoot }))
    log.fail('working tree is not clean. Commit first (the squash snapshots HEAD).')

  if (!skipVerify)
    verify({ logger: log })

  const squashMessage = message ?? composeMessageInEditor(repoRoot)

  // The tree object for the prefix as it stands at HEAD — the squash payload.
  const tree = capture('git', ['rev-parse', `HEAD:${PREFIX}`], { cwd: repoRoot })
  if (!tree)
    log.fail(`could not resolve a committed tree at ${PREFIX}.`)

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
    tree,
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
