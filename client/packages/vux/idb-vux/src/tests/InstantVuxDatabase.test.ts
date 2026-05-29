import type { AuthState, ConnectionStatus } from '@instantdb/core'
import type { EffectScope } from 'vue'
import { i } from '@instantdb/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, isReactive, isRef, nextTick, reactive, ref, toValue, watch, watchEffect } from 'vue'
import { defineDb } from '../defineDb.js'
import { InstantVuxDatabase } from '../InstantVuxDatabase.js'

function createMockCore() {
  return {
    _reactor: {
      status: 'connecting' as ConnectionStatus,
      _currentUserCached: null as AuthState | null,
      querySubs: {
        updateInPlace: vi.fn(),
      },
      kv: {
        updateInPlace: vi.fn(),
      },
      getPreviousResult: vi.fn((): Record<string, unknown> | null => null),
      getPresence: vi.fn((): Record<string, unknown> | null => null),
      subscribeTopic: vi.fn(() => vi.fn()),
      subscribePresence: vi.fn(() => vi.fn()),
      joinRoom: vi.fn(() => vi.fn()),
      publishPresence: vi.fn(),
      publishTopic: vi.fn(),
    },
    auth: {
      sendMagicCode: vi.fn(),
      signInWithMagicCode: vi.fn(),
      signOut: vi.fn(),
      signInAsGuest: vi.fn(),
    },
    storage: {
      upload: vi.fn(),
      getDownloadUrl: vi.fn(),
      delete: vi.fn(),
    },
    streams: {
      createReadStream: vi.fn(),
      createWriteStream: vi.fn(),
    },
    getLocalId: vi.fn((name: string) => Promise.resolve(`local-id-${name}`)),
    transact: vi.fn(() => Promise.resolve({ status: 'synced' })),
    getAuth: vi.fn(() => Promise.resolve(null)),
    queryOnce: vi.fn(() => Promise.resolve({ data: {}, pageInfo: {} })),
    subscribeQuery: vi.fn((_query: any, _cb: (result: any) => void) => () => { }),
    subscribeAuth: vi.fn((_cb: (auth: any) => void) => () => { }),
    subscribeConnectionStatus: vi.fn(
      (_cb: (status: ConnectionStatus) => void) => () => { },
    ),
  }
}

function isPiniaSetupStoreHydratable(value: unknown) {
  return (isRef(value) && !(value as any).effect) || isReactive(value)
}

