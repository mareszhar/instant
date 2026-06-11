updated: 2026-06-11
status: spec — contracts are binding; implementation approaches are proposals in their service

# dux spec — `/webhooks`

Webhook handling and management: optional-config `init`, plain-object handler authoring with full narrowing, the pipeline verbs, and the manager. **Admin-free by design** — receiving webhooks needs no admin token.

Conventions: [dux-conventions.md](./dux-conventions.md) · Principles: [dux-vision.md §2](./dux-vision.md#2-design-principles) · Why it's in scope: [dux-vision.md §3.3](./dux-vision.md#33-why-webhooks-is-in-and-why-its-a-subpath)

## Implementation status

| Phase | Scope | Global phase | Status |
|---|---|---|---|
| H1 | Handling core: `init`, the pipeline verbs, `IdbWebhook*` types | 5 | ☐ not started |
| H2 | Authoring: `defineWebhookHandlers` narrowing + merge + resolution | 5 | ☐ not started |
| H3 | Manager: subscription CRUD + event inspection | 5 | ☐ not started |

Details: [§8 Phased implementation roadmap](#8-phased-implementation-roadmap).

- [1. Scope](#1-scope)
- [2. Vocabulary](#2-vocabulary)
- [3. `init(config?)`](#3-initconfig)
- [4. Authoring — `defineWebhookHandlers`](#4-authoring--definewebhookhandlers)
- [5. The pipeline](#5-the-pipeline)
- [6. The manager](#6-the-manager)
- [7. Types](#7-types)
- [8. Phased implementation roadmap](#8-phased-implementation-roadmap)

---

## 1. Scope

`/webhooks` is its own subpath — not an `/admin` feature — for **dependency isolation**: *handling* webhooks (verify signature → fetch payload → dispatch) needs no admin token and no `@instantdb/admin`. Signature verification uses Instant's public JWKS; payload fetches use the token the webhook body carries. A worker that only receives webhooks installs the `@instantdb/webhooks` optional peer and nothing else.

*Management* (`manager`) does need the token; `/admin` wires it and exposes the same surface at `adminDb.webhooks` ([dux-spec-admin.md](./dux-spec-admin.md)). `/nuxt` adds only the route glue ([dux-spec-nuxt.md](./dux-spec-nuxt.md)); all verification mechanics stay here.

The whole surface is **wrap-and-map** over `@instantdb/webhooks`: composition over its public surface, renames at the boundary module, zero forked internals.

## 2. Vocabulary

A **webhook** delivers **payloads** of **changes** ([conventions §1](./dux-conventions.md#1-vocabulary)). A change's `before`/`after` **is `IdbEntity<'ns'>`** — the same entity type queries and tx speak (verified: the official per-change entity type resolves to id + fields with no links, exactly `IdbEntity`'s shape). A webhook handler and a query reading the same namespace see the same type by construction. Webhook payloads arrive as JSON, matching `IdbEntity`'s wire-format dates.

## 3. `init(config?)`

```ts
import { init } from '@mszr/idb-dux/webhooks'

const webhooks = init()
await webhooks.process(handlers, request) // verify signature → fetch payload → dispatch
```

The contract: **config is optional, because handling needs none.** What config unlocks:

| Config | Unlocks |
|---|---|
| — (none) | the full handling pipeline: `verify`, `fetchPayload`, `dispatch`, `process`, `processNode` |
| `appId` + `adminToken` | `manager` ([§6](#6-the-manager)) |
| `apiURI` | self-hosting |

Payload and handler types flow from schema registration — registration supplies types, and webhook handling's runtime needs no schema value ([conventions §7](./dux-conventions.md#7-schema-registration)).

## 4. Authoring — `defineWebhookHandlers`

### The contract

Authoring handlers is a **plain object literal** with full per-change narrowing — no helper functions, no schema generics at the call site:

```ts
import { defineWebhookHandlers } from '@mszr/idb-dux/webhooks'

export const handlers = defineWebhookHandlers({
  tasks: {
    create: ({ after }) => notifyAssignee(after), // after: IdbEntity<'tasks'>
    delete: ({ before }) => audit('task removed', before),
  },
  $default: change => log(change), // any namespace, any action
})
```

(The official authoring path routes through `typedHandlers`/`combineHandlers` helper ceremony to get typing; contextual typing on the object literal — the same mechanism that powers inline query validation — makes the helpers dissolve.)

Semantics, preserved exactly from the official dispatcher (behavioral compatibility):

- **Resolution per change**: `namespace.action` → `namespace.$default` → `$default` (the `$default` keys sit happily inside dux's `$`-prefix convention)
- **Handlers run concurrently**; any rejection rejects `process`, so the route returns non-2xx and Instant retries
- **Merging**: `defineWebhookHandlers(...maps)` accepts several maps and merges them — composition without a dedicated combinator

A `defineWebhookHandlers` map is **structurally a valid official `WebhookHandlers`** — locked by a compat-target test.

## 5. The pipeline

One-liners for the common case, the steps exposed for custom flows:

| API | Notes |
|---|---|
| `webhooks.process(handlers, request, opts?)` | verify → fetch payload → dispatch (Web `Request`) |
| `webhooks.processNode(handlers, req, opts?)` | Node `IncomingMessage` adapter (official raw-body rules preserved) |
| `webhooks.verify(request)` | cryptographic signature verification; raw form `verify({ signature, body })` |
| `webhooks.fetchPayload(...)` | fetch the payload a delivery references |
| `webhooks.dispatch(handlers, payload)` | route each change to its handler |

The verbs are renamed from the official surface where the official name is inaccurate — the [conventions §5](./dux-conventions.md#5-native-keys-and-wrapped-verbs) bar:

| Official | Why it moved | dux |
|---|---|---|
| `validate` / `validateRequest` | two names; the operation is cryptographic verification | **`verify`** — one name, the accurate term |
| `fetchPayloads` | fetches **one** payload object (the plural is a misnomer per its own return type) | **`fetchPayload`** |
| `processPayload` | it dispatches changes to handlers | **`dispatch`** |
| `processRequest` / `processNodeRequest` | the receiver (`webhooks.`) already says the domain | **`process`** / **`processNode`** |
| `helpers()` / `typedHandlers` / `combineHandlers` | ceremony dissolved by contextual typing | **`defineWebhookHandlers(...maps)`** |

## 6. The manager

Subscription CRUD + delivery-event inspection. **Every method name kept verbatim** — already precise: `list`, `create`, `update`, `delete`, `enable`, `disable`, `listEvents`, `getEvent`, `getPayload`, `resendEvent`.

```ts
const webhooks = init({ appId, adminToken })
await webhooks.manager.create({ url, namespaces: ['tasks'], actions: ['create'] })
```

Also exposed token-wired as `adminDb.webhooks.manager` ([dux-spec-admin.md](./dux-spec-admin.md)).

## 7. Types

The official per-surface types map mechanically; the non-obvious calls:

| Official | What it actually is | dux |
|---|---|---|
| `WebhookInfo` | the webhook itself ("Info" worked around the class owning the bare name; manager methods return *webhooks*) | **`IdbWebhook`** |
| `WebhookEventInfo` | a delivery event | `IdbWebhookEvent` |
| `WebhookAttempt` | one delivery attempt | `IdbWebhookAttempt` |
| `WebhookEventsPage` | a page of events | `IdbWebhookEventsPage` |
| `WebhookPayload` | the delivered batch | `IdbWebhookPayload` |
| `WebhookPayloadRecord` / `WebhookPayloadRecordFor` | one change; two types for one concept | **`IdbWebhookChange<'ns'?, action?>`** — one utility, optional narrowing (the `IdbEntity` pattern) |
| `WebhookHandlers` | the handler map | `IdbWebhookHandlers` |
| `CreateWebhookParams` / `UpdateWebhookParams` | op payloads | `IdbWebhookCreate` / `IdbWebhookUpdate` (the `IdbTxCreate`/`IdbTxUpdate` pattern) |
| `WebhookAction` / `WebhookStatus` / `WebhookEventStatus` | unions | `IdbWebhookAction` / `IdbWebhookStatus` / `IdbWebhookEventStatus` |
| `WebhookEntity<S, NS>` | id + fields — exactly the entity | **dropped** — it *is* `IdbEntity<'ns'>` |

All registration-typed: no schema generic at any call site.

### Implementation approach (proposal)

```
src/webhooks/
  init.ts                  # optional-config init; composes @instantdb/webhooks (optional peer)
  defineWebhookHandlers.ts # contextual-typing authoring; map merging
  types.ts                 # the IdbWebhook* boundary module (renames live here, nowhere else)
  index.ts
```

Boundary law: `webhooks/` imports core + `@instantdb/webhooks` + `schema/` only — admin-free is lint-enforced, not aspirational.

---

## 8. Phased implementation roadmap

### Phase H1 — handling core (global phase 5)

Done when: dispatch behavior matches the official pipeline on shared fixtures.

- [ ] `init(config?)` — optional config; capability gating (`manager` requires token)
- [ ] `verify` (Request + raw forms, JWKS verification via the wrapped package)
- [ ] `fetchPayload`, `dispatch`, `process`, `processNode`
- [ ] `types.ts` boundary module: the full `IdbWebhook*` table, registration-typed
- [ ] runtime suite: pipeline parity against official `processRequest` on shared fixtures
- [ ] retry semantics test: handler rejection → `process` rejects

### Phase H2 — authoring (global phase 5)

Done when: handler-narrowing dx tests green; handlers-shape compat test green.

- [ ] `defineWebhookHandlers(...maps)`: contextual narrowing, map merging
- [ ] resolution order (`ns.action` → `ns.$default` → `$default`) preserved
- [ ] `.dx.test.ts`: per-change narrowing (`after` typed per namespace/action) on plain literals
- [ ] compat test: the map is structurally a valid official `WebhookHandlers`

### Phase H3 — manager (global phase 5)

Done when: manager surface typed end-to-end; consumed by `/admin` unchanged.

- [ ] `manager` with verbatim method names; `IdbWebhookCreate`/`IdbWebhookUpdate` payloads
- [ ] event inspection (`listEvents`, `getEvent`, `getPayload`, `resendEvent`) typed
- [ ] `.test-d.ts`: manager types; `.dx.test.ts`: create/update payload completions
