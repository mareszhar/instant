import { cursor } from '@mszr/selenita'
import { duxProject, registration } from '@test'
import { describe, expect, it } from 'vitest'

const project = duxProject()

const prelude = `
${registration}
import { id, typedTx } from '@mszr/idb-dux'

const tx = typedTx<typeof schema>()
`

describe('typed tx — editor DX', () => {
  it('tx completes the namespace names', () => {
    const { completions } = project.query`
      ${prelude}
      tx.${cursor}
    `
    expect(completions).toContainCompletions([
      '$users',
      'workspaces',
      'memberships',
      'tasks',
    ])
  })

  it('link completes labels and dot-path unique attrs', () => {
    const { completions } = project.query`
      ${prelude}
      tx.memberships[id()].link({ ${cursor} })
    `
    expect(completions).toContainCompletions([
      'workspace',
      'user',
      'workspace.inviteCode',
      'user.email',
    ])
  })

  it('ruleParams completes the schema-declared params', () => {
    const { completions } = project.query`
      ${prelude}
      tx.workspaces[id()].ruleParams({ ${cursor} })
    `
    expect(completions).toEqualCompletions(['inviteCode'])
  })

  it('flags a wrong dot-path value type on the value', () => {
    const { errors } = project.check`
      ${prelude}
      tx.memberships[id()].link({ 'workspace.inviteCode': 42 })
    `
    expect(errors).toHaveError(/not assignable/)
  })

  it('flags unknown ruleParams keys', () => {
    const { errors } = project.check`
      ${prelude}
      tx.workspaces[id()].ruleParams({ unknownParam: 'x' })
    `
    expect(errors).toHaveError(/unknownParam/)
  })

  it('flags ruleParams on a namespace that declares none', () => {
    const { errors } = project.check`
      ${prelude}
      tx.tasks[id()].ruleParams({ inviteCode: 'x' })
    `
    expect(errors).toHaveError(/QERR_TX_RULE_PARAMS_UNDECLARED/)
  })

  it('create completes the namespace fields', () => {
    const { completions } = project.query`
      ${prelude}
      tx.tasks[id()].create({ ${cursor} })
    `
    expect(completions).toContainCompletions(['title', 'isDone', 'createdAt', 'notes', 'meta'])
  })
})
