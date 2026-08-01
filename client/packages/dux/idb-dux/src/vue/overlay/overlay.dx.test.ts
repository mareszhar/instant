import { cursor } from '@mszr/selenita'
import { duxProject, registration } from '@test'
import { describe, expect, it } from 'vitest'

const project = duxProject()

/** A registered db, exactly as userland sets one up. */
const prelude = `
${registration}
import { defineDb } from '@mszr/idb-dux/vue'
import { $only } from '@mszr/idb-dux'

const useDb = defineDb({ schema, getAppId: () => 'app' })
const db = useDb()
`

describe('overlay useQuery — editor DX', () => {
  it('completes namespaces inside the query literal (contextual typing path)', () => {
    const { completions } = project.query`
      ${prelude}
      db.useQuery({ ${cursor} })
    `
    expect(completions).toContainCompletions(['tasks', 'workspaces', '$users'])
  })

  it('completes where keys inside useQuery', () => {
    const { completions } = project.query`
      ${prelude}
      db.useQuery({ tasks: { $: { where: { ${cursor} } } } })
    `
    expect(completions).toContainCompletions(['title', 'isDone', 'id', 'workspace.inviteCode'])
  })

  it('flags an unknown namespace at the offending key', () => {
    const { errors } = project.check`
      ${prelude}
      db.useQuery({ foos: {} })
    `
    expect(errors).toHaveError(/IDBDUXERR_QUERY_ROOT_KEY_UNKNOWN: foos is not a valid top-level namespace/)
  })

  it('flags a mistyped where value at the value', () => {
    const { errors } = project.check`
      ${prelude}
      db.useQuery({ tasks: { $: { where: { title: false } } } })
    `
    expect(errors).toHaveError(/IDBDUXERR_WHERE_VALUE_TYPE: Type 'boolean' is not assignable to field 'title' of type string/)
  })

  it('queryOnce shares the same validation surface', () => {
    const { errors } = project.check`
      ${prelude}
      async function run() {
        await db.queryOnce({ tasks: { $: { where: { tagName: 'x' } } } })
      }
    `
    expect(errors).toHaveError(/IDBDUXERR_WHERE_KEY_UNKNOWN: tagName is not a valid where key on tasks/)
  })

  it('a clean query produces no diagnostics', () => {
    const { errors } = project.check`
      ${prelude}
      const { workspace, tasks } = db.useQuery({
        workspaces: { $: { where: { inviteCode: 'x' }, $only } },
        tasks: { $: { where: { isDone: false } }, assignee: {} },
      })
    `
    expect(errors).toBeClean()
  })

  it('completes typed db.tx link labels and dot-paths', () => {
    const { completions } = project.query`
      ${prelude}
      import { id } from '@mszr/idb-dux'
      db.tx.memberships[id()].link({ ${cursor} })
    `
    expect(completions).toContainCompletions(['workspace', 'user', 'workspace.inviteCode'])
  })

  it('completes defineDb options', () => {
    const { completions } = project.query`
      ${registration}
      import { defineDb } from '@mszr/idb-dux/vue'
      defineDb({ ${cursor} })
    `
    expect(completions).toContainCompletions(['schema', 'getAppId'])
  })
})

describe('overlay parity — useQuery and queryOnce share completions', () => {
  it('offer identical where-key completions', () => {
    const result = project.query`
      ${prelude}
      db.useQuery({ tasks: { $: { where: { ${cursor('sub')} } } } })
      async function run() {
        await db.queryOnce({ tasks: { $: { where: { ${cursor('once')} } } } })
      }
    `
    expect(result.at('sub').completions).toEqualCompletions(result.at('once').completions)
  })
})
