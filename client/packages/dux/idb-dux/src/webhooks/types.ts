/**
 * The `IdbWebhook*` boundary module — every rename from `@instantdb/webhooks`
 * lives here and nowhere else (wrap-and-map, dux-spec-workspace.md §5.1).
 *
 * Two kinds of types live side by side:
 *
 * - **aliases** for shapes with no entity content (`IdbWebhook`, the manager,
 *   the op payloads, the unions): pure renames over the official types, so
 *   upstream changes ride in for free and break loudly at the wrap points.
 * - **authored-fresh** for the handler surface (`IdbWebhookChange`,
 *   `IdbWebhookHandlers`): a change's `before`/`after` is the same
 *   `IdbEntity<'ns'>` a query and a tx speak — one entity type everywhere, by
 *   construction (dux-spec-webhooks.md §2). `WebhookEntity` is dropped — it
 *   resolves to `IdbEntity` already.
 *
 * Everything is registration-typed — no schema generic at any call site, with
 * the trailing escape-hatch param for multi-schema tools.
 */
import type {
  CreateWebhookParams,
  UpdateWebhookParams,
  WebhookAction,
  WebhookAttempt,
  WebhookBody,
  WebhookEventInfo,
  WebhookEventsPage,
  WebhookEventStatus,
  WebhookInfo,
  WebhookPayload,
  Webhooks,
  WebhooksManager,
  WebhookStatus,
} from '@instantdb/webhooks'
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type { IdbEntity, IdbNamespaceName } from '../schema/types.js'

// ==========
// aliases — official shapes, dux names

/** A configured webhook subscription. */
export type IdbWebhook = WebhookInfo
/** A single delivery event for a webhook. */
export type IdbWebhookEvent = WebhookEventInfo
/** One HTTP delivery attempt of an event. */
export type IdbWebhookAttempt = WebhookAttempt
/** A page of delivery events. */
export type IdbWebhookEventsPage = WebhookEventsPage
/** The verified delivery pointer `verify` returns — `payloadUrl` + `token`. */
export type IdbWebhookBody = WebhookBody
/** The write actions a webhook can deliver. */
export type IdbWebhookAction = WebhookAction
/** Whether a webhook is currently delivering events. */
export type IdbWebhookStatus = WebhookStatus
/** A delivery event's stage in the retry lifecycle. */
export type IdbWebhookEventStatus = WebhookEventStatus

/** The `manager.create` payload. */
export type IdbWebhookCreate<S extends IdbSchema = IdbRegisteredSchema>
  = CreateWebhookParams<S>
/** The `manager.update` payload — every field optional. */
export type IdbWebhookUpdate<S extends IdbSchema = IdbRegisteredSchema>
  = UpdateWebhookParams<S>

/** The delivered batch of changes for one webhook event. */
export type IdbWebhookPayload<S extends IdbSchema = IdbRegisteredSchema>
  = WebhookPayload<S>

/** Subscription CRUD + delivery-event inspection. Method names verbatim. */
export type IdbWebhookManager<S extends IdbSchema = IdbRegisteredSchema>
  = WebhooksManager<S>

// ==========
// the change — authored fresh over IdbEntity

/** One change shaped per action: the `before`/`after` an action carries. */
type ChangeFor<
  S extends IdbSchema,
  NS extends IdbNamespaceName<S>,
  Action extends IdbWebhookAction,
> = Action extends 'create'
  ? { namespace: NS, id: string, action: 'create', before: null, after: IdbEntity<NS, S>, idempotencyKey: string }
  : Action extends 'update'
    ? { namespace: NS, id: string, action: 'update', before: IdbEntity<NS, S>, after: IdbEntity<NS, S>, idempotencyKey: string }
    : { namespace: NS, id: string, action: 'delete', before: IdbEntity<NS, S>, after: null, idempotencyKey: string }

/**
 * One entity change a webhook delivers — `namespace`, `action`, and the
 * `before`/`after` entities (`IdbEntity<'ns'>`, the same type queries and tx
 * speak). Narrow with the optional `NS`/`Action` params; left wide it's the
 * discriminated union over every namespace and action a `$default` handler
 * sees. (Replaces the official `WebhookPayloadRecord` + `WebhookPayloadRecordFor`
 * pair — one utility, optional narrowing, the `IdbEntity` pattern.)
 */
