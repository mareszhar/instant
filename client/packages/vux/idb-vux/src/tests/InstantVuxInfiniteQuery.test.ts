import type { ConnectionStatus } from '@instantdb/core'
import type { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { InstantVuxDatabase } from '../InstantVuxDatabase.js'

function createMockCore() {
  return {
    _reactor: {
      status: 'connecting' as ConnectionStatus,
      querySubs: {
        updateInPlace: vi.fn(),
      },
      kv: {
        updateInPlace: vi.fn(),
      },
      getPreviousResult: vi.fn((): Record<string, unknown> | null => null),
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
    getLocalId: vi.fn((name: string) => Promise.resolve(`local-id-${name}`)),
    transact: vi.fn(() => Promise.resolve({ status: 'synced' })),
    getAuth: vi.fn(() => Promise.resolve(null)),
    queryOnce: vi.fn(() => Promise.resolve({ data: {}, pageInfo: {} })),
    subscribeQuery: vi.fn((_query: any, _cb: (result: any) => void) => () => { }),
    subscribeInfiniteQuery: vi.fn((_query: any, _cb: (result: any) => void) => ({
      unsubscribe: vi.fn(),
      loadNextPage: vi.fn(),
    })),
    subscribeAuth: vi.fn((_cb: (auth: any) => void) => () => { }),
    subscribeConnectionStatus: vi.fn(
      (_cb: (status: ConnectionStatus) => void) => () => { },
    ),
  }
}

describe('instantVuxDatabase.useInfiniteQuery', () => {
  let mockCore: ReturnType<typeof createMockCore>
  let db: InstantVuxDatabase<any>
  let scope: EffectScope
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
    scope = effectScope()
    originalWindow = (globalThis as any).window
  })

  afterEach(() => {
    scope.stop()
    vi.stubGlobal('window', originalWindow)
  })

  it('starts in loading state', async () => {
    let infiniteQuery: any

    scope.run(() => {
      infiniteQuery = db.useInfiniteQuery({ posts: { $: { limit: 2 } } } as any)
    })
    await nextTick()

    expect(infiniteQuery.isLoading.value).toBe(true)
    expect(infiniteQuery.data.value).toBeUndefined()
    expect(infiniteQuery.error.value).toBeUndefined()
    expect(infiniteQuery.canLoadNextPage.value).toBe(false)
    expect(typeof infiniteQuery.loadNextPage).toBe('function')
  })

  it('bootstraps from cached snapshot before subscription emits', async () => {
    mockCore._reactor.getPreviousResult.mockReturnValue({
      data: { posts: [{ id: 'p1', title: 'cached' }] },
      pageInfo: {},
    })

    let infiniteQuery: any
    scope.run(() => {
      infiniteQuery = db.useInfiniteQuery({
        posts: {
          $: {
            limit: 20,
            order: { createdAt: 'desc' },
          },
        },
      } as any)
    })
    await nextTick()

    expect(infiniteQuery.isLoading.value).toBe(false)
    expect(infiniteQuery.data.value).toEqual({ posts: [{ id: 'p1', title: 'cached' }] })
    expect(infiniteQuery.error.value).toBeUndefined()
    expect(infiniteQuery.canLoadNextPage.value).toBe(false)
  })

  it('subscribes and updates state from callback', async () => {
    let cb: ((result: any) => void) | undefined
    mockCore.subscribeInfiniteQuery.mockImplementation((_query: any, callback: any) => {
      cb = callback
      return {
        unsubscribe: vi.fn(),
        loadNextPage: vi.fn(),
      }
    })

    let infiniteQuery: any
    scope.run(() => {
      infiniteQuery = db.useInfiniteQuery({ posts: { $: { limit: 2 } } } as any)
    })
    await nextTick()

    expect(mockCore.subscribeInfiniteQuery).toHaveBeenCalledTimes(1)

    cb?.({
      error: undefined,
      data: { posts: [{ id: 'p2', title: 'live' }] },
      canLoadNextPage: true,
    })
    await nextTick()

    expect(infiniteQuery.isLoading.value).toBe(false)
    expect(infiniteQuery.data.value).toEqual({ posts: [{ id: 'p2', title: 'live' }] })
    expect(infiniteQuery.canLoadNextPage.value).toBe(true)
    expect(infiniteQuery.error.value).toBeUndefined()
  })

  it('supports reactive destructuring for parity-style infinite query usage', async () => {
    let cb: ((result: any) => void) | undefined
    const loadNextPage = vi.fn()
    mockCore.subscribeInfiniteQuery.mockImplementation((_query: any, callback: any) => {
      cb = callback
      return {
        unsubscribe: vi.fn(),
        loadNextPage,
      }
    })

    let isLoading: any
    let error: any
    let data: any
    let canLoadNextPage: any
    let loadNextPageFn: any

    scope.run(() => {
      ({ isLoading, error, data, canLoadNextPage, loadNextPage: loadNextPageFn } = db.useInfiniteQuery({
        posts: {
          $: {
            limit: 2,
          },
        },
      } as any))
    })
    await nextTick()

    expect(isLoading.value).toBe(true)
    expect(data.value).toBeUndefined()
    expect(canLoadNextPage.value).toBe(false)
    expect(error.value).toBeUndefined()

    loadNextPageFn()
    expect(loadNextPage).toHaveBeenCalledTimes(1)

    cb?.({
      error: undefined,
      data: { posts: [{ id: 'p2', title: 'Destructured infinite' }] },
      canLoadNextPage: true,
    })
    await nextTick()

    expect(isLoading.value).toBe(false)
    expect(data.value).toEqual({ posts: [{ id: 'p2', title: 'Destructured infinite' }] })
    expect(canLoadNextPage.value).toBe(true)
    expect(error.value).toBeUndefined()
  })

  it('accepts ref/query and ref/opts inputs', async () => {
    const queryRef = ref<any>({
      posts: {
        $: {
          limit: 2,
        },
      },
    })
    const optsRef = ref<any>({ ruleParams: { tenant: 'a' } })

    scope.run(() => {
      db.useInfiniteQuery(queryRef, optsRef)
    })
    await nextTick()

    expect(mockCore.subscribeInfiniteQuery).toHaveBeenCalledTimes(1)

    queryRef.value = {
      posts: {
        $: {
          limit: 3,
        },
      },
    }
    await nextTick()
    expect(mockCore.subscribeInfiniteQuery).toHaveBeenCalledTimes(2)

    optsRef.value = { ruleParams: { tenant: 'b' } }
    await nextTick()
    expect(mockCore.subscribeInfiniteQuery).toHaveBeenCalledTimes(3)
  })

  it('forwards loadNextPage to active subscription', async () => {
    const loadNextPage = vi.fn()
    mockCore.subscribeInfiniteQuery.mockImplementation(() => ({
      unsubscribe: vi.fn(),
      loadNextPage,
    }))

    let infiniteQuery: any
    scope.run(() => {
      infiniteQuery = db.useInfiniteQuery({ posts: { $: { limit: 2 } } } as any)
    })
    await nextTick()

    infiniteQuery.loadNextPage()
    expect(loadNextPage).toHaveBeenCalledTimes(1)
  })

  it('resubscribes when a function query changes and resets interim state', async () => {
    const callbacks: ((result: any) => void)[] = []
    const subs: Array<{ unsubscribe: ReturnType<typeof vi.fn>, loadNextPage: ReturnType<typeof vi.fn> }> = []

    mockCore.subscribeInfiniteQuery.mockImplementation((_query: any, callback: any) => {
      callbacks.push(callback)
      const sub = {
        unsubscribe: vi.fn(),
        loadNextPage: vi.fn(),
      }
      subs.push(sub)
      return sub
    })

    const filter = ref<'done' | 'pending'>('pending')
    let infiniteQuery: any

    scope.run(() => {
      infiniteQuery = db.useInfiniteQuery(() => ({
        posts: {
          $: {
            where: {
              status: filter.value,
            },
            limit: 5,
          },
        },
      }) as any)
    })
    await nextTick()

    callbacks[0]?.({
      error: undefined,
      data: { posts: [{ id: 'p1', status: 'pending' }] },
      canLoadNextPage: true,
    })
    await nextTick()
    expect(infiniteQuery.data.value).toEqual({ posts: [{ id: 'p1', status: 'pending' }] })

    filter.value = 'done'
    await nextTick()

    expect(subs[0]?.unsubscribe).toHaveBeenCalled()
    expect(mockCore.subscribeInfiniteQuery).toHaveBeenCalledTimes(2)
    expect(infiniteQuery.isLoading.value).toBe(true)
    expect(infiniteQuery.data.value).toBeUndefined()
    expect(infiniteQuery.canLoadNextPage.value).toBe(false)
  })

  it('skips subscription when query resolves to null', async () => {
    let infiniteQuery: any

    scope.run(() => {
      infiniteQuery = db.useInfiniteQuery(() => null)
    })
    await nextTick()

    expect(mockCore.subscribeInfiniteQuery).not.toHaveBeenCalled()
    expect(infiniteQuery.isLoading.value).toBe(true)
    expect(infiniteQuery.data.value).toBeUndefined()
  })

  it('unsubscribes on scope dispose', async () => {
    const unsubscribe = vi.fn()
    mockCore.subscribeInfiniteQuery.mockImplementation(() => ({
      unsubscribe,
      loadNextPage: vi.fn(),
    }))

    scope.run(() => {
      db.useInfiniteQuery({ posts: { $: { limit: 2 } } } as any)
    })
    await nextTick()

    scope.stop()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('returns inert no-op state on server runtime', () => {
    withServerRuntime(() => {
      const scopeInServer = effectScope()
      let infiniteQuery: any

      scopeInServer.run(() => {
        infiniteQuery = db.useInfiniteQuery({ posts: { $: { limit: 2 } } } as any)
      })

      infiniteQuery.loadNextPage()
      expect(infiniteQuery.isLoading.value).toBe(true)
      expect(infiniteQuery.data.value).toBeUndefined()
      expect(mockCore.subscribeInfiniteQuery).not.toHaveBeenCalled()

      scopeInServer.stop()
    })
  })

  it('throws for invalid multi-entity infinite query shape', () => {
    expect(() => {
      scope.run(() => {
        db.useInfiniteQuery({
          posts: {},
          comments: {},
        } as any)
      })
    }).toThrow()
  })
})

describe('instantVuxDatabase.useInfiniteQueryX', () => {
  let mockCore: ReturnType<typeof createMockCore>
  let db: InstantVuxDatabase<any>
  let scope: EffectScope
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
    scope = effectScope()
    originalWindow = (globalThis as any).window
  })

  afterEach(() => {
    scope.stop()
    vi.stubGlobal('window', originalWindow)
  })

  it('exposes refs/state and defaults namespaces to empty arrays', async () => {
    let infiniteQuery: any
    scope.run(() => {
      infiniteQuery = db.useInfiniteQueryX({
        posts: {
          $: {
            limit: 2,
          },
        },
      } as any)
    })
    await nextTick()

    expect(infiniteQuery.refs).toBe(infiniteQuery)
    expect(infiniteQuery.isLoading.value).toBe(true)
    expect(infiniteQuery.canLoadNextPage.value).toBe(false)
    expect(infiniteQuery.posts.value).toEqual([])
    expect(infiniteQuery.state.posts).toEqual([])
    expect(infiniteQuery.state.data).toBeUndefined()

    const spreadRefs = { ...infiniteQuery.refs }
    expect(Object.keys(spreadRefs)).toContain('posts')
    expect(spreadRefs.posts.value).toEqual([])
  })

  it('updates namespace refs/state when infinite results arrive', async () => {
    let cb: ((result: any) => void) | undefined
    mockCore.subscribeInfiniteQuery.mockImplementation((_query: any, callback: any) => {
      cb = callback
      return {
        unsubscribe: vi.fn(),
        loadNextPage: vi.fn(),
      }
    })

    let infiniteQuery: any
    scope.run(() => {
      infiniteQuery = db.useInfiniteQueryX({
        posts: {
          $: {
            limit: 2,
          },
        },
      } as any)
    })
    await nextTick()

    const payload = {
      posts: [{ id: 'p2', title: 'live' }],
    }

    cb?.({
      error: undefined,
      data: payload,
      canLoadNextPage: true,
    })
    await nextTick()

    expect(infiniteQuery.isLoading.value).toBe(false)
    expect(infiniteQuery.state.isLoading).toBe(false)
    expect(infiniteQuery.canLoadNextPage.value).toBe(true)
    expect(infiniteQuery.state.canLoadNextPage).toBe(true)
    expect(infiniteQuery.posts.value).toEqual([{ id: 'p2', title: 'live' }])
    expect(infiniteQuery.state.posts).toEqual([{ id: 'p2', title: 'live' }])
    expect(infiniteQuery.data.value).toEqual(payload)
    expect(infiniteQuery.state.data).toEqual(payload)
    expect(infiniteQuery.data.value).toBe(infiniteQuery.state.data)
    expect(infiniteQuery.posts.value).toBe(infiniteQuery.state.posts)
  })

  it('passes loadNextPage through and keeps callable from refs/state', async () => {
    const loadNextPage = vi.fn()
    mockCore.subscribeInfiniteQuery.mockImplementation(() => ({
      unsubscribe: vi.fn(),
      loadNextPage,
    }))

    let infiniteQuery: any
    scope.run(() => {
      infiniteQuery = db.useInfiniteQueryX({
        posts: {
          $: {
            limit: 2,
          },
        },
      } as any)
    })
    await nextTick()

    infiniteQuery.loadNextPage()
    infiniteQuery.refs.loadNextPage()
    infiniteQuery.state.loadNextPage()

    expect(loadNextPage).toHaveBeenCalledTimes(3)
  })

  it('keeps null-skip behavior aligned with useInfiniteQuery', async () => {
    let infiniteQuery: any
    scope.run(() => {
      infiniteQuery = db.useInfiniteQueryX(() => null)
    })
    await nextTick()

    expect(mockCore.subscribeInfiniteQuery).not.toHaveBeenCalled()
    expect(infiniteQuery.isLoading.value).toBe(true)
    expect(infiniteQuery.canLoadNextPage.value).toBe(false)
    expect(infiniteQuery.data.value).toBeUndefined()
    expect(infiniteQuery.posts.value).toEqual([])
    expect(infiniteQuery.state.posts).toEqual([])
  })

  it('resubscribes when reactive dependencies change in factory queries', async () => {
    const callbacks: ((result: any) => void)[] = []
    const subs: Array<{ unsubscribe: ReturnType<typeof vi.fn>, loadNextPage: ReturnType<typeof vi.fn> }> = []

    mockCore.subscribeInfiniteQuery.mockImplementation((_query: any, callback: any) => {
      callbacks.push(callback)
      const sub = {
        unsubscribe: vi.fn(),
        loadNextPage: vi.fn(),
      }
      subs.push(sub)
      return sub
    })

    const statusFilter = ref<'pending' | 'done' | null>(null)
    let infiniteQuery: any

    scope.run(() => {
      infiniteQuery = db.useInfiniteQueryX(() => {
        if (!statusFilter.value)
          return null

        return {
          posts: {
            $: {
              where: {
                status: statusFilter.value,
              },
              limit: 5,
            },
          },
        }
      })
    })
    await nextTick()

    expect(mockCore.subscribeInfiniteQuery).not.toHaveBeenCalled()
    expect(infiniteQuery.posts.value).toEqual([])

    statusFilter.value = 'pending'
    await nextTick()

    expect(mockCore.subscribeInfiniteQuery).toHaveBeenCalledTimes(1)

    callbacks[0]?.({
      error: undefined,
      data: { posts: [{ id: 'p1', status: 'pending' }] },
      canLoadNextPage: true,
    })
    await nextTick()
    expect(infiniteQuery.posts.value).toEqual([{ id: 'p1', status: 'pending' }])
    expect(infiniteQuery.canLoadNextPage.value).toBe(true)

    statusFilter.value = 'done'
    await nextTick()

    expect(mockCore.subscribeInfiniteQuery).toHaveBeenCalledTimes(2)
    expect(subs[0]?.unsubscribe).toHaveBeenCalled()
    expect(infiniteQuery.isLoading.value).toBe(true)
    expect(infiniteQuery.posts.value).toEqual([])
    expect(infiniteQuery.canLoadNextPage.value).toBe(false)
  })

  it('returns inert no-op state on server runtime', () => {
    withServerRuntime(() => {
      const scopeInServer = effectScope()
      let infiniteQuery: any

      scopeInServer.run(() => {
        infiniteQuery = db.useInfiniteQueryX({
          posts: {
            $: {
              limit: 2,
            },
          },
        } as any)
      })

      infiniteQuery.loadNextPage()
      expect(infiniteQuery.isLoading.value).toBe(true)
      expect(infiniteQuery.data.value).toBeUndefined()
      expect(infiniteQuery.posts.value).toEqual([])
      expect(mockCore.subscribeInfiniteQuery).not.toHaveBeenCalled()

      scopeInServer.stop()
    })
  })
})
