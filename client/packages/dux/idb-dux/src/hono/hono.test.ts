/**
 * Runtime plane for `/hono`: the shared server conformance suite driven through
 * a real Hono app (`app.fetch`). Proves the Hono adapter's wiring — cookie
 * helpers, `c.req.text()` raw body, `c.status`, `HTTPException` — end to end.
 */
import type { Context, Handler } from 'hono'
import { runServerConformance } from '@test'
import { Hono } from 'hono'
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
  name: 'hono',
  mocks,
  defineServerKit,
  defineAuthSyncHandler,
  defineWebhookHandler,
  mount: (handler) => {
    const app = new Hono()
    app.all('/', handler as Handler)
    return req => Promise.resolve(app.fetch(req))
  },
  jsonRoute: fn => async (c: Context) => c.json(await fn(c)),
})
