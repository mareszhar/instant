/**
 * `defineWebhookHandler` — the one-line webhook route ([dux-spec-nuxt.md §4]).
 * Reads the raw body the h3 way (signature verification needs the exact bytes),
 * delegates verify → fetch → dispatch to `/webhooks`, and answers 2xx/4xx per
 * official retry semantics: a handler rejection surfaces as a non-2xx, so
 * Instant retries.
 *
 * The singular/plural pair is deliberate grammar: `defineWebhookHandlers`
 * (in `/webhooks`) authors the *many* handlers; this is the *one* route that
 * receives them — `defineWebhookHandler(defineWebhookHandlers({ … }))`.
 */
import type { EventHandler } from 'h3'
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type {
  IdbWebhookHandlers,
  IdbWebhookVerifyOpts,
} from '../webhooks/index.js'
import { defineEventHandler, getHeader, readRawBody, setResponseStatus } from 'h3'
import { init as webhooksInit } from '../webhooks/index.js'

export function defineWebhookHandler<S extends IdbSchema = IdbRegisteredSchema>(
  handlers: IdbWebhookHandlers<S>,
  opts?: IdbWebhookVerifyOpts,
): EventHandler {
  const webhooks = webhooksInit<S>()
  return defineEventHandler(async (event) => {
    const signature = getHeader(event, 'instant-signature') || ''
    const body = (await readRawBody(event, 'utf8')) || ''
    try {
      const verified = await webhooks.verify({ signature, body }, opts)
      const payload = await webhooks.fetchPayload(verified)
      await webhooks.dispatch(handlers, payload)
      return { ok: true }
    }
    catch (error) {
      // Non-2xx → Instant retries (verification failure or handler rejection).
      setResponseStatus(event, 400)
      return { ok: false, error: String(error) }
    }
  })
}
