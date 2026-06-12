#!/usr/bin/env node
/**
 * Baseline drift check (dux-spec-workspace.md §5.2).
 *
 * The `/vue` baseline is a vendored mirror of `@instantdb/vue` with fenced
 * `DUX-DELTA` deltas, reformatted to dux's lint style. So byte-equality with
 * upstream is never expected; **drift is "the official source changed since
 * the commit recorded in `baseline/UPSTREAM.md`"**, read straight from git
 * history. Re-vendoring is then a deliberate step, never an accident
 * discovered months later.
 *
 * Exit code: 0 when no drift, 1 when drift is detected (so CI gates on it).
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const baselineDir = resolve(here, '../idb-dux/src/vue/baseline')
const officialDir = resolve(here, '../../vue/src')

/** baseline file → official source file. Mirrors UPSTREAM.md's file map. */
const FILE_MAP = {
  'InstantDuxDatabase.ts': 'InstantVueDatabase.ts',
  'InstantDuxRoom.ts': 'InstantVueRoom.ts',
  'useInfiniteQuery.ts': 'useInfiniteQuery.ts',
  'utils.ts': 'utils.ts',
  'version.ts': 'version.ts',
}

function vendoredCommit() {
  const upstream = readFileSync(resolve(baselineDir, 'UPSTREAM.md'), 'utf8')
  const match = upstream.match(/\*\*Commit:\*\*\s*`([0-9a-f]+)`/)
  return match?.[1]
}

function officialChangedSince(commit, file) {
  const rel = `client/packages/vue/src/${file}`
  const out = execSync(`git log --oneline ${commit}..HEAD -- ${rel}`, {
    cwd: resolve(here, '../../../..'),
    encoding: 'utf8',
  })
  return out.trim()
}

const commit = vendoredCommit()
if (!commit) {
  console.error('⚠️  could not read the vendored commit from baseline/UPSTREAM.md')
  process.exit(1)
}

let drift = 0

for (const [baselineFile, officialFile] of Object.entries(FILE_MAP)) {
  if (!existsSync(resolve(officialDir, officialFile))) {
    console.error(`⚠️  official source missing: ${officialFile} (renamed upstream?) — re-map ${baselineFile}.`)
    drift++
    continue
  }

  const hunks = officialChangedSince(commit, officialFile)
  if (hunks) {
    const count = hunks.split('\n').length
    console.error(
      `🔸 official \`${officialFile}\` changed since last vendor; review ${count} commit(s) `
      + `and re-vendor \`${baselineFile}\` (see baseline/UPSTREAM.md):`,
    )
    for (const line of hunks.split('\n'))
      console.error(`     ${line}`)
    drift++
  }
}

if (drift === 0) {
  console.log(`✅ baseline in sync with @instantdb/vue@${commit.slice(0, 9)}`)
  process.exit(0)
}
else {
  console.error(`\n${drift} baseline file(s) drifted. Re-vendor per dux-spec-workspace.md §5.1.`)
  process.exit(1)
}
