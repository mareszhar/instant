/**
 * Runtime plane for `/h3`: the shared server conformance suite driven through
 * h3 v2's real request lifecycle (`createApp` + `app.fetch`). The behavior is
 * proven framework-free in `server/server.test.ts`; here the h3 adapter's
 * wiring is re-proven end to end.
 */
import { runServerConformance } from '@test'
import { createApp, defineEventHandler } from 'h3'
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
  name: 'h3',
  mocks,
  defineServerKit,
  defineAuthSyncHandler,
  defineWebhookHandler,
  mount: (handler) => {
    const app = createApp()
    app.all('/', handler as Parameters<typeof app.all>[1])
    return req => Promise.resolve(app.fetch(req))
  },
  jsonRoute: fn => defineEventHandler(event => fn(event)),
})
