// @vitest-environment jsdom
/**
 * The parity harness (dux-spec-workspace.md §4.5): canonical reactive
 * scenarios replayed against **both** the official `@instantdb/vue` db and
 * the internal baseline, asserting identical reactive output. "Additive,
 * never divergent" as a failing test instead of a promise — the only
 * permitted divergences are the fenced deltas (SSR guards, fired here on the
 * client path where official and baseline must agree).
 */
import { InstantVueDatabase } from '@instantdb/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { IdbDuxDatabase } from './IdbDuxDatabase.js'

function createMockCore() {
  let queryCb: ((r: any) => void) | null = null
  let authCb: ((a: any) => void) | null = null
  let statusCb: ((s: any) => void) | null = null
  const core = {
    _reactor: {
      status: 'connecting',
      _currentUserCached: null as any,
      getPreviousResult: vi.fn(() => null),
      getPresence: vi.fn(() => null),
      subscribeTopic: vi.fn(() => vi.fn()),
      subscribePresence: vi.fn(() => vi.fn()),
      joinRoom: vi.fn(() => vi.fn()),
      publishPresence: vi.fn(),
      publishTopic: vi.fn(),
    },
    getLocalId: vi.fn((name: string) => Promise.resolve(`local-id-${name}`)),
    transact: vi.fn(() => Promise.resolve({ status: 'synced' })),
    getAuth: vi.fn(() => Promise.resolve(null)),
    queryOnce: vi.fn(() => Promise.resolve({ data: {}, pageInfo: {} })),
    auth: {},
    storage: {},
    streams: {},
    subscribeQuery: vi.fn((_q: any, cb: (r: any) => void) => {
      queryCb = cb
      return () => {}
    }),
    subscribeAuth: vi.fn((cb: (a: any) => void) => {
      authCb = cb
      return () => {}
    }),
    subscribeConnectionStatus: vi.fn((cb: (s: any) => void) => {
      statusCb = cb
      return () => {}
    }),
  }
  return {
    core,
    emitQuery: (r: any) => queryCb?.(r),
    emitAuth: (a: any) => authCb?.(a),
    emitStatus: (s: any) => statusCb?.(s),
  }
}

function withScope<T>(fn: () => T): { result: T, cleanup: () => void } {
  const scope = effectScope()
  const result = scope.run(fn) as T
  return { result, cleanup: () => scope.stop() }
}

/** Build matched official + baseline dbs over independent identical mocks. */
function pair() {
  const official = createMockCore()
  const baseline = createMockCore()
  return {
    official: { db: new InstantVueDatabase(official.core as any), mock: official },
    baseline: { db: new IdbDuxDatabase(baseline.core as any), mock: baseline },
  }
}

describe('baseline parity — useQuery', () => {
  let p: ReturnType<typeof pair>
  beforeEach(() => p = pair())

  it('starts in the same loading state', () => {
    const o = withScope(() => p.official.db.useQuery({ tasks: {} } as any))
    const b = withScope(() => p.baseline.db.useQuery({ tasks: {} } as any))
    expect(b.result.isLoading.value).toBe(o.result.isLoading.value)
    expect(b.result.data.value).toEqual(o.result.data.value)
    expect(b.result.error.value).toEqual(o.result.error.value)
    o.cleanup()
    b.cleanup()
  })

  it('emits identical data on a query result', async () => {
    const o = withScope(() => p.official.db.useQuery({ tasks: {} } as any))
    const b = withScope(() => p.baseline.db.useQuery({ tasks: {} } as any))
    const payload = { data: { tasks: [{ id: 't1' }] }, pageInfo: {}, error: undefined }
    p.official.mock.emitQuery(payload)
    p.baseline.mock.emitQuery(payload)
    await nextTick()
    expect(b.result.isLoading.value).toBe(o.result.isLoading.value)
    expect(b.result.data.value).toEqual(o.result.data.value)
    o.cleanup()
    b.cleanup()
  })

  it('pauses identically on a null query', () => {
    const o = withScope(() => p.official.db.useQuery(null as any))
    const b = withScope(() => p.baseline.db.useQuery(null as any))
    expect(p.baseline.mock.core.subscribeQuery).toHaveBeenCalledTimes(
      p.official.mock.core.subscribeQuery.mock.calls.length,
    )
    o.cleanup()
    b.cleanup()
  })
})

describe('baseline parity — useAuth', () => {
  let p: ReturnType<typeof pair>
  beforeEach(() => p = pair())

  it('starts and transitions identically', async () => {
    const o = withScope(() => p.official.db.useAuth())
    const b = withScope(() => p.baseline.db.useAuth())
    expect(b.result.isLoading.value).toBe(o.result.isLoading.value)

    const user = { id: 'u1', email: 'a@b.c' }
    p.official.mock.emitAuth({ user, error: undefined })
    p.baseline.mock.emitAuth({ user, error: undefined })
    await nextTick()
    expect(b.result.isLoading.value).toBe(o.result.isLoading.value)
    expect(b.result.user.value).toEqual(o.result.user.value)
    o.cleanup()
    b.cleanup()
  })
})

describe('baseline parity — connection status', () => {
  it('tracks status identically', async () => {
    const p = pair()
    const o = withScope(() => p.official.db.useConnectionStatus())
    const b = withScope(() => p.baseline.db.useConnectionStatus())
    expect(b.result.value).toBe(o.result.value)
    p.official.mock.emitStatus('connected')
    p.baseline.mock.emitStatus('connected')
    await nextTick()
    expect(b.result.value).toBe(o.result.value)
    o.cleanup()
    b.cleanup()
  })
})

describe('baseline parity — surface', () => {
  it('exposes the same public method names as the official db', () => {
    const p = pair()
    const names = (db: object) =>
      Object.getOwnPropertyNames(db)
        .filter(n => !n.startsWith('_') && n !== 'core')
        .sort()
    expect(names(p.baseline.db)).toEqual(names(p.official.db))
  })
})
