/**
 * Runtime plane for `/server`: the three cores exercised against a mock adapter,
 * framework-free. This is where the transport matrix (`tokenFrom`), the
 * mode-narrowed kit assembly with request-scoped caching, the auth-sync cookie
 * (and its overrides), and the webhook 2xx/4xx mapping are proven. Each adapter
 * then re-proves the same behavior through its real request lifecycle.
 */
import type { IdbDuxServerAdapter, IdbServerCookieOptions } from './index.js'
import { schema } from '@test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthSyncHandler } from './authSync.js'
import { createServerKit } from './serverKit.js'
import { createWebhookHandler } from './webhook.js'

const mocks = vi.hoisted(() => {
  const verifyToken = vi.fn()
  const scopedDb = { __scoped: true }
  const asUser = vi.fn(() => scopedDb)
  const adminDb = { auth: { verifyToken }, asUser, __admin: true }
  const adminInit = vi.fn(() => adminDb)
  const verify = vi.fn()
  const fetchPayload = vi.fn()
  const dispatch = vi.fn()
  const webhooks = { verify, fetchPayload, dispatch }
  const webhooksInit = vi.fn(() => webhooks)
  return { verifyToken, scopedDb, asUser, adminDb, adminInit, verify, fetchPayload, dispatch, webhooksInit }
})

vi.mock('../admin/index.js', () => ({ init: mocks.adminInit }))
vi.mock('../webhooks/index.js', () => ({ init: mocks.webhooksInit }))

/** A fake per-request object plus the adapter that drives the cores over it. */
interface MockCtx {
  cookies: Record<string, string>
  headers: Record<string, string>
  jsonBody: unknown
  jsonThrows: boolean
  rawText: string
  state: Record<string, unknown>
  status: number | undefined
  setCookies: Array<{ name: string, value: string, opts: IdbServerCookieOptions }>
  deleted: Array<{ name: string, opts: IdbServerCookieOptions }>
}

function makeCtx(init: Partial<MockCtx> = {}): MockCtx {
  return {
    cookies: {},
    headers: {},
    jsonBody: undefined,
    jsonThrows: false,
    rawText: '',
    state: {},
    status: undefined,
    setCookies: [],
    deleted: [],
    ...init,
  }
}

const adapter: IdbDuxServerAdapter<MockCtx> = {
  getCookie: (c, name) => c.cookies[name],
  getHeader: (c, name) => c.headers[name.toLowerCase()],
  readJsonBody: async (c) => {
    if (c.jsonThrows)
      throw new Error('bad json')
    return c.jsonBody as never
  },
  readRawText: async c => c.rawText,
  state: c => c.state,
  setCookie: (c, name, value, opts) => c.setCookies.push({ name, value, opts }),
  deleteCookie: (c, name, opts) => c.deleted.push({ name, opts }),
  setStatus: (c, code) => { c.status = code },
  httpError: (code, message) => Object.assign(new Error(message), { statusCode: code }),
}

const kitConfig = { schema, getAppId: () => 'app', getAdminToken: () => 'tok' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createServerKit — modes + caching', () => {
  it('no mode performs no auth work', async () => {
    const useKit = createServerKit(adapter, kitConfig)
    const { adminDb } = await useKit(makeCtx())
    expect(adminDb).toBe(mocks.adminDb)
    expect(mocks.verifyToken).not.toHaveBeenCalled()
  })

  it('user? verifies the token and resolves the user when present', async () => {
    mocks.verifyToken.mockResolvedValue({ id: 'u1' })
    const useKit = createServerKit(adapter, kitConfig)
    const { user } = await useKit(makeCtx({ cookies: { instant_token_app: 'rt' } }), 'user?')
    expect(user).toEqual({ id: 'u1' })
    expect(mocks.verifyToken).toHaveBeenCalledWith('rt')
  })

  it('user? leaves the user undefined when no token is present', async () => {
    const useKit = createServerKit(adapter, kitConfig)
    const { user } = await useKit(makeCtx(), 'user?')
    expect(user).toBeUndefined()
    expect(mocks.verifyToken).not.toHaveBeenCalled()
  })

  it('user throws 401 when auth is missing or invalid', async () => {
    const useKit = createServerKit(adapter, kitConfig)
    await expect(useKit(makeCtx(), 'user')).rejects.toMatchObject({ statusCode: 401 })
  })

  it('caches the verification across repeated kit calls in one request', async () => {
    mocks.verifyToken.mockResolvedValue({ id: 'u1' })
    const useKit = createServerKit(adapter, kitConfig)
    const ctx = makeCtx({ cookies: { instant_token_app: 'rt' } })
    await useKit(ctx, 'user?')
    await useKit(ctx, 'user')
    expect(mocks.verifyToken).toHaveBeenCalledTimes(1)
  })

  it('shares one verification across concurrent kit calls', async () => {
    mocks.verifyToken.mockResolvedValue({ id: 'u1' })
    const useKit = createServerKit(adapter, kitConfig)
    const ctx = makeCtx({ cookies: { instant_token_app: 'rt' } })
    await Promise.all([useKit(ctx, 'user?'), useKit(ctx, 'user?')])
    expect(mocks.verifyToken).toHaveBeenCalledTimes(1)
  })

  it('userDb scopes a per-request db via asUser({ token }) and caches it', async () => {
    mocks.verifyToken.mockResolvedValue({ id: 'u1' })
    const useKit = createServerKit(adapter, kitConfig)
    const ctx = makeCtx({ cookies: { instant_token_app: 'rt' } })
    const { userDb } = await useKit(ctx, 'userDb')
    await useKit(ctx, 'userDb')
    expect(userDb as unknown).toBe(mocks.scopedDb)
    expect(mocks.asUser).toHaveBeenCalledTimes(1)
    expect(mocks.asUser).toHaveBeenCalledWith({ token: 'rt' })
  })
})

