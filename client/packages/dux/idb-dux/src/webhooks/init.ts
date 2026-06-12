/**
 * Optional-config `init` — composes `@instantdb/webhooks` and renames its
 * verbs at the boundary (dux-spec-webhooks.md §3, §5). Handling needs no
 * config; `appId` + `adminToken` unlock the `manager`.
 */
import type { WebhookHandlers } from '@instantdb/webhooks'
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type { IdbWebhookConfig, IdbWebhookHandlers, IdbWebhooks } from './types.js'
import { Webhooks } from '@instantdb/webhooks'

/**
 * Create a webhook handle. Call with no config to handle webhooks; pass
 * `appId` + `adminToken` to also manage subscriptions.
 *
 * @example
 *   const webhooks = init()
 *   await webhooks.process(handlers, request) // verify → fetch → dispatch
 */
export function init<S extends IdbSchema = IdbRegisteredSchema>(
  config?: IdbWebhookConfig,
): IdbWebhooks<S> {
  const wh = new Webhooks<S>({
    appId: config?.appId,
    adminToken: config?.adminToken,
    apiURI: config?.apiURI,
  })

  return {
    manager: wh.manager,
    verify: (input: Request | { signature: string, body: string | (() => Promise<string>) }, opts) =>
      input instanceof Request
        ? wh.validateRequest(input, opts)
        : wh.validate(input.signature, input.body, opts),
    fetchPayload: body => wh.fetchPayloads(body),
    dispatch: (handlers, payload) => wh.processPayload(official(handlers), payload),
    process: (handlers, request, opts) => wh.processRequest(official(handlers), request, opts),
    processNode: (handlers, req, opts) => wh.processNodeRequest(official(handlers), req, opts),
  }
}

/**
 * The handler-map seam: a dux handler map *is* an official `WebhookHandlers`
 * (the compat-target test proves it on a concrete schema). The generic `S`
 * can't carry that proof through `exactOptionalPropertyTypes`, so the rename is
 * asserted here, once, at the boundary.
 */
function official<S extends IdbSchema>(
  handlers: IdbWebhookHandlers<S>,
): WebhookHandlers<S> {
  return handlers as unknown as WebhookHandlers<S>
}
