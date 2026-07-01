/**
 * The shared server-plane conformance suite. Every framework adapter re-proves
 * the same request-lifecycle behavior through its *real* app — real cookies in
 * and out, real `Set-Cookie` attributes, real status codes, real raw bodies —
 * by supplying a `mount` driver and a `jsonRoute` builder. The behavior itself
 * (modes, caching, the `tokenFrom` matrix, auth-sync overrides) is proven
 * framework-free in `server/server.test.ts`; this asserts the wiring is right.
 *
 * The harness is fully injected: it imports no framework and no server layer, so
 * it stays on the agnostic plane. Each adapter test file sets up the `/admin`
 * and `/webhooks` mocks (hoisted) and passes them in.
 */
import type { Mock } from 'vitest'
import { schema } from './app.js'

type Mode = 'user?' | 'user' | 'userDb?' | 'userDb'

/** The kit shape, loosened for the harness (the precise per-mode narrowing is a type test). */
interface ConformanceKit {
  adminDb: unknown
  user?: unknown
  userDb?: unknown
}

type KitFactory<Ctx> = (ctx: Ctx, mode?: Mode) => Promise<ConformanceKit>

interface KitConfig<Ctx> {
  schema: typeof schema
  getAppId: (ctx: Ctx) => string
  getAdminToken: (ctx: Ctx) => string
}

interface AuthSyncConfig<Ctx> {
  getAppId: (ctx: Ctx) => string
}

/** A handler map shape assignable to `IdbWebhookHandlers` — enough for the route tests. */
type ConformanceHandlers = Record<string, {
  create?: () => void
  delete?: () => void
  update?: () => void
  $default?: () => void
}>

/** The mocked `/admin` + `/webhooks` seams each adapter test hoists and injects. */
export interface ConformanceMocks {
  verifyToken: Mock
  asUser: Mock
  scopedDb: object
  verify: Mock
  fetchPayload: Mock
  dispatch: Mock
}

/** What an adapter provides to run the shared suite against its real app. */
export interface ServerConformanceHarness<Ctx> {
  /** The adapter's name, for the test titles. */
  name: string
  /** Build a web-fetch driver from a native handler. `rawBody` = the webhook route. */
  mount: (handler: unknown, opts?: { rawBody?: boolean }) => (req: Request) => Promise<Response>
  /** Wrap an async `(ctx) => value` into a native handler that responds JSON (throws propagate). */
  jsonRoute: (fn: (ctx: Ctx) => Promise<Record<string, unknown>>) => unknown
  defineServerKit: (config: KitConfig<Ctx>) => KitFactory<Ctx>
  defineAuthSyncHandler: (config: AuthSyncConfig<Ctx>) => unknown
  defineWebhookHandler: (handlers: ConformanceHandlers) => unknown
  mocks: ConformanceMocks
}

