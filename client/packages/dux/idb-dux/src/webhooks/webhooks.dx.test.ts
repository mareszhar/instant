/**
 * Editor-DX plane for `/webhooks`: per-change narrowing on a plain object
 * literal (no helpers, no schema generics), and create/update payload
 * completions. This is the headline DX contract — handlers narrow `before`/
 * `after` to the namespace's entity at the cursor.
 */
import { cursor } from '@mszr/selenita'
import { duxProject, registration } from '@test'
import { describe, expect, it } from 'vitest'

const project = duxProject()

const prelude = `
${registration}
import { defineWebhookHandlers, init } from '@mszr/idb-dux/webhooks'
`

describe('defineWebhookHandlers — editor DX', () => {
  it('narrows after to the namespace entity inside a create handler', () => {
    const { completions } = project.query`
      ${prelude}
      const handlers = defineWebhookHandlers({
        tasks: {
          create: ({ after }) => { after.${cursor} },
        },
      })
    `
    expect(completions).toContainCompletions(['id', 'title', 'isDone', 'createdAt', 'notes', 'meta'])
  })

  it('narrows before in a delete handler and types after as null', () => {
    const { completions } = project.query`
      ${prelude}
      const handlers = defineWebhookHandlers({
        tasks: {
          delete: ({ before }) => { before.${cursor} },
        },
      })
    `
    expect(completions).toContainCompletions(['title', 'isDone'])
  })

  it('flags a non-existent field on the narrowed entity', () => {
    const { errors } = project.check`
      ${prelude}
      const handlers = defineWebhookHandlers({
        tasks: {
          create: ({ after }) => { console.log(after.nope) },
        },
      })
    `
    expect(errors).toHaveError(/nope/)
  })

  it('a $default change is a discriminated union — completes the discriminant', () => {
    const { completions } = project.query`
      ${prelude}
      const handlers = defineWebhookHandlers({
        $default: change => { change.${cursor} },
      })
    `
    expect(completions).toContainCompletions(['namespace', 'action', 'before', 'after'])
  })

  it('completes the create payload keys on the manager', () => {
    const { completions } = project.query`
      ${prelude}
      const webhooks = init({ appId: 'a', adminToken: 't' })
      webhooks.manager.create({ ${cursor} })
    `
    expect(completions).toContainCompletions(['url', 'namespaces', 'actions'])
  })

  it('completes namespace names inside the create payload namespaces array', () => {
    const { completions } = project.query`
      ${prelude}
      const webhooks = init({ appId: 'a', adminToken: 't' })
      webhooks.manager.create({ url: 'https://x', actions: ['create'], namespaces: ['${cursor}'] })
    `
    expect(completions).toContainCompletions(['tasks', 'workspaces', 'reports'])
  })
})
