import type { AppSchema } from '@test'
import { schema } from '@test'
import { describe, expect, it, vi } from 'vitest'
import { isReactive, reactive } from 'vue'
import { IdbClient } from './db.js'
import { init } from './defineDb.js'

// Stub only the baseline `init` so the overlay `init` builds a client over a
// fake baseline instead of a real core (jsdom has no indexedDB/websocket). The
// rest of the baseline module stays real.
vi.mock('../baseline/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../baseline/index.js')>()
  return {
    ...actual,
    init: () => ({ auth: {}, storage: {}, streams: {} }),
  }
})

// Regression for the demo's "Cannot read private member #baseline from an
// object whose class did not declare it" failure: storing the client in a
// Pinia store / `reactive()` is the normal case, and the pass-through getters
// (`auth`/`storage`/`streams`) read a private `#baseline` — which throws when
// reached through a reactive proxy. The public client must be markRaw.
describe('overlay client — reactive-proxy safety', () => {
  it('an unguarded client breaks its pass-through getters under a reactive proxy', () => {
    const db = new IdbClient<AppSchema>({ auth: {}, storage: {}, streams: {} } as any, schema)
    const state = reactive({ db })
    expect(isReactive(state.db)).toBe(true) // proxied
    expect(() => state.db.auth).toThrow() // exactly the demo's magic-code failure
  })

  it('init returns a markRaw client, so it survives reactive() / Pinia state', () => {
    const db = init<AppSchema>({ appId: 'test-app', schema })
    const state = reactive({ db })
    expect(isReactive(state.db)).toBe(false) // markRaw → never proxied
    expect(() => state.db.auth).not.toThrow()
    expect(() => state.db.storage).not.toThrow()
    expect(() => state.db.streams).not.toThrow()
  })
})
