/**
 * Editor-DX plane for `/perms` — the gating contract. Completions appear where
 * authors reach for them (namespaces, entity fields, ref paths, ruleParams),
 * and the action-rooted context makes misuse a diagnostic at the cursor:
 * `eu` outside update, `el` outside link, a duplicate bind name, an unknown
 * namespace. With the schema registered, no generics are needed anywhere.
 */
import { cursor } from '@mszr/selenita'
import { duxProject, registration } from '@test'
import { describe, expect, it } from 'vitest'

const project = duxProject()

const prelude = `
${registration}
import { definePerms } from '@mszr/idb-dux/perms'
`

describe('definePerms — completions', () => {
  it('completes namespace keys in .namespaces({})', () => {
    const { completions } = project.query`
      ${prelude}
      export default definePerms().namespaces({ ${cursor} })
    `
    expect(completions).toContainCompletions(['tasks', 'workspaces', 'memberships', '$users', 'reports'])
  })

  it('completes the current entity fields off e', () => {
    const { completions } = project.query`
      ${prelude}
      export default definePerms().namespaces({
        tasks: ns => ns.bind(({ e }) => { e.${cursor}; return {} }),
      })
    `
    expect(completions).toContainCompletions(['id', 'title', 'isDone', 'createdAt', 'notes', 'meta'])
  })

  it('completes ref paths inside er()', () => {
    const { completions } = project.query`
      ${prelude}
      export default definePerms().namespaces({
        tasks: ns => ns.bind(({ er }) => { er('${cursor}'); return {} }),
      })
    `
    expect(completions).toContainCompletions(['assignee.email', 'workspace.name', 'workspace.memberships.user.id'])
  })

  it('completes ruleParams keys inside rp()', () => {
    const { completions } = project.query`
      ${prelude}
      export default definePerms().namespaces({
        workspaces: ns => ns.bind(({ rp }) => { rp('${cursor}'); return {} }),
      })
    `
    expect(completions).toContainCompletions(['inviteCode'])
  })

  it('completes the linked entity fields off el in a link rule', () => {
    const { completions } = project.query`
      ${prelude}
      export default definePerms().namespaces({
        tasks: ns => ns.allow({
          link: { assignee: ({ el }) => { el.${cursor}; return true } },
        }),
      })
    `
    // assignee → $users
    expect(completions).toContainCompletions(['id', 'email', 'name'])
  })
})

describe('definePerms — diagnostics at the cursor', () => {
  it('rejects entityUpdated (eu) outside an update rule', () => {
    const { errors } = project.check`
      ${prelude}
      export default definePerms().namespaces({
        tasks: ns => ns.allow({ view: ({ eu }) => eu.title.eq('x') }),
      })
    `
    expect(errors).toHaveError(/eu/)
  })

  it('rejects entityLinked (el) outside a link rule', () => {
    const { errors } = project.check`
      ${prelude}
      export default definePerms().namespaces({
        tasks: ns => ns.allow({ update: ({ el }) => el.id.eq('x') }),
      })
    `
    expect(errors).toHaveError(/el/)
  })

  it('rejects a duplicate bind name with an actionable message', () => {
    const { errors } = project.check`
      ${prelude}
      export default definePerms().namespaces({
        tasks: ns => ns
          .bind(({ auth }) => ({ isMember: auth.id.neq(null) }))
          .bind(({ auth }) => ({ isMember: auth.id.eq(null) })),
      })
    `
    expect(errors).toHaveError(/already defined/)
  })

  it('rejects an unknown namespace key', () => {
    const { errors } = project.check`
      ${prelude}
      export default definePerms().namespaces({
        nope: ns => ns.allow({ view: true }),
      })
    `
    expect(errors).toHaveError(/nope/)
  })

  it('rejects an unknown field on e', () => {
    const { errors } = project.check`
      ${prelude}
      export default definePerms().namespaces({
        tasks: ns => ns.bind(({ e }) => ({ x: e.nope.eq('y') })),
      })
    `
    expect(errors).toHaveError(/nope/)
  })
})

describe('definePerms — action-specific stageFor / bindFor scoping', () => {
  it('exposes eu inside a stageFor("update") callback', () => {
    const { completions } = project.query`
      ${prelude}
      export default definePerms().namespaces({
        tasks: ns => ns.stageFor('update', ({ eu }) => { eu.${cursor}; return {} }),
      })
    `
    expect(completions).toContainCompletions(['title', 'isDone'])
  })

  it('exposes el inside a bindFor("link", label) callback, typed to the target', () => {
    const { completions } = project.query`
      ${prelude}
      export default definePerms().namespaces({
        memberships: ns => ns.bindFor('link', 'user', ({ el }) => { el.${cursor}; return {} }),
      })
    `
    // user → $users
    expect(completions).toContainCompletions(['id', 'email', 'name'])
  })

  it('makes a bindFor("update") alias usable in the update rule', () => {
    const { completions } = project.query`
      ${prelude}
      export default definePerms().namespaces({
        tasks: ns => ns
          .bindFor('update', ({ e, eu }) => ({ titleChanged: eu.title.neq(e.title) }))
          .allow({ update: ({ b }) => { b.${cursor}; return true } }),
      })
    `
    expect(completions).toContainCompletions(['titleChanged'])
  })

  it('keeps an update-only bind out of the view rule', () => {
    const { errors } = project.check`
      ${prelude}
      export default definePerms().namespaces({
        tasks: ns => ns
          .bindFor('update', ({ e, eu }) => ({ titleChanged: eu.title.neq(e.title) }))
          .allow({ view: ({ b }) => b.titleChanged }),
      })
    `
    expect(errors).toHaveError(/titleChanged/)
  })

  it('rejects eu inside a stageFor("view") callback', () => {
    const { errors } = project.check`
      ${prelude}
      export default definePerms().namespaces({
        tasks: ns => ns.stageFor('view', ({ eu }) => ({ x: eu.title.eq('y') })),
      })
    `
    expect(errors).toHaveError(/eu/)
  })
})
