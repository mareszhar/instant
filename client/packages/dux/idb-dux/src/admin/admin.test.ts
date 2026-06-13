/**
 * Runtime plane for `/admin`: the data plane is shaped through the same
 * `shapeResult` the client uses (parity with the client fixtures), the
 * subscription shapes every emission on both the callback and async-iterator
 * paths, tx/debug/asUser/webhooks wire to their official verbs, and `asUser`
 * keeps every treatment intact.
 *
 * The official network mechanics are `@instantdb/admin`'s tests; here a mock
 * official db stands in so the wiring and shaping are exercised without fetch.
 */
import type { AppSchema } from '@test'
import { ids, schema } from '@test'
import { describe, expect, it, vi } from 'vitest'
import { $only } from '../query/index.js'
import { IdbAdminClient, init } from './init.js'

function makeSub(payloads: any[]) {
  let closed = false
  return {
    close: vi.fn(() => {
      closed = true
    }),
    [Symbol.iterator]() {
      throw new Error('sync iteration not supported')
    },
    async* [Symbol.asyncIterator]() {
      for (const p of payloads) yield p
    },
    get readyState() {
      return closed ? 'closed' : 'open'
    },
    get isClosed() {
      return closed
    },
    sessionInfo: null,
  }
}

function makeOfficial(overrides: Record<string, any> = {}) {
  return {
    config: { appId: 'a-app', adminToken: 'a-tok', apiURI: 'https://api.instantdb.com', schema },
    query: vi.fn(async (..._a: any[]) => ({ workspaces: [{ id: ids.workspaceAlpha, name: 'Alpha' }] })),
    subscribeQuery: vi.fn((..._a: any[]) => makeSub([])),
    transact: vi.fn(async (..._a: any[]) => ({ 'tx-id': 1 })),
    debugQuery: vi.fn(async (..._a: any[]) => ({
      result: { workspaces: [{ id: ids.workspaceAlpha, name: 'Alpha' }] },
      checkResults: [{ id: ids.workspaceAlpha, entity: 'workspaces', record: {}, check: true }],
    })),
    debugTransact: vi.fn(async () => ({ 'tx-id': 1, 'all-checks-ok?': true })),
    asUser: vi.fn(() => makeOfficial(overrides)),
    auth: { verifyToken: vi.fn() },
    storage: {},
    streams: {},
    rooms: {},
    ...overrides,
  }
}

function makeAdminDb(overrides?: Record<string, any>) {
  const official = makeOfficial(overrides)
  const adminDb = new IdbAdminClient<AppSchema>(official as any, schema)
  return { adminDb, official }
}

describe('admin query — shaped data plane', () => {
  it('normalizes top-level scopes to arrays', async () => {
    const { adminDb } = makeAdminDb()
    const { workspaces } = await adminDb.query({ workspaces: {} })
    expect(workspaces).toEqual([{ id: ids.workspaceAlpha, name: 'Alpha' }])
  })

  it('applies $only and singularizes the scope key (parity with the client)', async () => {
    const { adminDb } = makeAdminDb()
    const { workspace } = await adminDb.query({ workspaces: { $: { $only } } })
    expect(workspace).toEqual({ id: ids.workspaceAlpha, name: 'Alpha' })
  })

  it('strips dux-only keys before the query reaches the official db', async () => {
    const { adminDb, official } = makeAdminDb()
    await adminDb.query({ workspaces: { $: { $only, where: { name: 'Alpha' } } } })
    const sent = official.query.mock.calls[0]![0]
    expect(sent).toEqual({ workspaces: { $: { where: { name: 'Alpha' } } } })
  })

  it('forwards typed ruleParams opts', async () => {
    const { adminDb, official } = makeAdminDb()
    await adminDb.query({ workspaces: {} }, { ruleParams: { inviteCode: 'abc' } })
    expect(official.query.mock.calls[0]![1]).toEqual({ ruleParams: { inviteCode: 'abc' } })
  })
})

