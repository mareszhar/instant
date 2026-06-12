import { cursor } from '@mszr/selenita'
import { duxProject, registration } from '@test'
import { describe, expect, it } from 'vitest'

const project = duxProject()

describe('schema authoring — editor DX', () => {
  it('i.namespace({ ⌶ }) completes the namespace config keys', () => {
    const { completions } = project.query`
      import { i } from '@mszr/idb-dux'
      i.namespace({ ${cursor} })
    `
    expect(completions).toContainCompletions(['singular', 'fields', 'ruleParams'])
  })

  it('defineSchema({ ⌶ }) completes the schema config keys', () => {
    const { completions } = project.query`
      import { defineSchema } from '@mszr/idb-dux'
      defineSchema({ ${cursor} })
    `
    expect(completions).toContainCompletions(['namespaces', 'links', 'rooms', 'options'])
  })

  it('link sides complete the declared namespace names for `on`', () => {
    const result = project.query`
      import { defineSchema, i } from '@mszr/idb-dux'
      defineSchema({
        namespaces: {
          tasks: i.namespace({ fields: { title: i.string() } }),
          workspaces: i.namespace({ fields: { name: i.string() } }),
        },
        links: {
          taskWorkspace: {
            forward: { on: '${cursor}' },
          },
        },
      })
    `
    expect(result.completions).toContainCompletions(['tasks', 'workspaces'])
  })

  it('options.singularize completes its three modes', () => {
    const { completions } = project.query`
      import { defineSchema, i } from '@mszr/idb-dux'
      defineSchema({
        namespaces: { tasks: i.namespace({ fields: { title: i.string() } }) },
        options: { singularize: '${cursor}' },
      })
    `
    expect(completions).toEqualCompletions(['auto', 'off', 'explicit'])
  })

  it('flags a non-builder field value on the offending field', () => {
    const { errors } = project.check`
      import { i } from '@mszr/idb-dux'
      i.namespace({ fields: { title: 'not-a-builder' } })
    `
    expect(errors).toHaveError(/not assignable/)
  })
})

describe('registration — editor DX', () => {
  it('completes the registered namespace names inside IdbEntity', () => {
    const result = project.query`
      ${registration}
      import type { IdbEntity } from '@mszr/idb-dux'
      type T = IdbEntity<'${cursor}'>
    `
    expect(result.completions).toContainCompletions([
      '$users',
      'workspaces',
      'memberships',
      'tasks',
      'reports',
      'analyses',
    ])
  })

  it('resolves entity fields through the registered schema', () => {
    const result = project.query`
      ${registration}
      import type { IdbEntity } from '@mszr/idb-dux'
      declare const task: IdbEntity<'tasks'>
      task.${cursor}
    `
    expect(result.completions).toEqualCompletions([
      'id',
      'title',
      'isDone',
      'createdAt',
      'notes',
      'meta',
    ])
  })
})
