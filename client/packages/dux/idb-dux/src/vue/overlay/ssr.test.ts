/**
 * The SSR floor (dux-spec-vue.md §8): every hook returns safe inert state on
 * the server and opens no subscription — never crashes. This file runs under
 * the default node environment (no `window`), so `isClient()` is false.
 */
import type { AppSchema } from '@test'
import { createMockCore, schema } from '@test'
import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { $only } from '../../query/index.js'
import { InstantDuxDatabase } from '../baseline/index.js'
import { isClient } from '../baseline/utils.js'
import { IdbClient } from './db.js'

function makeClient() {
  const mock = createMockCore()
  const baseline = new InstantDuxDatabase(mock.core)
  return { db: new IdbClient<AppSchema>(baseline as any, schema), mock }
}

function withScope<T>(fn: () => T) {
  const scope = effectScope()
  const result = scope.run(fn) as T
  return { result, cleanup: () => scope.stop() }
}

describe('ssr floor', () => {
  it('confirms the server environment (no window)', () => {
    expect(isClient()).toBe(false)
  })

  it('useQuery is inert and opens no subscription on the server', () => {
    const { db, mock } = makeClient()
    const { result } = withScope(() => db.useQuery({ tasks: {} }))
    expect(mock.core.subscribeQuery).not.toHaveBeenCalled()
    expect(result.isLoading.value).toBe(true)
    // shaping still runs over no data — the array contract holds inert
    expect(result.tasks.value).toEqual([])
  })

  it('shaped picks stay undefined inert (no crash)', () => {
    const { db } = makeClient()
    const { result } = withScope(() => db.useQuery({ workspaces: { $: { $only } } }))
    expect(result.workspace.value).toBeUndefined()
  })

  it('useAuth is inert and opens no subscription', () => {
    const { db, mock } = makeClient()
    const { result } = withScope(() => db.useAuth())
    expect(mock.core.subscribeAuth).not.toHaveBeenCalled()
    expect(result.isLoading.value).toBe(true)
    expect(result.user.value).toBeUndefined()
  })

  it('useConnectionStatus is inert and opens no subscription', () => {
    const { db, mock } = makeClient()
    const { result } = withScope(() => db.useConnectionStatus())
    expect(mock.core.subscribeConnectionStatus).not.toHaveBeenCalled()
    expect(result.status.value).toBe('connecting')
  })

  it('useLocalId is inert (no client storage on the server)', () => {
    const { db, mock } = makeClient()
    const { result } = withScope(() => db.useLocalId('device'))
    expect(mock.core.getLocalId).not.toHaveBeenCalled()
    expect(result.localId.value).toBeNull()
  })
})
