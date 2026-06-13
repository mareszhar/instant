/**
 * `adminDb.webhooks` — the `/webhooks` surface, admin-token wired
 * ([dux-spec-admin.md §5]). Identical to `webhooks.init({ appId, adminToken })`
 * by construction: the official webhooks package enters only through the
 * webhooks layer, never `@instantdb/admin`, keeping handling admin-free.
 */
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type { IdbWebhookConfig, IdbWebhooks } from '../webhooks/index.js'
import { init as webhooksInit } from '../webhooks/index.js'

export function adminWebhooks<S extends IdbSchema = IdbRegisteredSchema>(
  config: IdbWebhookConfig,
): IdbWebhooks<S> {
  return webhooksInit<S>(config)
}