describe('instantVuxDatabase', () => {
  let mockCore: ReturnType<typeof createMockCore>
  let db: any
  let originalWindow: any

  function withServerRuntime<T>(run: () => T): T {
    const currentWindow = (globalThis as any).window
    vi.stubGlobal('window', undefined)

    try {
      return run()
    }
    finally {
      vi.stubGlobal('window', currentWindow)
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCore = createMockCore()
    db = new InstantVuxDatabase<any, false, any>(mockCore as any)
    originalWindow = (globalThis as any).window
  })

  afterEach(() => {
    vi.stubGlobal('window', originalWindow)
  })

  describe('non-reactive methods', () => {
    it('transact delegates to core', async () => {
      const chunks = [{ type: 'update', entity: 'goals' }]
      await db.transact(chunks as any)
      expect(mockCore.transact).toHaveBeenCalledWith(chunks)
    })

    it('getAuth delegates to core', async () => {
      await db.getAuth()
      expect(mockCore.getAuth).toHaveBeenCalled()
    })

    it('queryOnce delegates to core', async () => {
      const query = { goals: {} }
      await db.queryOnce(query as any)
      expect(mockCore.queryOnce).toHaveBeenCalledWith(query, undefined)
    })

    it('queryOnceX delegates to core and defaults requested namespaces to empty arrays', async () => {
      const query = {
        goals: {},
        todos: {},
      }
      const queryOncePayload = {
        data: {
          goals: [{ id: '1', title: 'Typed query once' }],
        },
        pageInfo: {
          goals: { hasNextPage: false },
        },
      }
      mockCore.queryOnce.mockResolvedValue(queryOncePayload)

      const result = await db.queryOnceX(query as any)

      expect(mockCore.queryOnce).toHaveBeenCalledWith(query, undefined)
      expect(result.data).toEqual(queryOncePayload.data)
      expect(result.pageInfo).toEqual(queryOncePayload.pageInfo)
      expect(result.goals).toEqual([{ id: '1', title: 'Typed query once' }])
      expect(result.todos).toEqual([])
    })

    it('getLocalId delegates to core', async () => {
      const result = await db.getLocalId('device')
      expect(result).toBe('local-id-device')
    })

    it('exposes core streams on the database instance', () => {
      expect(db.streams).toBe(mockCore.streams)
    })
  })

  describe('defineDb', () => {
    const schema = i.schema({
      entities: {
        goals: i.entity({
          title: i.string(),
        }),
      },
      links: {},
    })

    it('returns null when app id is missing and missingAppId is null', () => {
      const useDb = defineDb({
        schema,
        missingAppId: null,
        getAppId: () => '',
      })

      expect(useDb()).toBeNull()
    })

    it('throws when app id is missing and missingAppId defaults to throw', () => {
      const useDb = defineDb({
        schema,
        getAppId: () => undefined,
      })

      expect(() => useDb()).toThrow('Instant App ID is not configured.')
    })
  })

  describe('useQuery', () => {
    let scope: EffectScope

    beforeEach(() => {
      scope = effectScope()
    })

    afterEach(() => {
      scope.stop()
    })

    it('starts in loading state', () => {
      let query: any
      scope.run(() => {
        query = db.useQuery({ goals: {} } as any)
      })

      expect(query.isLoading.value).toBe(true)
      expect(query.data.value).toBeUndefined()
      expect(query.error.value).toBeUndefined()
    })

    it('subscribes to core on mount', async () => {
      scope.run(() => {
        db.useQuery({ goals: {} } as any)
      })
      await nextTick()

      expect(mockCore.subscribeQuery).toHaveBeenCalled()
    })

    it('updates state when query result arrives', async () => {
      let queryCb: ((result: any) => void) | undefined
      mockCore.subscribeQuery.mockImplementation((_q: any, cb: any) => {
        queryCb = cb
        return () => { }
      })

      let query: any
      scope.run(() => {
        query = db.useQuery({ goals: {} } as any)
      })
      await nextTick()

      expect(queryCb).toBeDefined()

      queryCb?.({
        data: { goals: [{ id: '1', title: 'Test' }] },
        pageInfo: {},
      })
      await nextTick()

      expect(query.isLoading.value).toBe(false)
      expect(query.data.value).toEqual({ goals: [{ id: '1', title: 'Test' }] })
    })

    it('supports reactive destructuring for parity-style query usage', async () => {
      let queryCb: ((result: any) => void) | undefined
      mockCore.subscribeQuery.mockImplementation((_q: any, cb: any) => {
        queryCb = cb
        return () => { }
      })

      let isLoading: any
      let error: any
      let data: any
      let pageInfo: any

      scope.run(() => {
        ({ isLoading, error, data, pageInfo } = db.useQuery({ goals: {} } as any))
      })
      await nextTick()

      expect(isLoading.value).toBe(true)
      expect(data.value).toBeUndefined()
      expect(pageInfo.value).toBeUndefined()
      expect(error.value).toBeUndefined()

      queryCb?.({
        data: { goals: [{ id: '1', title: 'Destructured' }] },
        pageInfo: { goals: { hasNextPage: false } },
        error: undefined,
      })
      await nextTick()

      expect(isLoading.value).toBe(false)
      expect(data.value).toEqual({ goals: [{ id: '1', title: 'Destructured' }] })
      expect(pageInfo.value).toEqual({ goals: { hasNextPage: false } })
      expect(error.value).toBeUndefined()
    })

    it('documents same-reference callback assignments do not retrigger dependent effects', async () => {
      let queryCb: ((result: any) => void) | undefined
      mockCore.subscribeQuery.mockImplementation((_q: any, cb: any) => {
        queryCb = cb
        return () => { }
      })

      const observedGoalCounts: number[] = []
      let query: any
      scope.run(() => {
        query = db.useQuery({ goals: {} } as any)

        watchEffect(() => {
          observedGoalCounts.push(query.data.value?.goals?.length ?? 0)
        })
      })
      await nextTick()

      const sharedResult = {
        data: {
          goals: [{ id: '1', title: 'A' }],
        },
        pageInfo: {},
      }

      queryCb?.(sharedResult)
      await nextTick()

      sharedResult.data.goals.push({ id: '2', title: 'B' })
      queryCb?.(sharedResult)
      await nextTick()

      expect(observedGoalCounts).toEqual([0, 1])
      expect(query.data.value?.goals).toEqual([
        { id: '1', title: 'A' },
        { id: '2', title: 'B' },
      ])
    })

    it('unsubscribes on scope dispose', async () => {
      const unsub = vi.fn()
      mockCore.subscribeQuery.mockImplementation(() => unsub)

      scope.run(() => {
        db.useQuery({ goals: {} } as any)
      })
      await nextTick()

      scope.stop()
      expect(unsub).toHaveBeenCalled()
    })

    it('handles null query', async () => {
      let query: any
      scope.run(() => {
        query = db.useQuery(null)
      })
      await nextTick()

      expect(query.isLoading.value).toBe(true)
      expect(query.data.value).toBeUndefined()
      expect(mockCore.subscribeQuery).not.toHaveBeenCalled()
    })

    it('accepts a function that returns a query', async () => {
      scope.run(() => {
        db.useQuery(() => ({ goals: {} }) as any)
      })
      await nextTick()

      expect(mockCore.subscribeQuery).toHaveBeenCalled()
    })

    it('accepts a ref containing a query', async () => {
      const queryRef = ref<any>({ goals: {} })

      scope.run(() => {
        db.useQuery(queryRef)
      })
      await nextTick()

      expect(mockCore.subscribeQuery).toHaveBeenCalled()
    })

    it('skips subscription when function returns null', async () => {
      let query: any
      scope.run(() => {
        query = db.useQuery(() => null)
      })
      await nextTick()

      expect(query.isLoading.value).toBe(true)
      expect(query.data.value).toBeUndefined()
      expect(mockCore.subscribeQuery).not.toHaveBeenCalled()
    })

    it('re-subscribes when function query changes', async () => {
      const unsub = vi.fn()
      mockCore.subscribeQuery.mockImplementation(() => unsub)

      const queryFilter = ref<string | null>(null)

      scope.run(() => {
        db.useQuery(() => {
          if (!queryFilter.value) {
            return null
          }

          return {
            goals: {
              $: {
                where: {
                  status: { $in: [queryFilter.value] },
                },
              },
            },
          } as any
        })
      })
      await nextTick()

      expect(mockCore.subscribeQuery).not.toHaveBeenCalled()

      queryFilter.value = 'active'
      await nextTick()
      expect(mockCore.subscribeQuery).toHaveBeenCalledTimes(1)

      queryFilter.value = 'done'
      await nextTick()
      expect(unsub).toHaveBeenCalled()
      expect(mockCore.subscribeQuery).toHaveBeenCalledTimes(2)
    })

    it('does not re-subscribe when factory dependencies change but the query hash is stable', async () => {
      const unsub = vi.fn()
      mockCore.subscribeQuery.mockImplementation(() => unsub)

      const unrelatedDependency = ref(0)

      scope.run(() => {
        db.useQuery(() => {
          unrelatedDependency.value
          return {
            goals: {
              $: {
                where: {
                  status: {
                    $in: ['active'],
                  },
                },
              },
            },
          } as any
        })
      })
      await nextTick()

      expect(mockCore.subscribeQuery).toHaveBeenCalledTimes(1)

      unrelatedDependency.value += 1
      await nextTick()

      expect(unsub).not.toHaveBeenCalled()
      expect(mockCore.subscribeQuery).toHaveBeenCalledTimes(1)
    })

    it('does not cyclically re-subscribe when subscription callbacks update hook state', async () => {
      let queryCb: ((result: any) => void) | undefined
      const unsub = vi.fn()
      mockCore.subscribeQuery.mockImplementation((_query: any, cb: any) => {
        queryCb = cb
        return unsub
      })

      scope.run(() => {
        db.useQuery({ goals: {} } as any)
      })
      await nextTick()

      expect(mockCore.subscribeQuery).toHaveBeenCalledTimes(1)

      queryCb?.({
        data: { goals: [{ id: '1', title: 'Loop guard' }] },
        pageInfo: { goals: { hasNextPage: false } },
        error: undefined,
      })
      await nextTick()

      expect(unsub).not.toHaveBeenCalled()
      expect(mockCore.subscribeQuery).toHaveBeenCalledTimes(1)
    })

    it('uses cached result when available', async () => {
      mockCore._reactor.getPreviousResult.mockReturnValue({
        data: { goals: [{ id: '1' }] },
        pageInfo: {},
      })

      let query: any
      scope.run(() => {
        query = db.useQuery({ goals: {} } as any)
      })
      await nextTick()

      expect(query.isLoading.value).toBe(false)
      expect(query.data.value).toEqual({ goals: [{ id: '1' }] })
    })

    it('normalizes direct undefined where values before subscribing', async () => {
      scope.run(() => {
        db.useQuery({
          goals: {
            $: {
              where: {
                status: undefined,
                title: 'Ship Vue',
              },
            },
          },
        } as any)
      })
      await nextTick()

      expect(mockCore.subscribeQuery).toHaveBeenCalledWith(
        {
          goals: {
            $: {
              where: {
                title: 'Ship Vue',
              },
            },
          },
        },
        expect.any(Function),
      )
    })

    it('keeps previous data during query changes when requested', async () => {
      const callbacks: ((result: any) => void)[] = []
      mockCore.subscribeQuery.mockImplementation((_q: any, cb: any) => {
        callbacks.push(cb)
        return () => { }
      })

      const queryFilter = ref('active')
      let query: any
      scope.run(() => {
        query = db.useQuery(() => ({
          goals: {
            $: {
              where: {
                status: queryFilter.value,
              },
            },
          },
        }) as any, { keepPreviousData: true })
      })
      await nextTick()

      callbacks[0]?.({
        data: { goals: [{ id: '1', status: 'active' }] },
        pageInfo: { goals: { hasNextPage: false } },
      })
      await nextTick()

      queryFilter.value = 'done'
      await nextTick()

      expect(query.isLoading.value).toBe(true)
      expect(query.data.value).toEqual({
        goals: [{ id: '1', status: 'active' }],
      })
      expect(query.pageInfo.value).toEqual({ goals: { hasNextPage: false } })
      expect(mockCore.subscribeQuery).toHaveBeenCalledTimes(2)
    })

    it('tracks X state property reads inside auth-gated query factories', async () => {
      let authCb: ((auth: any) => void) | undefined
      mockCore.subscribeAuth.mockImplementation((cb: any) => {
        authCb = cb
        return () => { }
      })

      const unsubscribes: ReturnType<typeof vi.fn>[] = []
      mockCore.subscribeQuery.mockImplementation((_query: any) => {
        const unsub = vi.fn()
        unsubscribes.push(unsub)
        return unsub
      })

      scope.run(() => {
        const { state: auth } = db.useAuthX()

        db.useQuery(() => {
          if (!auth.user?.id) {
            return null
          }

          return {
            goals: {
              $: {
                where: {
                  'owner.id': auth.user.id,
                },
              },
            },
          }
        })
      })
      await nextTick()

      expect(mockCore.subscribeQuery).not.toHaveBeenCalled()

      authCb?.({ user: { id: 'u1', email: 'test@test.com' } })
      await nextTick()

      expect(mockCore.subscribeQuery).toHaveBeenCalledTimes(1)
      expect(mockCore.subscribeQuery.mock.calls[0]?.[0]).toEqual({
        goals: {
          $: {
            where: {
              'owner.id': 'u1',
            },
          },
        },
      })

      authCb?.({ user: { id: 'u2', email: 'test2@test.com' } })
      await nextTick()

      expect(unsubscribes[0]).toHaveBeenCalled()
      expect(mockCore.subscribeQuery).toHaveBeenCalledTimes(2)
      expect(mockCore.subscribeQuery.mock.calls[1]?.[0]).toEqual({
        goals: {
          $: {
            where: {
              'owner.id': 'u2',
            },
          },
        },
      })
    })

    it('returns inert state on server runtime', () => {
      withServerRuntime(() => {
        const scopeInServer = effectScope()
        let query: any

        scopeInServer.run(() => {
          query = db.useQuery({ goals: {} } as any)
        })

        expect(query.isLoading.value).toBe(true)
        expect(query.data.value).toBeUndefined()
        expect(mockCore.subscribeQuery).not.toHaveBeenCalled()

        scopeInServer.stop()
      })
    })

    it('returns inert state when reactor is present but not initialized', () => {
      const brokenCore = createMockCore()
      delete (brokenCore._reactor as any).querySubs
      const brokenDb = new InstantVuxDatabase(brokenCore as any)

      const scope = effectScope()
      let query: any

      scope.run(() => {
        query = brokenDb.useQuery({ goals: {} } as any)
      })

      expect(query.isLoading.value).toBe(true)
      expect(brokenCore.subscribeQuery).not.toHaveBeenCalled()
      scope.stop()
    })
  })

  describe('useQueryX', () => {
    let scope: EffectScope

    beforeEach(() => {
      scope = effectScope()
    })

    afterEach(() => {
      scope.stop()
    })

    it('exposes refs plus state alias and defaults namespaces to empty arrays', async () => {
      let query: any
      scope.run(() => {
        query = db.useQueryX({ goals: {} } as any)
      })
      await nextTick()

      expect(query.refs).toBe(query)
      expect(isPiniaSetupStoreHydratable(query)).toBe(false)
      expect(isPiniaSetupStoreHydratable(query.state)).toBe(false)
      expect(query.isLoading.value).toBe(true)
      expect(query.goals.value).toEqual([])
      expect(query.state.goals).toEqual([])
      expect(query.state.data).toBeUndefined()

      const spreadRefs = { ...query.refs }
      expect(Object.keys(spreadRefs)).toContain('goals')
      expect(spreadRefs.goals.value).toEqual([])
    })

    it('materializes declared root namespaces for refs spreads', async () => {
      let query: any
      scope.run(() => {
        query = db.useQueryX({
          goals: {},
          todos: {},
        } as any)
      })
      await nextTick()

      const spreadRefs = { ...query.refs }
      expect(Object.keys(spreadRefs)).toEqual(expect.arrayContaining(['goals', 'todos']))
      expect(spreadRefs.goals.value).toEqual([])
      expect(spreadRefs.todos.value).toEqual([])
    })

    it('updates namespace refs/state when query results arrive', async () => {
      let queryCb: ((result: any) => void) | undefined
      mockCore.subscribeQuery.mockImplementation((_q: any, cb: any) => {
        queryCb = cb
        return () => { }
      })

      let query: any
      scope.run(() => {
        query = db.useQueryX({ goals: {} } as any)
      })
      await nextTick()

      const payload = {
        goals: [{ id: '1', title: 'Test' }],
      }

      queryCb?.({
        data: payload,
        pageInfo: { goals: { hasNextPage: false } },
        error: undefined,
      })
      await nextTick()

      expect(query.isLoading.value).toBe(false)
      expect(query.state.isLoading).toBe(false)
      expect(query.goals.value).toEqual([{ id: '1', title: 'Test' }])
      expect(query.state.goals).toEqual([{ id: '1', title: 'Test' }])
      expect(query.state.error).toBeUndefined()
      expect(query.data.value).toEqual(payload)
      expect(query.state.data).toEqual(payload)
      expect(query.data.value).toBe(query.state.data)
      expect(query.goals.value).toBe(query.state.goals)
    })

    it('keeps no-value state reads reactive', async () => {
      let queryCb: ((result: any) => void) | undefined
      mockCore.subscribeQuery.mockImplementation((_q: any, cb: any) => {
        queryCb = cb
        return () => { }
      })

      const observedGoalCounts: number[] = []
      let query: any
      scope.run(() => {
        query = db.useQueryX({ goals: {} } as any)
        watchEffect(() => {
          observedGoalCounts.push(query.state.goals.length)
        })
      })
      await nextTick()

      queryCb?.({
        data: { goals: [{ id: '1' }, { id: '2' }] },
        pageInfo: {},
        error: undefined,
      })
      await nextTick()

      expect(observedGoalCounts).toEqual([0, 2])
    })

    it('keeps null-skip behavior aligned with useQuery', async () => {
      let query: any
      scope.run(() => {
        query = db.useQueryX(() => null)
      })
      await nextTick()

      expect(query.isLoading.value).toBe(true)
      expect(query.data.value).toBeUndefined()
      expect(query.goals.value).toEqual([])
      expect(query.state.goals).toEqual([])
      expect(mockCore.subscribeQuery).not.toHaveBeenCalled()
    })

    it('resubscribes when reactive dependencies change in factory queries', async () => {
      const callbacks: ((result: any) => void)[] = []
      const unsubscribes: ReturnType<typeof vi.fn>[] = []

      mockCore.subscribeQuery.mockImplementation((_query: any, cb: any) => {
        callbacks.push(cb)
        const unsub = vi.fn()
        unsubscribes.push(unsub)
        return unsub
      })

      const statusFilter = ref<'active' | 'done' | null>(null)
      let query: any

      scope.run(() => {
        query = db.useQueryX(() => {
          if (!statusFilter.value)
            return null

          return {
            goals: {
              $: {
                where: {
                  status: statusFilter.value,
                },
              },
            },
          }
        })
      })
      await nextTick()

      expect(mockCore.subscribeQuery).not.toHaveBeenCalled()
      expect(query.goals.value).toEqual([])

      statusFilter.value = 'active'
      await nextTick()

      expect(mockCore.subscribeQuery).toHaveBeenCalledTimes(1)
      callbacks[0]?.({
        data: { goals: [{ id: '1', title: 'Active goal' }] },
        pageInfo: { goals: { hasNextPage: false } },
        error: undefined,
      })
      await nextTick()
      expect(query.goals.value).toEqual([{ id: '1', title: 'Active goal' }])

      statusFilter.value = 'done'
      await nextTick()

      expect(mockCore.subscribeQuery).toHaveBeenCalledTimes(2)
      expect(unsubscribes[0]).toHaveBeenCalled()
      expect(query.isLoading.value).toBe(true)
      expect(query.goals.value).toEqual([])
    })
  })

  describe('useAuth', () => {
    let scope: EffectScope

    beforeEach(() => {
      scope = effectScope()
    })

    afterEach(() => {
      scope.stop()
    })

    it('starts in loading state', () => {
      let auth: any
      scope.run(() => {
        auth = db.useAuth()
      })

      expect(auth.isLoading.value).toBe(true)
      expect(auth.user.value).toBeUndefined()
    })

    it('updates when auth state changes', async () => {
      let authCb: ((auth: any) => void) | undefined
      mockCore.subscribeAuth.mockImplementation((cb: any) => {
        authCb = cb
        return () => { }
      })

      let auth: any
      scope.run(() => {
        auth = db.useAuth()
      })
      await nextTick()

      authCb?.({ user: { id: 'u1', email: 'test@test.com' } })
      await nextTick()

      expect(auth.isLoading.value).toBe(false)
      expect(auth.user.value).toEqual({ id: 'u1', email: 'test@test.com' })
    })

    it('supports reactive destructuring for auth state', async () => {
      let authCb: ((auth: any) => void) | undefined
      mockCore.subscribeAuth.mockImplementation((cb: any) => {
        authCb = cb
        return () => { }
      })

      let isLoading: any
      let user: any
      let error: any

      scope.run(() => {
        ({ isLoading, user, error } = db.useAuth())
      })
      await nextTick()

      expect(isLoading.value).toBe(true)
      expect(user.value).toBeUndefined()
      expect(error.value).toBeUndefined()

      authCb?.({ user: { id: 'u1', email: 'test@test.com' } })
      await nextTick()

      expect(isLoading.value).toBe(false)
      expect(user.value).toEqual({ id: 'u1', email: 'test@test.com' })
      expect(error.value).toBeUndefined()
    })

    it('uses cached auth state', () => {
      mockCore._reactor._currentUserCached = {
        isLoading: false,
        user: {
          id: 'cached',
          email: 'cached@test.com',
          refresh_token: '',
          isGuest: false,
        },
        error: undefined,
      }

      const freshDb = new InstantVuxDatabase(mockCore as any)

      let auth: any
      scope.run(() => {
        auth = freshDb.useAuth()
      })

      expect(auth.user.value).toEqual({
        id: 'cached',
        email: 'cached@test.com',
        refresh_token: '',
        isGuest: false,
      })
    })

    it('handles auth error', async () => {
      let authCb: ((auth: any) => void) | undefined
      mockCore.subscribeAuth.mockImplementation((cb: any) => {
        authCb = cb
        return () => { }
      })

      let auth: any
      scope.run(() => {
        auth = db.useAuth()
      })
      await nextTick()

      authCb?.({ error: { message: 'Auth failed' } })
      await nextTick()

      expect(auth.isLoading.value).toBe(false)
      expect(auth.error.value).toEqual({ message: 'Auth failed' })
    })

    it('returns inert loading state on server runtime', () => {
      withServerRuntime(() => {
        const scopeInServer = effectScope()
        let auth: any

        scopeInServer.run(() => {
          auth = db.useAuth()
        })

        expect(auth.isLoading.value).toBe(true)
        expect(auth.user.value).toBeUndefined()
        expect(mockCore.subscribeAuth).not.toHaveBeenCalled()

        scopeInServer.stop()
      })
    })
  })

  describe('useAuthX', () => {
    let scope: EffectScope

    beforeEach(() => {
      scope = effectScope()
    })

    afterEach(() => {
      scope.stop()
    })

    it('exposes refs plus state alias', async () => {
      let authX: any
      scope.run(() => {
        authX = db.useAuthX()
      })
      await nextTick()

      expect(authX.refs).toBe(authX)
      expect(isPiniaSetupStoreHydratable(authX)).toBe(false)
      expect(isPiniaSetupStoreHydratable(authX.state)).toBe(false)
      expect(authX.isLoading.value).toBe(true)
      expect(authX.user.value).toBeUndefined()
      expect(authX.error.value).toBeUndefined()

      expect(authX.state.isLoading).toBe(true)
      expect(authX.state.user).toBeUndefined()
      expect(authX.state.error).toBeUndefined()

      const spreadRefs = { ...authX.refs }
      expect(Object.keys(spreadRefs)).toEqual(expect.arrayContaining(['isLoading', 'user', 'error']))
      expect(spreadRefs.user.value).toBeUndefined()
    })

    it('updates refs/state from a shared auth source', async () => {
      let authCb: ((auth: any) => void) | undefined
      mockCore.subscribeAuth.mockImplementation((cb: any) => {
        authCb = cb
        return () => { }
      })

      let authX: any
      scope.run(() => {
        authX = db.useAuthX()
      })
      await nextTick()

      const payload = { id: 'u1', email: 'test@test.com' }
      authCb?.({ user: payload })
      await nextTick()

      expect(authX.isLoading.value).toBe(false)
      expect(authX.user.value).toEqual(payload)
      expect(authX.state.isLoading).toBe(false)
      expect(authX.state.user).toEqual(payload)
      expect(authX.user.value).toBe(authX.state.user)
    })

    it('keeps no-value auth state reads reactive', async () => {
      let authCb: ((auth: any) => void) | undefined
      mockCore.subscribeAuth.mockImplementation((cb: any) => {
        authCb = cb
        return () => { }
      })

      const observedUserIds: Array<string | undefined> = []
      let authX: any
      scope.run(() => {
        authX = db.useAuthX()
        watchEffect(() => {
          observedUserIds.push(authX.state.user?.id)
        })
      })
      await nextTick()

      authCb?.({ user: { id: 'u1', email: 'test@test.com' } })
      await nextTick()

      expect(observedUserIds).toEqual([undefined, 'u1'])
    })

    it('tracks state property getters, not the raw state object shell', async () => {
      let authCb: ((auth: any) => void) | undefined
      mockCore.subscribeAuth.mockImplementation((cb: any) => {
        authCb = cb
        return () => { }
      })

      const observedShells: any[] = []
      const observedUsers: any[] = []
      const observedUserIds: Array<string | undefined> = []

      scope.run(() => {
        const { state: auth } = db.useAuthX()

        watch(() => auth, value => observedShells.push(value), { immediate: true })
        watch(() => auth.user, value => observedUsers.push(value), { immediate: true })
        watch(() => auth.user?.id, value => observedUserIds.push(value), { immediate: true })
      })
      await nextTick()

      const payload = { id: 'u1', email: 'test@test.com' }
      authCb?.({ user: payload })
      await nextTick()

      expect(observedShells).toHaveLength(1)
      expect(observedUsers).toEqual([undefined, payload])
      expect(observedUserIds).toEqual([undefined, 'u1'])
    })

    it('returns inert loading state on server runtime', () => {
      withServerRuntime(() => {
        const scopeInServer = effectScope()
        let authX: any

        scopeInServer.run(() => {
          authX = db.useAuthX()
        })

        expect(authX.isLoading.value).toBe(true)
        expect(authX.user.value).toBeUndefined()
        expect(authX.state.isLoading).toBe(true)
        expect(authX.state.user).toBeUndefined()
        expect(mockCore.subscribeAuth).not.toHaveBeenCalled()

        scopeInServer.stop()
      })
    })
  })

  describe('useUser', () => {
    it('throws when user is unauthenticated in client runtime by default', () => {
      const scope = effectScope()
      let user: any

      scope.run(() => {
        user = db.useUser()
      })

      expect(() => user.value).toThrow(
        'useUser must be used within an auth-protected route',
      )

      scope.stop()
    })

    it('returns user when authenticated', async () => {
      let authCb: ((auth: any) => void) | undefined
      mockCore.subscribeAuth.mockImplementation((cb: any) => {
        authCb = cb
        return () => { }
      })

      const scope = effectScope()
      let user: any

      scope.run(() => {
        user = db.useUser()
      })

      authCb?.({ user: { id: 'u1', email: 'ok@test.com' } })
      await nextTick()

      expect(user.value).toEqual({ id: 'u1', email: 'ok@test.com' })
      scope.stop()
    })

    it('does not throw on server runtime when unauthenticated by default', () => {
      withServerRuntime(() => {
        const scopeInServer = effectScope()
        let user: any

        scopeInServer.run(() => {
          user = db.useUser()
        })

        expect(() => user.value).not.toThrow()
        expect(user.value).toBeUndefined()

        scopeInServer.stop()
      })
    })

    it('can disable throwing and return undefined via requireUser: no', () => {
      const scope = effectScope()
      let user: any

      scope.run(() => {
        user = db.useUser({ requireUser: 'no' })
      })

      expect(() => user.value).not.toThrow()
      expect(user.value).toBeUndefined()

      scope.stop()
    })

    it('can require user on all runtimes via requireUser: yes', () => {
      withServerRuntime(() => {
        const scopeInServer = effectScope()
        let user: any

        scopeInServer.run(() => {
          user = db.useUser({ requireUser: 'yes' })
        })

        expect(() => user.value).toThrow(
          'useUser must be used within an auth-protected route',
        )

        scopeInServer.stop()
      })
    })

    it('supports init-level useUser default override via constructor option', () => {
      const strictDb = new InstantVuxDatabase<any, false, any, 'yes'>(
        mockCore as any,
        { requireUserInUseUser: 'yes' },
      )

      withServerRuntime(() => {
        const scopeInServer = effectScope()
        let user: any

        scopeInServer.run(() => {
          user = strictDb.useUser()
        })

        expect(() => user.value).toThrow(
          'useUser must be used within an auth-protected route',
        )

        scopeInServer.stop()
      })
    })
  })

  describe('useUserX', () => {
    it('exposes refs plus state alias and follows default client-only strictness', () => {
      const scope = effectScope()
      let userXRefFirst: any

      scope.run(() => {
        userXRefFirst = db.useUserX()
      })

      expect(userXRefFirst.refs).toBe(userXRefFirst)
      expect(() => userXRefFirst.user.value).toThrow(
        'useUser must be used within an auth-protected route',
      )
      scope.stop()

      const stateScope = effectScope()
      let userXStateFirst: any
      stateScope.run(() => {
        userXStateFirst = db.useUserX()
      })
      expect(() => userXStateFirst.state.user).toThrow(
        'useUser must be used within an auth-protected route',
      )
      stateScope.stop()
    })

    it('returns user in refs/state when authenticated', async () => {
      let authCb: ((auth: any) => void) | undefined
      mockCore.subscribeAuth.mockImplementation((cb: any) => {
        authCb = cb
        return () => { }
      })

      const scope = effectScope()
      let userX: any

      scope.run(() => {
        userX = db.useUserX()
      })

      authCb?.({ user: { id: 'u1', email: 'ok@test.com' } })
      await nextTick()

      expect(userX.user.value).toEqual({ id: 'u1', email: 'ok@test.com' })
      expect(userX.state.user).toEqual({ id: 'u1', email: 'ok@test.com' })
      expect(userX.user.value).toBe(userX.state.user)

      scope.stop()
    })

    it('supports requireUser overrides consistently with useUser', () => {
      const scope = effectScope()
      let optionalUserX: any

      scope.run(() => {
        optionalUserX = db.useUserX({ requireUser: 'no' })
      })

      expect(() => optionalUserX.user.value).not.toThrow()
      expect(optionalUserX.user.value).toBeUndefined()
      expect(optionalUserX.state.user).toBeUndefined()

      scope.stop()

      withServerRuntime(() => {
        const scopeInServerRefFirst = effectScope()
        let strictUserXRefFirst: any

        scopeInServerRefFirst.run(() => {
          strictUserXRefFirst = db.useUserX({ requireUser: 'yes' })
        })

        expect(() => strictUserXRefFirst.user.value).toThrow(
          'useUser must be used within an auth-protected route',
        )
        scopeInServerRefFirst.stop()

        const scopeInServerStateFirst = effectScope()
        let strictUserXStateFirst: any

        scopeInServerStateFirst.run(() => {
          strictUserXStateFirst = db.useUserX({ requireUser: 'yes' })
        })

        expect(() => strictUserXStateFirst.state.user).toThrow(
          'useUser must be used within an auth-protected route',
        )
        scopeInServerStateFirst.stop()
      })
    })

    it('does not throw on server runtime by default', () => {
      withServerRuntime(() => {
        const scopeInServer = effectScope()
        let userX: any

        scopeInServer.run(() => {
          userX = db.useUserX()
        })

        expect(() => userX.user.value).not.toThrow()
        expect(userX.user.value).toBeUndefined()
        expect(userX.state.user).toBeUndefined()

        scopeInServer.stop()
      })
    })
  })

  describe('useConnectionStatus', () => {
    it('returns initial status', () => {
      const scope = effectScope()
      let status: any

      scope.run(() => {
        status = db.useConnectionStatus()
      })

      expect(isPiniaSetupStoreHydratable(status)).toBe(false)
      expect(status.value).toBe('connecting')
      scope.stop()
    })

    it('updates when connection status changes', async () => {
      let statusCb: ((status: ConnectionStatus) => void) | undefined
      mockCore.subscribeConnectionStatus.mockImplementation((cb: any) => {
        statusCb = cb
        return () => { }
      })

      const scope = effectScope()
      let status: any

      scope.run(() => {
        status = db.useConnectionStatus()
      })
      await nextTick()

      statusCb?.('authenticated')
      await nextTick()

      expect(status.value).toBe('authenticated')
      scope.stop()
    })

    it('returns fallback value and skips subscription on server runtime', () => {
      withServerRuntime(() => {
        const scopeInServer = effectScope()
        let status: any

        scopeInServer.run(() => {
          status = db.useConnectionStatus()
        })

        expect(status.value).toBe('connecting')
        expect(mockCore.subscribeConnectionStatus).not.toHaveBeenCalled()

        scopeInServer.stop()
      })
    })
  })

  describe('useConnectionStatusX', () => {
    it('exposes refs plus state alias', () => {
      const scope = effectScope()
      let statusX: any

      scope.run(() => {
        statusX = db.useConnectionStatusX()
      })

      expect(statusX.refs).toBe(statusX)
      expect(statusX.status.value).toBe('connecting')
      expect(statusX.state.status).toBe('connecting')

      scope.stop()
    })

    it('updates refs/state when connection status changes', async () => {
      let statusCb: ((status: ConnectionStatus) => void) | undefined
      mockCore.subscribeConnectionStatus.mockImplementation((cb: any) => {
        statusCb = cb
        return () => { }
      })

      const scope = effectScope()
      let statusX: any

      scope.run(() => {
        statusX = db.useConnectionStatusX()
      })
      await nextTick()

      statusCb?.('authenticated')
      await nextTick()

      expect(statusX.status.value).toBe('authenticated')
      expect(statusX.state.status).toBe('authenticated')

      scope.stop()
    })
  })

  describe('useLocalId', () => {
    it('starts as null', () => {
      const scope = effectScope()
      let localId: any

      scope.run(() => {
        localId = db.useLocalId('device')
      })

      expect(isPiniaSetupStoreHydratable(localId)).toBe(false)
      expect(localId.value).toBeNull()
      scope.stop()
    })

    it('loads the ID asynchronously', async () => {
      const scope = effectScope()
      let localId: any

      scope.run(() => {
        localId = db.useLocalId('device')
      })

      await vi.waitFor(() => {
        expect(localId.value).toBe('local-id-device')
      })

      scope.stop()
    })

    it('reloads when name ref changes', async () => {
      const scope = effectScope()
      const name = ref('device')
      let localId: any

      scope.run(() => {
        localId = db.useLocalId(name)
      })

      await vi.waitFor(() => {
        expect(localId.value).toBe('local-id-device')
      })

      name.value = 'session'

      await vi.waitFor(() => {
        expect(localId.value).toBe('local-id-session')
      })

      scope.stop()
    })

    it('does not update after scope disposal', async () => {
      let resolveLocalId: ((value: string) => void) | undefined
      mockCore.getLocalId.mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveLocalId = resolve
          }),
      )

      const scope = effectScope()
      let localId: any

      scope.run(() => {
        localId = db.useLocalId('device')
      })

      expect(localId.value).toBeNull()
      scope.stop()

      resolveLocalId?.('late-device-id')
      await nextTick()

      expect(localId.value).toBeNull()
    })

    it('returns null and skips local-id lookup on server runtime', () => {
      withServerRuntime(() => {
        const scopeInServer = effectScope()
        let localId: any

        scopeInServer.run(() => {
          localId = db.useLocalId('device')
        })

        expect(localId.value).toBeNull()
        expect(mockCore.getLocalId).not.toHaveBeenCalled()

        scopeInServer.stop()
      })
    })
  })

  describe('useLocalIdX', () => {
    it('exposes refs plus state alias and loads the ID', async () => {
      const scope = effectScope()
      let localIdX: any

      scope.run(() => {
        localIdX = db.useLocalIdX('device')
      })

      expect(localIdX.refs).toBe(localIdX)
      expect(localIdX.localId.value).toBeNull()
      expect(localIdX.state.localId).toBeNull()

      await vi.waitFor(() => {
        expect(localIdX.localId.value).toBe('local-id-device')
      })

      expect(localIdX.state.localId).toBe('local-id-device')
      scope.stop()
    })

    it('reloads when reactive name changes', async () => {
      const scope = effectScope()
      const name = ref('device')
      let localIdX: any

      scope.run(() => {
        localIdX = db.useLocalIdX(name)
      })

      await vi.waitFor(() => {
        expect(localIdX.state.localId).toBe('local-id-device')
      })

      name.value = 'session'

      await vi.waitFor(() => {
        expect(localIdX.localId.value).toBe('local-id-session')
      })

      expect(localIdX.state.localId).toBe('local-id-session')
      scope.stop()
    })
  })

  describe('room', () => {
    it('creates a room handle', () => {
      const room = db.room('chat' as any, 'room-1')
      expect(toValue(room.type)).toBe('chat')
      expect(toValue(room.id)).toBe('room-1')
      expect(isRef(room.type)).toBe(true)
      expect(isRef(room.id)).toBe(true)
      expect(room.core).toBe(mockCore)
      expect(isReactive(room)).toBe(false)

      const storeLike = reactive({ room })
      expect(storeLike.room).toBe(room)
      expect(isReactive(storeLike.room)).toBe(false)
    })

    it('defaults type and id when omitted', () => {
      const room = db.room()
      expect(toValue(room.type)).toBe('_defaultRoomType')
      expect(toValue(room.id)).toBe('_defaultRoomId')
    })

    it('accepts reactive room inputs', async () => {
      const roomType = ref('chat' as any)
      const roomId = ref('room-1')
      const room = db.room(roomType, roomId)

      expect(toValue(room.type)).toBe('chat')
      expect(toValue(room.id)).toBe('room-1')

      roomType.value = 'group'
      roomId.value = 'room-2'
      await nextTick()

      expect(toValue(room.type)).toBe('group')
      expect(toValue(room.id)).toBe('room-2')
    })
  })
})
