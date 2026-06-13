/**
 * Runtime plane for `/nuxt`: the three utilities driven through h3's real
 * request lifecycle (`createApp` + `toWebHandler`). The `/admin` and
 * `/webhooks` layers are mocked — their mechanics have their own suites — so
 * here we exercise the h3 wiring: mode-narrowed kit assembly with request-scoped
 * caching, the token-only auth-sync cookie, and the verify → fetch → dispatch
 * webhook route with its 2xx/4xx mapping.
 */
import { schema } from '@test'
import { createApp, defineEventHandler, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineAuthSyncHandler } from './defineAuthSyncHandler.js'
import { defineServerKit } from './defineServerKit.js'
import { defineWebhookHandler } from './defineWebhookHandler.js'

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

function appWith(handler: ReturnType<typeof defineEventHandler>) {
  const app = createApp()
  app.use(handler)
  return toWebHandler(app)
}

const kitConfig = { schema, getAppId: () => 'app', getAdminToken: () => 'tok' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('defineServerKit — modes + caching', () => {
  it('no mode performs no auth work', async () => {
    const useKit = defineServerKit(kitConfig)
    const handler = appWith(defineEventHandler(async (event) => {
      const { adminDb } = await useKit(event)
      return { hasAdmin: !!adminDb }
    }))
    const res = await handler(new Request('http://x/'))
    expect(await res.json()).toEqual({ hasAdmin: true })
    expect(mocks.verifyToken).not.toHaveBeenCalled()
  })

  it('user? verifies the cookie and resolves the user when present', async () => {
    mocks.verifyToken.mockResolvedValue({ id: 'u1' })
    const useKit = defineServerKit(kitConfig)
    const handler = appWith(defineEventHandler(async (event) => {
      const { user } = await useKit(event, 'user?')
      return { user: user ?? null }
    }))
    const res = await handler(new Request('http://x/', { headers: { cookie: 'instant_token_app=rt' } }))
    expect(await res.json()).toEqual({ user: { id: 'u1' } })
    expect(mocks.verifyToken).toHaveBeenCalledWith('rt')
  })

  it('user? leaves the user undefined when no cookie is present', async () => {
    const useKit = defineServerKit(kitConfig)
    const handler = appWith(defineEventHandler(async (event) => {
      const { user } = await useKit(event, 'user?')
      return { user: user ?? null }
    }))
    const res = await handler(new Request('http://x/'))
    expect(await res.json()).toEqual({ user: null })
    expect(mocks.verifyToken).not.toHaveBeenCalled()
  })

  it('user throws 401 when auth is missing or invalid', async () => {
    const useKit = defineServerKit(kitConfig)
    const handler = appWith(defineEventHandler(async (event) => {
      await useKit(event, 'user')
      return { ok: true }
    }))
    const res = await handler(new Request('http://x/'))
    expect(res.status).toBe(401)
  })

  it('caches the verification across repeated kit calls in one request', async () => {
    mocks.verifyToken.mockResolvedValue({ id: 'u1' })
    const useKit = defineServerKit(kitConfig)
    const handler = appWith(defineEventHandler(async (event) => {
      await useKit(event, 'user?')
      await useKit(event, 'user')
      return { ok: true }
    }))
    await handler(new Request('http://x/', { headers: { cookie: 'instant_token_app=rt' } }))
    expect(mocks.verifyToken).toHaveBeenCalledTimes(1)
  })

  it('shares one verification across concurrent kit calls', async () => {
    mocks.verifyToken.mockResolvedValue({ id: 'u1' })
    const useKit = defineServerKit(kitConfig)
    const handler = appWith(defineEventHandler(async (event) => {
      await Promise.all([useKit(event, 'user?'), useKit(event, 'user?')])
      return { ok: true }
    }))
    await handler(new Request('http://x/', { headers: { cookie: 'instant_token_app=rt' } }))
    expect(mocks.verifyToken).toHaveBeenCalledTimes(1)
  })

  it('userDb scopes a per-request db via asUser({ token })', async () => {
    mocks.verifyToken.mockResolvedValue({ id: 'u1' })
    const useKit = defineServerKit(kitConfig)
    const handler = appWith(defineEventHandler(async (event) => {
      const { userDb } = await useKit(event, 'userDb')
      return { scoped: (userDb as unknown) === mocks.scopedDb }
    }))
    const res = await handler(new Request('http://x/', { headers: { cookie: 'instant_token_app=rt' } }))
    expect(await res.json()).toEqual({ scoped: true })
    expect(mocks.asUser).toHaveBeenCalledWith({ token: 'rt' })
  })
})

describe('defineAuthSyncHandler — token-only cookie', () => {
  const handler = appWith(defineAuthSyncHandler({ getAppId: () => 'app' }))
  const json = { 'content-type': 'application/json' }

  it('stores only the refresh token, with the official cookie attributes', async () => {
    const res = await handler(new Request('http://x/', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ type: 'sync-user', appId: 'app', user: { refresh_token: 'rt-123', id: 'u1', email: 'a@b.c' } }),
    }))
    expect(await res.json()).toEqual({ ok: true })
    const cookie = res.headers.get('set-cookie') || ''
    expect(cookie).toContain('instant_token_app=rt-123')
    expect(cookie).not.toContain('u1')
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/Secure/i)
    expect(cookie).toMatch(/SameSite=Strict/i)
    expect(cookie).toMatch(/Max-Age=604800/i)
  })

  it('clears the cookie when the user is null', async () => {
    const res = await handler(new Request('http://x/', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ type: 'sync-user', appId: 'app', user: null }),
    }))
    expect(await res.json()).toEqual({ ok: true })
    const cookie = res.headers.get('set-cookie') || ''
    expect(cookie).toContain('instant_token_app=')
    expect(cookie).toMatch(/Max-Age=0/i)
  })

  it('rejects an app-id mismatch with 403', async () => {
    const res = await handler(new Request('http://x/', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ type: 'sync-user', appId: 'other', user: null }),
    }))
    expect(res.status).toBe(403)
  })

  it('rejects a missing type with 400', async () => {
    const res = await handler(new Request('http://x/', { method: 'POST', headers: json, body: JSON.stringify({ appId: 'app' }) }))
    expect(res.status).toBe(400)
  })
})

