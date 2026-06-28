// @vitest-environment jsdom
import type { AppSchema } from '@test'
import { createMockCore, ids, schema } from '@test'
import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, isReactive, nextTick } from 'vue'
import { $only } from '../../query/index.js'
import { IdbDuxDatabase } from '../baseline/index.js'
import { IdbClient } from './db.js'

function makeClient(opts?: Parameters<typeof createMockCore>[0]) {
  const mock = createMockCore(opts)
  const baseline = new IdbDuxDatabase(mock.core)
  const db = new IdbClient<AppSchema>(baseline as any, schema)
  return { db, mock }
}

function withScope<T>(fn: () => T) {
  const scope = effectScope()
  const result = scope.run(fn) as T
  return { result, cleanup: () => scope.stop() }
}

describe('overlay useQuery — shaping + result pattern', () => {
  let h: ReturnType<typeof makeClient>
  beforeEach(() => (h = makeClient()))

  it('normalizes top-level scopes to arrays, never undefined', async () => {
    const { result } = withScope(() => h.db.useQuery({ tasks: {} }))
    expect(result.tasks.value).toEqual([]) // array before load, not undefined
    expect(result.isLoading.value).toBe(true)

    h.mock.emitQuery({
      data: { tasks: [{ id: ids.taskOne, title: 'a', isDone: false }] },
      pageInfo: {},
      error: undefined,
    })
    await nextTick()
    expect(result.isLoading.value).toBe(false)
    expect(result.tasks.value).toHaveLength(1)
  })

  it('applies $only shaping and singularizes the destructured key', async () => {
    const { result } = withScope(() =>
      h.db.useQuery({ workspaces: { $: { $only } } }),
    )
    h.mock.emitQuery({
      data: { workspaces: [{ id: ids.workspaceAlpha, name: 'Alpha' }] },
      pageInfo: {},
      error: undefined,
    })
    await nextTick()
    expect(result.workspace.value).toEqual({ id: ids.workspaceAlpha, name: 'Alpha' })
  })

  it('exposes $m siblings beside the scope key', async () => {
    const { result } = withScope(() =>
      h.db.useQuery({ tasks: { $m: { tasksById: { indexBy: 'id' } } } }),
    )
    h.mock.emitQuery({
      data: { tasks: [{ id: ids.taskOne, title: 'a' }] },
      pageInfo: {},
      error: undefined,
    })
    await nextTick()
    expect(result.tasksById.value[ids.taskOne]).toEqual({ id: ids.taskOne, title: 'a' })
  })

  it('serves all three reading styles over one source', async () => {
    const { result } = withScope(() => h.db.useQuery({ tasks: {} }))
    h.mock.emitQuery({ data: { tasks: [{ id: ids.taskOne }] }, pageInfo: {}, error: undefined })
    await nextTick()
    // top-level refs
    expect(result.tasks.value).toHaveLength(1)
    // .refs passthrough
    expect(result.refs.tasks.value).toHaveLength(1)
    // .state — .value-free reads
    expect(result.state.tasks).toHaveLength(1)
    expect(result.state.isLoading).toBe(false)
  })

  it('pauses on a null factory without subscribing', () => {
    withScope(() => h.db.useQuery(() => null))
    expect(h.mock.core.subscribeQuery).not.toHaveBeenCalled()
  })
})

describe('overlay queryOnce — plain shaped data', () => {
  it('returns shaped data with no refs', async () => {
    const { db, mock } = makeClient()
    mock.core.queryOnce.mockResolvedValueOnce({
      data: { workspaces: [{ id: ids.workspaceAlpha, name: 'Alpha' }] },
      pageInfo: {},
    })
    const { workspace } = await db.queryOnce({ workspaces: { $: { $only } } })
    expect(workspace).toEqual({ id: ids.workspaceAlpha, name: 'Alpha' })
  })
})

describe('overlay auth + connection', () => {
  it('useAuth folds null user to undefined and transitions', async () => {
    const { db, mock } = makeClient()
    const { result } = withScope(() => db.useAuth())
    expect(result.isLoading.value).toBe(true)
    mock.emitAuth({ user: { id: 'u1', email: 'a@b.c' }, error: undefined })
    await nextTick()
    expect(result.user.value).toEqual({ id: 'u1', email: 'a@b.c' })
    expect(result.isLoading.value).toBe(false)
  })

  it('useUser({ requireUser }) throws when signed out', () => {
    const { db } = makeClient()
    const { result } = withScope(() => db.useUser({ requireUser: true }))
    expect(() => result.value).toThrow(/auth gate/)
  })

  it('useConnectionStatus exposes status via the result pattern', async () => {
    const { db, mock } = makeClient({ status: 'connecting' })
    const { result } = withScope(() => db.useConnectionStatus())
    expect(result.status.value).toBe('connecting')
    mock.emitStatus('connected')
    await nextTick()
    expect(result.status.value).toBe('connected')
  })
})

describe('overlay Pinia safety', () => {
  it('state is a raw getter projection — not reactive, write-protected, still tracks', async () => {
    const { db, mock } = makeClient()
    const { result } = withScope(() => db.useAuth())
    const { state } = result
    expect(isReactive(state)).toBe(false)
    expect(() => {
      (state as any).user = { id: 'x' }
    }).toThrow()
    mock.emitAuth({ user: { id: 'u1' }, error: undefined })
    await nextTick()
    expect(state.user).toEqual({ id: 'u1' }) // getter reflects the live ref
  })
})
