/**
 * Runtime plane for `/elysia`: the shared server conformance suite driven through
 * a real Elysia app (`app.handle`). Proves the Elysia adapter's wiring — the
 * reactive cookie jar, `{ parse: 'text' }` raw body, `ctx.set.status`, thrown
 * `status()` — end to end.
 */
import type { Context } from 'elysia'
import { runServerConformance } from '@test'
import { Elysia } from 'elysia'
import { vi } from 'vitest'
import { defineAuthSyncHandler, defineServerKit, defineWebhookHandler } from './index.js'

const mocks = vi.hoisted(() => {
  const verifyToken = vi.fn()
  const scopedDb = { __scoped: true }
  const asUser = vi.fn(() => scopedDb)
  const adminInit = vi.fn(() => ({ auth: { verifyToken }, asUser, __admin: true }))
  const verify = vi.fn()
  const fetchPayload = vi.fn()
  const dispatch = vi.fn()
  const webhooksInit = vi.fn(() => ({ verify, fetchPayload, dispatch }))
  return { verifyToken, scopedDb, asUser, adminInit, verify, fetchPayload, dispatch, webhooksInit }
})

vi.mock('../admin/index.js', () => ({ init: mocks.adminInit }))
vi.mock('../webhooks/index.js', () => ({ init: mocks.webhooksInit }))

runServerConformance({
  name: 'elysia',
  mocks,
  defineServerKit,
  defineAuthSyncHandler,
  defineWebhookHandler,
  mount: (handler, opts) => {
    const route = handler as Parameters<Elysia['all']>[1]
    const app = opts?.rawBody
      ? new Elysia().all('/', route, { parse: 'text' })
      : new Elysia().all('/', route)
    return req => app.handle(req)
  },
  jsonRoute: fn => (ctx: Context) => fn(ctx),
})
