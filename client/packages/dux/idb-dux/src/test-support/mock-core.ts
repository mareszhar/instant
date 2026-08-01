/**
 * A mock core db for overlay tests — the reactor surface the baseline calls,
 * with hooks to drive query/auth/status emissions. Framework-agnostic (no
 * Vue, no reactor internals), so it lives in `test-support`.
 */
import { vi } from 'vitest'

export function createMockCore(initial?: {
  status?: string
  appStatus?: { isLoading: boolean, isReadOnly: boolean | undefined }
  currentUser?: { isLoading: boolean, user: any, error: any } | null
}) {
  let queryCb: ((r: any) => void) | null = null
  let authCb: ((a: any) => void) | null = null
  let statusCb: ((s: any) => void) | null = null
  let appStatusCb: ((s: any) => void) | null = null
  let previousResult: any = null
  const initialAppStatus = initial?.appStatus ?? {
    isLoading: true,
    isReadOnly: undefined,
  }

  const core: any = {
    _reactor: {
      status: initial?.status ?? 'connecting',
      _appStatusState: initialAppStatus,
      _currentUserCached: initial?.currentUser ?? null,
      getPreviousResult: vi.fn(() => previousResult),
      getPresence: vi.fn(() => null),
      subscribeTopic: vi.fn(() => vi.fn()),
      subscribePresence: vi.fn(() => vi.fn()),
      joinRoom: vi.fn(() => vi.fn()),
      publishPresence: vi.fn(),
      publishTopic: vi.fn(),
    },
    auth: {},
    storage: {},
    streams: {},
    getLocalId: vi.fn((name: string) => Promise.resolve(`local-id-${name}`)),
    transact: vi.fn(() => Promise.resolve({ status: 'synced' })),
    getAuth: vi.fn(() => Promise.resolve(null)),
    queryOnce: vi.fn((..._args: any[]) => Promise.resolve({ data: {}, pageInfo: {} })),
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
    subscribeAppStatus: vi.fn((cb: (s: any) => void) => {
      appStatusCb = cb
      cb(initialAppStatus)
      return () => {}
    }),
  }

  return {
    core,
    setPreviousResult: (r: any) => (previousResult = r),
    emitQuery: (r: any) => queryCb?.(r),
    emitAuth: (a: any) => authCb?.(a),
    emitStatus: (s: any) => statusCb?.(s),
    emitAppStatus: (s: any) => appStatusCb?.(s),
  }
}