describe('createServerKit — tokenFrom transports', () => {
  beforeEach(() => mocks.verifyToken.mockResolvedValue({ id: 'u1' }))

  it('\'cookie\' reads the token cookie, ignores bearer', async () => {
    const useKit = createServerKit(adapter, { ...kitConfig, tokenFrom: 'cookie' })
    await useKit(makeCtx({ headers: { authorization: 'Bearer hdr' }, cookies: { instant_token_app: 'ck' } }), 'user?')
    expect(mocks.verifyToken).toHaveBeenCalledWith('ck')
  })

  it('\'bearer\' reads Authorization, ignores the cookie', async () => {
    const useKit = createServerKit(adapter, { ...kitConfig, tokenFrom: 'bearer' })
    await useKit(makeCtx({ headers: { authorization: 'Bearer hdr' }, cookies: { instant_token_app: 'ck' } }), 'user?')
    expect(mocks.verifyToken).toHaveBeenCalledWith('hdr')
  })

  it('\'cookieOrBearer\' (default) prefers the cookie, falls back to bearer', async () => {
    const useKit = createServerKit(adapter, kitConfig)
    await useKit(makeCtx({ cookies: { instant_token_app: 'ck' } }), 'user?')
    expect(mocks.verifyToken).toHaveBeenLastCalledWith('ck')
    await useKit(makeCtx({ headers: { authorization: 'Bearer hdr' } }), 'user?')
    expect(mocks.verifyToken).toHaveBeenLastCalledWith('hdr')
  })

  it('{ cookieName } overrides the cookie name while keeping cookieOrBearer', async () => {
    const useKit = createServerKit(adapter, { ...kitConfig, tokenFrom: { cookieName: 'acme_session' } })
    await useKit(makeCtx({ cookies: { acme_session: 'ck', instant_token_app: 'nope' } }), 'user?')
    expect(mocks.verifyToken).toHaveBeenCalledWith('ck')
  })

  it('{ header } reads a custom header raw', async () => {
    const useKit = createServerKit(adapter, { ...kitConfig, tokenFrom: { header: 'x-acme-token' } })
    await useKit(makeCtx({ headers: { 'x-acme-token': 'raw' } }), 'user?')
    expect(mocks.verifyToken).toHaveBeenCalledWith('raw')
  })

  it('a custom resolver gets a reader with cookie/header/appId', async () => {
    const useKit = createServerKit(adapter, {
      ...kitConfig,
      tokenFrom: req => req.header('x-legacy') ?? req.cookie(`instant_token_${req.appId}`),
    })
    await useKit(makeCtx({ cookies: { instant_token_app: 'fallback' } }), 'user?')
    expect(mocks.verifyToken).toHaveBeenCalledWith('fallback')
  })
})

