/**
 * Editor-DX plane for `/admin`: the server surface completes its tx namespaces
 * and query keys at the cursor, and field-localized query errors land on the
 * offending key — the same authoring DX the client gets, on the admin db.
 */
import { cursor } from '@mszr/selenita'
import { duxProject, registration } from '@test'
import { describe, expect, it } from 'vitest'

const project = duxProject()

const prelude = `
${registration}
import { init } from '@mszr/idb-dux/admin'

const adminDb = init({ appId: 'app', adminToken: 'tok', schema })
`

describe('admin surface — editor DX', () => {
  it('tx completes the namespace names', () => {
    const { completions } = project.query`
      ${prelude}
      adminDb.tx.${cursor}
    `
    expect(completions).toContainCompletions(['$users', 'workspaces', 'memberships', 'tasks'])
  })

  it('query completes top-level namespaces', () => {
    const { completions } = project.query`
      ${prelude}
      adminDb.query({ ${cursor} })
    `
    expect(completions).toContainCompletions(['workspaces', 'tasks', 'reports'])
  })

  it('flags an unknown where key on the offending key', () => {
    const { errors } = project.check`
      ${prelude}
      adminDb.query({ tasks: { $: { where: { nope: 1 } } } })
    `
    expect(errors).toHaveError(/QERR_WHERE_KEY_UNKNOWN/)
  })

  it('completes the kit-shaped data plane on the awaited result', () => {
    const { completions } = project.query`
      ${prelude}
      const { ${cursor} } = await adminDb.query({ workspaces: { $: { $only: true } } })
    `
    expect(completions).toContainCompletions(['workspace'])
  })
})