describe('defineWebhookHandler — verify → fetch → dispatch', () => {
  const handlers = { tasks: { create: vi.fn() } } as any

  it('answers 200 and dispatches the fetched payload', async () => {
    mocks.verify.mockResolvedValue({ payloadUrl: 'u', token: 't' })
    mocks.fetchPayload.mockResolvedValue({ data: [], idempotencyKey: 'k' })
    mocks.dispatch.mockResolvedValue(undefined)
    const handler = appWith(defineWebhookHandler(handlers))
    const res = await handler(new Request('http://x/', {
      method: 'POST',
      headers: { 'instant-signature': 'sig' },
      body: '{"raw":true}',
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mocks.verify).toHaveBeenCalledWith({ signature: 'sig', body: '{"raw":true}' }, undefined)
    expect(mocks.dispatch).toHaveBeenCalledWith(handlers, { data: [], idempotencyKey: 'k' })
  })

  it('answers 4xx when verification fails (no dispatch)', async () => {
    mocks.verify.mockRejectedValue(new Error('bad signature'))
    const handler = appWith(defineWebhookHandler(handlers))
    const res = await handler(new Request('http://x/', { method: 'POST', headers: { 'instant-signature': 'sig' }, body: '{}' }))
    expect(res.status).toBe(400)
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })

  it('answers 4xx when a handler rejects, so Instant retries', async () => {
    mocks.verify.mockResolvedValue({ payloadUrl: 'u', token: 't' })
    mocks.fetchPayload.mockResolvedValue({ data: [], idempotencyKey: 'k' })
    mocks.dispatch.mockRejectedValue(new Error('handler boom'))
    const handler = appWith(defineWebhookHandler(handlers))
    const res = await handler(new Request('http://x/', { method: 'POST', headers: { 'instant-signature': 'sig' }, body: '{}' }))
    expect(res.status).toBe(400)
  })
})
