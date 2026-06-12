import type { AppSchema } from '@test'
import type { Ref } from 'vue'
import type { IdbEntity } from '../../schema/index.js'
import type { IdbClient } from '../index.js'
import { describe, expectTypeOf, it } from 'vitest'

declare const db: IdbClient<AppSchema>

type Task = IdbEntity<'tasks', AppSchema>
type Workspace = IdbEntity<'workspaces', AppSchema>

describe('overlay useQuery — result shapes', () => {
  it('exposes top-level scope refs, normalized to arrays', () => {
    const { tasks, isLoading, error } = db.useQuery({ tasks: {} })
    expectTypeOf(tasks).toEqualTypeOf<Ref<Task[]>>()
    expectTypeOf(isLoading).toEqualTypeOf<Ref<boolean>>()
    expectTypeOf(error).toEqualTypeOf<Ref<{ message: string } | undefined>>()
  })

  it('coerces $only scopes to Entity | undefined under the singular key', () => {
    const { workspace } = db.useQuery({ workspaces: { $: { $only: true } } })
    expectTypeOf(workspace).toEqualTypeOf<Ref<Workspace | undefined>>()
  })

  it('exposes $m siblings as their own refs', () => {
    const { tasks, tasksById } = db.useQuery({
      tasks: { $m: { tasksById: { indexBy: 'id' } } },
    })
    expectTypeOf(tasks).toEqualTypeOf<Ref<Task[]>>()
    expectTypeOf(tasksById).toEqualTypeOf<Ref<Record<string, Task>>>()
  })

  it('.state is a .value-free projection', () => {
    const { state } = db.useQuery({ tasks: {} })
    expectTypeOf(state.tasks).toEqualTypeOf<Task[]>()
    expectTypeOf(state.isLoading).toEqualTypeOf<boolean>()
  })
})

describe('overlay queryOnce — plain shaped data', () => {
  it('returns shaped data, not refs', async () => {
    const data = await db.queryOnce({ workspaces: { $: { $only: true } } })
    expectTypeOf(data.workspace).toEqualTypeOf<Workspace | undefined>()
  })
})

describe('overlay auth', () => {
  it('useAuth user is IdbAuthUser | undefined', () => {
    const { user } = db.useAuth()
    expectTypeOf(user.value).toExtend<{ id: string } | undefined>()
  })

  it('useUser({ requireUser }) types user present', () => {
    const user = db.useUser({ requireUser: true })
    expectTypeOf(user.value).toExtend<{ id: string }>()
    // default leaves it optional
    const maybe = db.useUser()
    expectTypeOf(maybe.value).toExtend<{ id: string } | undefined>()
  })
})
