import {
  ids,
  rawReportsWithAnalyses,
  rawTasks,
  rawTasksWithAssignee,
  rawUsers,
  rawWorkspaces,
  schema,
} from '@test'
import { describe, expect, it } from 'vitest'
import { defineSchema, i } from '../schema/index.js'
import { shapeResult } from './shapeResult.js'

describe('shapeResult — normalization', () => {
  it('top-level namespaces are arrays, never undefined', () => {
    expect(shapeResult({}, { tasks: {} }, schema)).toEqual({ tasks: [] })
    expect(shapeResult(undefined, { tasks: {} }, schema)).toEqual({ tasks: [] })
  })

  it('returns untouched scopes by reference — no copy without directives', () => {
    const raw = { tasks: rawTasks }
    const shaped = shapeResult(raw, { tasks: {} }, schema)
    expect(shaped.tasks).toBe(rawTasks)
  })

  it('preserves nested has-one links as already singular', () => {
    const shaped = shapeResult(
      { tasks: rawTasksWithAssignee },
      { tasks: { assignee: {} } },
      schema,
    )
    expect(shaped.tasks).toBe(rawTasksWithAssignee)
    expect(shaped.tasks[2].assignee).toBeUndefined()
  })
})

describe('shapeResult — $only / $at / $as', () => {
  it('$only picks the first element and singularizes via the algorithm', () => {
    const shaped = shapeResult(
      { workspaces: rawWorkspaces },
      { workspaces: { $: { $only: true } } },
      schema,
    )
    expect(shaped).toEqual({ workspace: rawWorkspaces[0] })
  })

  it('$only on an empty scope yields undefined under the singular key', () => {
    const shaped = shapeResult({ workspaces: [] }, { workspaces: { $: { $only: true } } }, schema)
    expect(shaped).toEqual({ workspace: undefined })
    expect('workspace' in shaped).toBe(true)
  })

  it('$at picks positions, negative from the end', () => {
    expect(
      shapeResult({ tasks: rawTasks }, { tasks: { $: { $at: -1 } } }, schema).task,
    ).toBe(rawTasks[2])
    expect(
      shapeResult({ tasks: rawTasks }, { tasks: { $: { $at: 1 } } }, schema).task,
    ).toBe(rawTasks[1])
  })

  it('declared namespace singulars win over the algorithm', () => {
    const shaped = shapeResult(
      { $users: rawUsers },
      { $users: { $: { $only: true } } },
      schema,
    )
    expect(shaped.user).toBe(rawUsers[0])
  })

  it('$as renames explicitly and always wins', () => {
    const shaped = shapeResult(
      { $users: rawUsers },
      { $users: { $: { $only: true, $as: 'me' } } },
      schema,
    )
    expect(shaped).toEqual({ me: rawUsers[0] })
  })

  it('nested picks rename via the link label singular', () => {
    const shaped = shapeResult(
      { reports: rawReportsWithAnalyses },
      { reports: { $: { $only: true }, analyses: { $: { $at: 0 } } } },
      schema,
    )
    expect(shaped.report.analysis).toEqual({ id: ids.analysisA, score: 1 })
    expect(shaped.report).not.toHaveProperty('analyses')
  })

  it('does not mutate the raw data when reshaping nested scopes', () => {
    const raw = { reports: rawReportsWithAnalyses }
    shapeResult(raw, { reports: { analyses: { $: { $at: 0 } } } }, schema)
    expect(rawReportsWithAnalyses[0]).toHaveProperty('analyses')
    expect(rawReportsWithAnalyses[0]!.analyses).toHaveLength(2)
  })
})

