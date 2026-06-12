import { schema } from '@test'
import { describe, expect, it } from 'vitest'
import { defineSchema, i } from './index.js'

describe('defineSchema — dux metadata', () => {
  it('hoists namespace singulars and ruleParams into $dux', () => {
    expect(schema.$dux.namespaces.$users.singular).toBe('user')
    expect(schema.$dux.namespaces.analyses.singular).toBe('analysis')
    expect(schema.$dux.namespaces.tasks.singular).toBeUndefined()
    expect(schema.$dux.namespaces.workspaces.ruleParams).toHaveProperty('inviteCode')
    expect(schema.$dux.namespaces.tasks.ruleParams).toBeUndefined()
  })

  it('hoists link label singulars under the side they apply to', () => {
    expect(schema.$dux.linkSingulars).toEqual({
      reports: { analyses: 'analysis' },
    })
  })

  it('defaults options.singularize to auto and honors an explicit value', () => {
    expect(schema.$dux.options).toEqual({ singularize: 'auto' })

    const off = defineSchema({
      namespaces: { tasks: i.namespace({ fields: { title: i.string() } }) },
      options: { singularize: 'off' },
    })
    expect(off.$dux.options).toEqual({ singularize: 'off' })
  })

  it('keeps every dux key out of the enumerable projection', () => {
    expect(Object.keys(schema)).toEqual(['entities', 'links', 'rooms'])
    const wire = JSON.stringify(schema)
    expect(wire).not.toContain('$dux')
    expect(wire).not.toContain('singular')
    expect(wire).not.toContain('ruleParams')
  })

  it('enriches entity defs with link maps, self-links included', () => {
    expect(Object.keys(schema.entities.tasks.links).sort()).toEqual([
      'assignee',
      'parentTask',
      'subtasks',
      'workspace',
    ])
    expect(schema.entities.tasks.links.subtasks).toEqual({
      entityName: 'tasks',
      cardinality: 'many',
    })
    expect(schema.entities.tasks.links.parentTask).toEqual({
      entityName: 'tasks',
      cardinality: 'one',
    })
  })
})
