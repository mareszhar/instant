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
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const baselineDir = resolve(here, '../idb-dux/src/vue/baseline')
const officialDir = resolve(here, '../../vue/src')

/** baseline file → official source file(s). Mirrors UPSTREAM.md's file map. */
const FILE_MAP = {
  'IdbDuxDatabase.ts': 'InstantVueDatabase.ts',
  'IdbDuxRoom.ts': 'InstantVueRoom.ts',
  'useInfiniteQuery.ts': 'useInfiniteQuery.ts',
  'utils.ts': 'utils.ts',
  'version.ts': 'version.ts',
  'components/auth.ts': ['components/SignedIn.vue', 'components/SignedOut.vue'],
  'components/Cursors.ts': 'components/Cursors.vue',
  'components/Cursor.ts': 'components/Cursor.vue',
}

function vendoredCommit() {
  const upstream = readFileSync(resolve(baselineDir, 'UPSTREAM.md'), 'utf8')
  const match = upstream.match(/\*\*Commit:\*\*\s*`([0-9a-f]+)`/)
  return match?.[1]
}

function officialChangedSince(commit, file) {
  const rel = `client/packages/vue/src/${file}`
  const out = execFileSync('git', ['log', '--oneline', `${commit}..HEAD`, '--', rel], {
    cwd: resolve(here, '../../../..'),
    encoding: 'utf8',
  })
  return out.trim().split('\n').filter(Boolean)
}

const commit = vendoredCommit()
if (!commit) {
  console.error('⚠️  could not read the vendored commit from baseline/UPSTREAM.md')
  process.exit(1)
}

let drift = 0

for (const [baselineFile, officialFiles] of Object.entries(FILE_MAP)) {
  const sources = Array.isArray(officialFiles) ? officialFiles : [officialFiles]
  let missing = false
  const changes = new Set()

  for (const officialFile of sources) {
    if (!existsSync(resolve(officialDir, officialFile))) {
      console.error(`⚠️  official source missing: ${officialFile} (renamed upstream?) — re-map ${baselineFile}.`)
      missing = true
      continue
    }

    for (const line of officialChangedSince(commit, officialFile))
      changes.add(line)
  }

  if (missing) {
    drift++
    continue
  }

  if (changes.size > 0) {
    console.error(
      `🔸 official source for \`${baselineFile}\` changed since last vendor; review ${changes.size} commit(s) `
      + `and re-vendor \`${baselineFile}\` (see baseline/UPSTREAM.md):`,
    )
    for (const line of changes)
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
