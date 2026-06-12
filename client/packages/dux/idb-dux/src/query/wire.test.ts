import { describe, expect, it } from 'vitest'
import { $only, $skip } from './constants.js'
import { toWireQuery } from './wire.js'

describe('toWireQuery', () => {
  it('strips the dux-only $ keys and keeps native ones verbatim', () => {
    const wire = toWireQuery({
      tasks: {
        $: { where: { isDone: false }, limit: 5, $only, $at: -1, $as: 'last' },
      },
    })
    expect(wire).toEqual({ tasks: { $: { where: { isDone: false }, limit: 5 } } })
  })

  it('strips $m blocks at every depth', () => {
    const wire = toWireQuery({
      tasks: {
        $m: { tasksById: { indexBy: 'id' } },
        subtasks: { $m: { byId: { indexBy: 'id' } } },
      },
    })
    expect(wire).toEqual({ tasks: { subtasks: {} } })
  })

  it('drops $skip clauses, including inside and/or, and empty leftovers', () => {
    const wire = toWireQuery({
      tasks: {
        $: {
          where: {
            isDone: false,
            workspace: $skip,
            or: [{ title: 'a' }, { title: $skip }],
          },
        },
      },
    })
    expect(wire).toEqual({
      tasks: { $: { where: { isDone: false, or: [{ title: 'a' }] } } },
    })
  })

  it('drops a $ that ends up empty', () => {
    const wire = toWireQuery({ tasks: { $: { where: { title: $skip }, $only } } })
    expect(wire).toEqual({ tasks: {} })
  })

  it('never mutates the authored query', () => {
    const query = { tasks: { $: { where: { isDone: false }, $only }, subtasks: {} } }
    toWireQuery(query)
    expect(query.tasks.$.$only).toBe(true)
    expect(query.tasks.$.where).toEqual({ isDone: false })
  })
})
