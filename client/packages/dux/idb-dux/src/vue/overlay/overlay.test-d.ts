import type { AppSchema } from '@test'
import type { Ref } from 'vue'
import type { ReservedResultKey } from '../../query/index.js'
import type { IdbEntity } from '../../schema/index.js'
import type { IdbClient } from '../index.js'
import type { IdbInfiniteQueryResult, IdbQueryResult } from './types.js'
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

describe('overlay app status', () => {
  it('uses the result pattern for maintenance mode', () => {
    const { isLoading, isReadOnly, state } = db.useAppStatus()
    expectTypeOf(isLoading).toEqualTypeOf<Ref<boolean>>()
    expectTypeOf(isReadOnly).toEqualTypeOf<Ref<boolean | undefined>>()
    expectTypeOf(state.isReadOnly).toEqualTypeOf<boolean | undefined>()
  })
})

describe('reserved result keys — drift lock', () => {
  // The query-validation guard (`IDBDUXERR_RESULT_KEY_RESERVED`) rejects userland
  // scope keys that would collide with a hook result field. Its reserved set
  // (`ReservedResultKey`) must cover every static key these results actually
  // expose — an empty query has no data keys, so its keys are exactly the
  // static ones. If a new static key is added without updating the set, this
  // fails, and the guard would silently miss the new collision.
  it('ReservedResultKey covers every static query-result key', () => {
    expectTypeOf<keyof IdbQueryResult<{}, AppSchema>>().toExtend<ReservedResultKey>()
    expectTypeOf<keyof IdbInfiniteQueryResult<{}, AppSchema>>().toExtend<ReservedResultKey>()
  })
})