describe('createAuthSyncHandler — token-only cookie', () => {
  const syncBody = (user: unknown): unknown => ({ type: 'sync-user', appId: 'app', user })

  it('stores only the refresh token, with the default cookie attributes', async () => {
    const handler = createAuthSyncHandler(adapter, { getAppId: () => 'app' })
    const ctx = makeCtx({ jsonBody: syncBody({ refresh_token: 'rt-123', id: 'u1', email: 'a@b.c' }) })
    expect(await handler(ctx)).toEqual({ ok: true })
    expect(ctx.setCookies).toEqual([
      { name: 'instant_token_app', value: 'rt-123', opts: { path: '/', httpOnly: true, secure: true, sameSite: 'strict', maxAge: 604800 } },
    ])
    expect(ctx.deleted).toEqual([])
  })

  it('clears the cookie when the user is null', async () => {
    const handler = createAuthSyncHandler(adapter, { getAppId: () => 'app' })
    const ctx = makeCtx({ jsonBody: syncBody(null) })
    expect(await handler(ctx)).toEqual({ ok: true })
    expect(ctx.setCookies).toEqual([])
    expect(ctx.deleted).toEqual([{ name: 'instant_token_app', opts: expect.objectContaining({ path: '/' }) }])
  })

  it('honors cookieName and cookie-attribute overrides', async () => {
    const handler = createAuthSyncHandler(adapter, {
      getAppId: () => 'app',
      cookieName: 'acme_session',
      cookie: { sameSite: 'lax', domain: '.acme.com' },
    })
    const ctx = makeCtx({ jsonBody: syncBody({ refresh_token: 'rt' }) })
    await handler(ctx)
    expect(ctx.setCookies[0]).toMatchObject({
      name: 'acme_session',
      opts: { sameSite: 'lax', domain: '.acme.com', secure: true, httpOnly: true },
    })
  })

  it('persistToken takes over and skips the default cookie write', async () => {
    const persistToken = vi.fn()
    const handler = createAuthSyncHandler(adapter, { getAppId: () => 'app', persistToken })
    const ctx = makeCtx({ jsonBody: syncBody({ refresh_token: 'rt' }) })
    expect(await handler(ctx)).toEqual({ ok: true })
    expect(persistToken).toHaveBeenCalledWith('rt', ctx)
    expect(ctx.setCookies).toEqual([])
    expect(ctx.deleted).toEqual([])
  })

  it('rejects an app-id mismatch with 403', async () => {
    const handler = createAuthSyncHandler(adapter, { getAppId: () => 'app' })
    const ctx = makeCtx({ jsonBody: { type: 'sync-user', appId: 'other', user: null } })
    await handler(ctx)
    expect(ctx.status).toBe(403)
  })

  it('rejects a missing type with 400', async () => {
    const handler = createAuthSyncHandler(adapter, { getAppId: () => 'app' })
    const ctx = makeCtx({ jsonBody: { appId: 'app' } })
    await handler(ctx)
    expect(ctx.status).toBe(400)
  })

  it('rejects an unparseable body with 400', async () => {
    const handler = createAuthSyncHandler(adapter, { getAppId: () => 'app' })
    const ctx = makeCtx({ jsonThrows: true })
    expect(await handler(ctx)).toMatchObject({ ok: false })
    expect(ctx.status).toBe(400)
  })
})

describe('createWebhookHandler — verify → fetch → dispatch', () => {
  const handlers = { tasks: { create: vi.fn() } } as never

  it('answers ok and dispatches the fetched payload', async () => {
    mocks.verify.mockResolvedValue({ payloadUrl: 'u', token: 't' })
    mocks.fetchPayload.mockResolvedValue({ data: [], idempotencyKey: 'k' })
    mocks.dispatch.mockResolvedValue(undefined)
    const handler = createWebhookHandler(adapter, handlers)
    const ctx = makeCtx({ headers: { 'instant-signature': 'sig' }, rawText: '{"raw":true}' })
    expect(await handler(ctx)).toEqual({ ok: true })
    expect(mocks.verify).toHaveBeenCalledWith({ signature: 'sig', body: '{"raw":true}' }, undefined)
    expect(mocks.dispatch).toHaveBeenCalledWith(handlers, { data: [], idempotencyKey: 'k' })
  })

  it('answers 400 when verification fails (no dispatch)', async () => {
    mocks.verify.mockRejectedValue(new Error('bad signature'))
    const handler = createWebhookHandler(adapter, handlers)
    const ctx = makeCtx({ headers: { 'instant-signature': 'sig' }, rawText: '{}' })
    expect(await handler(ctx)).toMatchObject({ ok: false })
    expect(ctx.status).toBe(400)
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })

  it('answers 400 when a handler rejects, so Instant retries', async () => {
    mocks.verify.mockResolvedValue({ payloadUrl: 'u', token: 't' })
    mocks.fetchPayload.mockResolvedValue({ data: [], idempotencyKey: 'k' })
    mocks.dispatch.mockRejectedValue(new Error('handler boom'))
    const handler = createWebhookHandler(adapter, handlers)
    const ctx = makeCtx({ headers: { 'instant-signature': 'sig' }, rawText: '{}' })
    await handler(ctx)
    expect(ctx.status).toBe(400)
  })
})