describe('admin subscribeQuery — shaped per emission', () => {
  it('shapes the payload delivered to the callback', async () => {
    let captured: ((p: any) => void) | undefined
    const { adminDb } = makeAdminDb({
      subscribeQuery: vi.fn((_q: any, cb: any) => {
        captured = cb
        return makeSub([])
      }),
    })
    const seen: any[] = []
    adminDb.subscribeQuery({ workspaces: { $: { $only } } }, p => seen.push(p))
    captured!({ type: 'ok', data: { workspaces: [{ id: ids.workspaceAlpha, name: 'Alpha' }] }, pageInfo: undefined, sessionInfo: null })
    expect(seen[0]).toEqual({
      type: 'ok',
      data: { workspace: { id: ids.workspaceAlpha, name: 'Alpha' } },
      pageInfo: undefined,
      sessionInfo: null,
    })
  })

  it('shapes each payload on the async-iterator path', async () => {
    const payload = { type: 'ok', data: { workspaces: [{ id: ids.workspaceAlpha, name: 'Alpha' }] }, pageInfo: undefined, sessionInfo: null }
    const { adminDb } = makeAdminDb({ subscribeQuery: vi.fn(() => makeSub([payload])) })
    const sub = adminDb.subscribeQuery({ workspaces: { $: { $only } } })
    const out: any[] = []
    for await (const p of sub) out.push(p)
    expect(out[0]!.data).toEqual({ workspace: { id: ids.workspaceAlpha, name: 'Alpha' } })
  })

  it('passes the error arm through untouched', async () => {
    let captured: ((p: any) => void) | undefined
    const { adminDb } = makeAdminDb({
      subscribeQuery: vi.fn((_q: any, cb: any) => {
        captured = cb
        return makeSub([])
      }),
    })
    const seen: any[] = []
    adminDb.subscribeQuery({ workspaces: {} }, p => seen.push(p))
    const errorPayload = { type: 'error', error: new Error('boom'), readyState: 'closed', isClosed: true, sessionInfo: null }
    captured!(errorPayload)
    expect(seen[0]).toBe(errorPayload)
  })

  it('delegates close/readyState/isClosed to the official handle', () => {
    const inner = makeSub([])
    const { adminDb } = makeAdminDb({ subscribeQuery: vi.fn(() => inner) })
    const sub = adminDb.subscribeQuery({ workspaces: {} })
    expect(sub.readyState).toBe('open')
    sub.close()
    expect(inner.close).toHaveBeenCalledTimes(1)
    expect(sub.isClosed).toBe(true)
  })
})

describe('admin tx + debug', () => {
  it('transact delegates to the official db', async () => {
    const { adminDb, official } = makeAdminDb()
    const chunk = adminDb.tx.tasks[ids.taskOne]!.update({ title: 'a' })
    await adminDb.transact(chunk)
    expect(official.transact).toHaveBeenCalledTimes(1)
  })

  it('debugQuery shapes the result and returns the check results', async () => {
    const { adminDb } = makeAdminDb()
    const { result, checkResults } = await adminDb.debugQuery({ workspaces: { $: { $only } } })
    expect(result).toEqual({ workspace: { id: ids.workspaceAlpha, name: 'Alpha' } })
    expect(checkResults[0]!.check).toBe(true)
  })

  it('debugTransact passes through to the official db', async () => {
    const { adminDb, official } = makeAdminDb()
    const chunk = adminDb.tx.tasks[ids.taskOne]!.update({ title: 'a' })
    const res = await adminDb.debugTransact(chunk)
    expect(official.debugTransact).toHaveBeenCalledTimes(1)
    expect(res['all-checks-ok?']).toBe(true)
  })
})

describe('admin asUser + pass-throughs', () => {
  it('asUser returns a dux admin db that still shapes', async () => {
    const { adminDb } = makeAdminDb()
    const scoped = adminDb.asUser({ guest: true })
    expect(scoped).toBeInstanceOf(IdbAdminClient)
    const { workspace } = await scoped.query({ workspaces: { $: { $only } } })
    expect(workspace).toEqual({ id: ids.workspaceAlpha, name: 'Alpha' })
  })

  it('exposes the official pass-through surfaces', () => {
    const { adminDb, official } = makeAdminDb()
    expect(adminDb.auth).toBe(official.auth)
    expect(adminDb.storage).toBe(official.storage)
    expect(adminDb.streams).toBe(official.streams)
    expect(adminDb.rooms).toBe(official.rooms)
  })
})

describe('admin webhooks — token-wired', () => {
  it('exposes the /webhooks surface (pipeline + manager)', () => {
    const { adminDb } = makeAdminDb()
    const wh = adminDb.webhooks
    expect(typeof wh.verify).toBe('function')
    expect(typeof wh.process).toBe('function')
    expect(typeof wh.manager.create).toBe('function')
  })

  it('memoizes the webhooks handle', () => {
    const { adminDb } = makeAdminDb()
    expect(adminDb.webhooks).toBe(adminDb.webhooks)
  })
})

describe('admin init — construction', () => {
  it('builds an IdbAdminClient with a typed tx chain', () => {
    const adminDb = init<AppSchema>({
      appId: '00000000-0000-0000-0000-000000000000',
      adminToken: 'tok',
      schema,
    })
    expect(adminDb).toBeInstanceOf(IdbAdminClient)
    expect(typeof adminDb.tx.tasks[ids.taskOne]!.update).toBe('function')
  })
})
