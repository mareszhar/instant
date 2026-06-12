/**
 * The editor-DX half of the parity harness ([dux-spec-workspace.md §4.5]):
 * the vendored baseline must complete exactly what official `@instantdb/vue`
 * completes — "additive, never divergent" on the authoring surface too. Both
 * dbs route query authoring through core's `ValidQuery`, so a divergence here
 * means a vendor went wrong.
 */
import { cursor, group, snippet } from '@mszr/selenita'
import { duxProject } from '@test'
import { describe, expect, it } from 'vitest'

const project = duxProject()

const setup = `
import { schema } from '@test/app'
import { init as officialInit } from '@instantdb/vue'
import { init as baselineInit } from '@baseline'

const officialDb = officialInit({ appId: 'app', schema })
const baselineDb = baselineInit({ appId: 'app', schema })
`

const dbs = group('vue dbs', ['officialDb', 'baselineDb'])

describe('baseline parity — completions match official', () => {
  it('namespace completions agree at the query root', () => {
    const result = project.queryGroup(
      dbs,
      db => snippet`${db}.useQuery({ ${cursor('root')} })`,
    )`${setup}`
    expect(result.group.at('root')).toHaveCompletionParity()
  })

  it('where-key completions agree', () => {
    const result = project.queryGroup(
      dbs,
      db => snippet`${db}.useQuery({ tasks: { $: { where: { ${cursor('where')} } } } })`,
    )`${setup}`
    expect(result.group.at('where')).toHaveCompletionParity()
  })
})
