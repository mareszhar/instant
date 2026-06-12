/**
 * `@mszr/idb-dux/webhooks` — webhook handling and management.
 *
 * Optional-config `init`, `defineWebhookHandlers`, the pipeline verbs
 * (`verify`/`fetchPayload`/`dispatch`/`process`/`processNode`), and `manager`.
 * Admin-free by design: handling needs no admin token.
 *
 * Spec: `../../../docs/dux-spec-webhooks.md`.
 */
export { defineWebhookHandlers } from './defineWebhookHandlers.js'
export { init } from './init.js'
export type {
  IdbWebhook,
  IdbWebhookAction,
  IdbWebhookAttempt,
  IdbWebhookBody,
  IdbWebhookChange,
  IdbWebhookConfig,
  IdbWebhookCreate,
  IdbWebhookEvent,
  IdbWebhookEventsPage,
  IdbWebhookEventStatus,
  IdbWebhookHandlers,
  IdbWebhookManager,
  IdbWebhookNodeOpts,
  IdbWebhookNodeRequest,
  IdbWebhookPayload,
  IdbWebhooks,
  IdbWebhookStatus,
  IdbWebhookUpdate,
  IdbWebhookVerifyOpts,
} from './types.js'