describe('shapeResult — $m projections', () => {
  it('adds sibling keys and keeps the original scope key intact', () => {
    const shaped = shapeResult(
      { tasks: rawTasks },
      {
        tasks: {
          $m: {
            tasksById: { indexBy: 'id' },
            tasksByStatus: { groupBy: 'isDone' },
            latestTask: { at: -1 },
          },
        },
      },
      schema,
    )
    expect(shaped.tasks).toBe(rawTasks)
    expect(shaped.tasksById[ids.taskTwo]).toBe(rawTasks[1])
    expect(Object.keys(shaped.tasksById)).toHaveLength(3)
    expect(shaped.tasksByStatus).toEqual({
      true: [rawTasks[0]],
      false: [rawTasks[1], rawTasks[2]],
    })
    expect(shaped.latestTask).toBe(rawTasks[2])
  })

  it('combines $m with a pick on the same scope', () => {
    const shaped = shapeResult(
      { tasks: rawTasks },
      { tasks: { $: { $only: true }, $m: { tasksById: { indexBy: 'id' } } } },
      schema,
    )
    expect(shaped.task).toBe(rawTasks[0])
    expect(shaped.tasksById[ids.taskOne]).toBe(rawTasks[0])
    expect(shaped).not.toHaveProperty('tasks')
  })

  it('skips entities with nullish projection values', () => {
    const sparse = [
      { id: 'u1', email: 'a@b.c' },
      { id: 'u2', email: undefined },
      { id: 'u3', email: null },
    ]
    const shaped = shapeResult(
      { $users: sparse },
      { $users: { $m: { usersByEmail: { indexBy: 'email' } } } },
      schema,
    )
    expect(Object.keys(shaped.usersByEmail)).toEqual(['a@b.c'])
  })

  it('projects nested scopes inside each parent entity', () => {
    const shaped = shapeResult(
      { reports: rawReportsWithAnalyses },
      { reports: { analyses: { $m: { analysesById: { indexBy: 'id' } } } } },
      schema,
    )
    const report = shaped.reports[0]
    expect(report.analyses).toHaveLength(2)
    expect(report.analysesById[ids.analysisB]).toEqual({ id: ids.analysisB, score: 2 })
  })

  it('groupBy pre-creates an empty bucket for every runtime-enum value', () => {
    const fruits = [
      { id: 'f1', name: 'apple', sku: 1 },
      { id: 'f2', name: 'apple', sku: 2 },
      { id: 'f3', name: 'banana', sku: 3 },
    ]
    const shaped = shapeResult(
      { fruits },
      { fruits: { $m: { byName: { groupBy: 'name' } } } },
      schema,
    )
    expect(shaped.byName).toEqual({
      apple: [fruits[0], fruits[1]],
      banana: [fruits[2]],
      orange: [], // no rows, but the enum universe guarantees the bucket
    })
  })

  it('groupBy on a boolean field always yields both buckets', () => {
    const shaped = shapeResult(
      { tasks: [{ id: 't1', isDone: true }] },
      { tasks: { $m: { byStatus: { groupBy: 'isDone' } } } },
      schema,
    )
    expect(shaped.byStatus).toEqual({ true: [{ id: 't1', isDone: true }], false: [] })
  })

  it('groupBy on a non-enum field has only the buckets the data fills', () => {
    const shaped = shapeResult(
      { fruits: [{ id: 'f1', kind: 'sweet' }] },
      { fruits: { $m: { byKind: { groupBy: 'kind' } } } },
      schema,
    )
    expect(shaped.byKind).toEqual({ sweet: [{ id: 'f1', kind: 'sweet' }] })
  })
})

describe('shapeResult — singularize modes', () => {
  const modes = (singularize: 'off' | 'explicit') =>
    defineSchema({
      namespaces: {
        tasks: i.namespace({ fields: { title: i.string() } }),
        analyses: i.namespace({ singular: 'analysis', fields: { score: i.number() } }),
      },
      options: { singularize },
    })

  it('off keeps keys while still coercing', () => {
    const shaped = shapeResult(
      { tasks: rawTasks },
      { tasks: { $: { $only: true } } },
      modes('off'),
    )
    expect(shaped).toEqual({ tasks: rawTasks[0] })
  })

  it('explicit uses declared singulars only', () => {
    const off = modes('explicit')
    expect(
      shapeResult({ tasks: rawTasks }, { tasks: { $: { $only: true } } }, off),
    ).toEqual({ tasks: rawTasks[0] })
    expect(
      shapeResult(
        { analyses: [{ id: 'a', score: 1 }] },
        { analyses: { $: { $only: true } } },
        off,
      ),
    ).toEqual({ analysis: { id: 'a', score: 1 } })
  })
})
