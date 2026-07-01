/**
 * `createWebhookHandler` — the framework-agnostic core behind every adapter's
 * `defineWebhookHandler` ([dux-spec-server.md §6]). Reads the raw body the
 * adapter's way (signature verification needs the exact bytes), delegates
 * verify → fetch → dispatch to `/webhooks`, and answers 2xx/4xx per official
 * retry semantics: a handler rejection surfaces as a non-2xx, so Instant retries.
 *
 * The singular/plural pairing is deliberate grammar: `defineWebhookHandlers`
 * (in `/webhooks`) authors the *many* handlers; `defineWebhookHandler` is the *one*
 * route that receives them — `defineWebhookHandler(defineWebhookHandlers({ … }))`.
 */
import type { IdbSchema } from '../schema/defineSchema.js'
import type {
  IdbWebhookHandlers,
  IdbWebhookVerifyOpts,
} from '../webhooks/index.js'
import type { IdbDuxServerAdapter } from './adapter.js'
import { init as webhooksInit } from '../webhooks/index.js'

/** The webhook handler's response shape — `{ ok: true }`, or `{ ok: false, error }` with 400 set. */
export interface IdbWebhookRouteResult {
  ok: boolean
  error?: string
}

/**
 * Build the webhook-route core over an adapter. An adapter's
 * `defineWebhookHandler` wraps this in its native handler shape.
 */
export function createWebhookHandler<S extends IdbSchema, Ctx>(
  adapter: IdbDuxServerAdapter<Ctx>,
  handlers: IdbWebhookHandlers<S>,
  opts?: IdbWebhookVerifyOpts,
): (event: Ctx) => Promise<IdbWebhookRouteResult> {
  const webhooks = webhooksInit<S>()
  return async (event) => {
    const signature = adapter.getHeader(event, 'instant-signature') || ''
    const body = (await adapter.readRawText(event)) || ''
    try {
      const verified = await webhooks.verify({ signature, body }, opts)
      const payload = await webhooks.fetchPayload(verified)
      await webhooks.dispatch(handlers, payload)
      return { ok: true }
    }
    catch (error) {
      // Non-2xx → Instant retries (verification failure or handler rejection).
      adapter.setStatus(event, 400)
      return { ok: false, error: String(error) }
    }
  }
}