export function runServerConformance<Ctx>(h: ServerConformanceHarness<Ctx>): void {
  const kitConfig = { schema, getAppId: () => 'app', getAdminToken: () => 'tok' }

  describe(`${h.name} — defineServerKit through the real lifecycle`, () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('resolves the user from the cookie (user?)', async () => {
      h.mocks.verifyToken.mockResolvedValue({ id: 'u1' })
      const useKit = h.defineServerKit(kitConfig)
      const run = h.mount(h.jsonRoute(async (ctx) => {
        const { user } = await useKit(ctx, 'user?')
        return { user: user ?? null }
      }))
      const res = await run(new Request('http://localhost/', { headers: { cookie: 'instant_token_app=rt' } }))
      expect(await res.json()).toEqual({ user: { id: 'u1' } })
      expect(h.mocks.verifyToken).toHaveBeenCalledWith('rt')
    })

    it('falls back to the Authorization bearer header', async () => {
      h.mocks.verifyToken.mockResolvedValue({ id: 'u1' })
      const useKit = h.defineServerKit(kitConfig)
      const run = h.mount(h.jsonRoute(async (ctx) => {
        const { user } = await useKit(ctx, 'user?')
        return { user: user ?? null }
      }))
      const res = await run(new Request('http://localhost/', { headers: { authorization: 'Bearer bt' } }))
      expect(await res.json()).toEqual({ user: { id: 'u1' } })
      expect(h.mocks.verifyToken).toHaveBeenCalledWith('bt')
    })

    it('throws a real 401 for user without auth', async () => {
      const useKit = h.defineServerKit(kitConfig)
      const run = h.mount(h.jsonRoute(async (ctx) => {
        await useKit(ctx, 'user')
        return { ok: true }
      }))
      const res = await run(new Request('http://localhost/'))
      expect(res.status).toBe(401)
    })

    it('caches one verification across repeated kit calls in a request', async () => {
      h.mocks.verifyToken.mockResolvedValue({ id: 'u1' })
      const useKit = h.defineServerKit(kitConfig)
      const run = h.mount(h.jsonRoute(async (ctx) => {
        await useKit(ctx, 'user?')
        await useKit(ctx, 'user')
        return { ok: true }
      }))
      await run(new Request('http://localhost/', { headers: { cookie: 'instant_token_app=rt' } }))
      expect(h.mocks.verifyToken).toHaveBeenCalledTimes(1)
    })

    it('scopes a per-request userDb via asUser({ token })', async () => {
      h.mocks.verifyToken.mockResolvedValue({ id: 'u1' })
      const useKit = h.defineServerKit(kitConfig)
      const run = h.mount(h.jsonRoute(async (ctx) => {
        const { userDb } = await useKit(ctx, 'userDb')
        return { scoped: userDb === h.mocks.scopedDb }
      }))
      const res = await run(new Request('http://localhost/', { headers: { cookie: 'instant_token_app=rt' } }))
      expect(await res.json()).toEqual({ scoped: true })
      expect(h.mocks.asUser).toHaveBeenCalledWith({ token: 'rt' })
    })
  })

  describe(`${h.name} — defineAuthSyncHandler`, () => {
    const run = h.mount(h.defineAuthSyncHandler({ getAppId: () => 'app' }))
    const json = { 'content-type': 'application/json' }
    const post = (body: unknown): Request =>
      new Request('http://localhost/', { method: 'POST', headers: json, body: JSON.stringify(body) })

    it('stores only the refresh token, with the official cookie attributes', async () => {
      const res = await run(post({ type: 'sync-user', appId: 'app', user: { refresh_token: 'rt-123', id: 'u1' } }))
      expect(await res.json()).toEqual({ ok: true })
      const cookie = res.headers.get('set-cookie') || ''
      expect(cookie).toContain('instant_token_app=rt-123')
      expect(cookie).not.toContain('u1')
      expect(cookie).toMatch(/HttpOnly/i)
      expect(cookie).toMatch(/Secure/i)
      expect(cookie).toMatch(/SameSite=Strict/i)
    })

    it('clears the cookie when the user is null', async () => {
      const res = await run(post({ type: 'sync-user', appId: 'app', user: null }))
      expect(await res.json()).toEqual({ ok: true })
      const cookie = res.headers.get('set-cookie') || ''
      expect(cookie).toContain('instant_token_app=')
      expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i)
    })

    it('rejects an app-id mismatch with 403', async () => {
      const res = await run(post({ type: 'sync-user', appId: 'other', user: null }))
      expect(res.status).toBe(403)
    })

    it('rejects a missing type with 400', async () => {
      const res = await run(post({ appId: 'app' }))
      expect(res.status).toBe(400)
    })
  })

  describe(`${h.name} — defineWebhookHandler`, () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })
    const post = (body: string): Request =>
      new Request('http://localhost/', { method: 'POST', headers: { 'instant-signature': 'sig' }, body })

    it('answers 200 and dispatches the fetched payload from the raw body', async () => {
      h.mocks.verify.mockResolvedValue({ payloadUrl: 'u', token: 't' })
      h.mocks.fetchPayload.mockResolvedValue({ data: [], idempotencyKey: 'k' })
      h.mocks.dispatch.mockResolvedValue(undefined)
      const handlers = { tasks: { create: () => {} } }
      const run = h.mount(h.defineWebhookHandler(handlers), { rawBody: true })
      const res = await run(post('{"raw":true}'))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
      expect(h.mocks.verify).toHaveBeenCalledWith({ signature: 'sig', body: '{"raw":true}' }, undefined)
      expect(h.mocks.dispatch).toHaveBeenCalledWith(handlers, { data: [], idempotencyKey: 'k' })
    })

    it('answers 400 when verification fails (no dispatch)', async () => {
      h.mocks.verify.mockRejectedValue(new Error('bad signature'))
      const run = h.mount(h.defineWebhookHandler({}), { rawBody: true })
      const res = await run(post('{}'))
      expect(res.status).toBe(400)
      expect(h.mocks.dispatch).not.toHaveBeenCalled()
    })

    it('answers 400 when a handler rejects, so Instant retries', async () => {
      h.mocks.verify.mockResolvedValue({ payloadUrl: 'u', token: 't' })
      h.mocks.fetchPayload.mockResolvedValue({ data: [], idempotencyKey: 'k' })
      h.mocks.dispatch.mockRejectedValue(new Error('handler boom'))
      const run = h.mount(h.defineWebhookHandler({}), { rawBody: true })
      const res = await run(post('{}'))
      expect(res.status).toBe(400)
    })
  })
}