export type IdbWebhookChange<
  NS extends IdbNamespaceName<S> = IdbNamespaceName,
  Action extends IdbWebhookAction = IdbWebhookAction,
  S extends IdbSchema = IdbRegisteredSchema,
> = NS extends IdbNamespaceName<S>
  ? Action extends IdbWebhookAction
    ? ChangeFor<S, NS, Action>
    : never
  : never

// ==========
// handlers — authored fresh so changes resolve to IdbWebhookChange

type IdbWebhookHandlerFn<
  S extends IdbSchema,
  NS extends IdbNamespaceName<S>,
  Action extends IdbWebhookAction,
> = (change: IdbWebhookChange<NS, Action, S>) => unknown | Promise<unknown>

/**
 * The handler map: `namespace.action`, a per-namespace `$default`, and a
 * top-level `$default`. Authored as a plain object literal — contextual typing
 * narrows each handler's `change` per namespace and action, so the official
 * `typedHandlers`/`combineHandlers` ceremony dissolves ([§4](./dux-spec-webhooks.md#4-authoring--definewebhookhandlers)).
 */
export type IdbWebhookHandlers<S extends IdbSchema = IdbRegisteredSchema> = {
  [NS in IdbNamespaceName<S>]?: {
    [A in IdbWebhookAction | '$default']?: IdbWebhookHandlerFn<
      S,
      NS,
      A extends IdbWebhookAction ? A : IdbWebhookAction
    >
  }
} & {
  $default?: IdbWebhookHandlerFn<S, IdbNamespaceName<S>, IdbWebhookAction>
}

// ==========
// init config + the handle

/**
 * `init` config. Optional in full — handling needs none. `appId` +
 * `adminToken` unlock the `manager`; `apiURI` is for self-hosting.
 */
export interface IdbWebhookConfig {
  appId?: string | null | undefined
  adminToken?: string | null | undefined
  apiURI?: string | null | undefined
}

/** Tolerance/clock options shared by `verify` and `process`. */
export type IdbWebhookVerifyOpts = NonNullable<
  Parameters<Webhooks<IdbSchema>['validateRequest']>[1]
>

/** The Node `IncomingMessage`-shaped request `processNode` accepts. */
export type IdbWebhookNodeRequest = Parameters<
  Webhooks<IdbSchema>['processNodeRequest']
>[1]

/** `processNode` options — `verify` options plus a raw-body override. */
export type IdbWebhookNodeOpts = NonNullable<
  Parameters<Webhooks<IdbSchema>['processNodeRequest']>[2]
>

/**
 * The webhook handle `init` returns. The pipeline verbs are always present;
 * `manager` requires `appId` + `adminToken` and throws if used without them.
 */
export interface IdbWebhooks<S extends IdbSchema = IdbRegisteredSchema> {
  /** Subscription CRUD + event inspection. Requires `appId` + `adminToken`. */
  manager: IdbWebhookManager<S>
  /**
   * Cryptographically verify a delivery and return its `payloadUrl` + `token`.
   * Pass the `Request`, or the raw `{ signature, body }` for custom flows.
   */
  verify: {
    (request: Request, opts?: IdbWebhookVerifyOpts): Promise<IdbWebhookBody>
    (
      input: { signature: string, body: string | (() => Promise<string>) },
      opts?: IdbWebhookVerifyOpts,
    ): Promise<IdbWebhookBody>
  }
  /** Fetch the payload a verified delivery references. */
  fetchPayload: (body: IdbWebhookBody) => Promise<IdbWebhookPayload<S>>
  /** Route each change in a payload to its handler. */
  dispatch: (
    handlers: IdbWebhookHandlers<S>,
    payload: IdbWebhookPayload<S>,
  ) => Promise<void>
  /** The one-liner: verify → fetch payload → dispatch (Web `Request`). */
  process: (
    handlers: IdbWebhookHandlers<S>,
    request: Request,
    opts?: IdbWebhookVerifyOpts,
  ) => Promise<void>
  /** `process` for a Node `IncomingMessage` (raw-body rules preserved). */
  processNode: (
    handlers: IdbWebhookHandlers<S>,
    req: IdbWebhookNodeRequest,
    opts?: IdbWebhookNodeOpts,
  ) => Promise<void>
}
