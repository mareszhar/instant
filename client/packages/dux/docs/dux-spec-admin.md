updated: 2026-06-11
status: spec — contracts are binding; implementation approaches are proposals in their service

# dux spec — `/admin`

The full server surface: the dux data plane over `@instantdb/admin`, typed tx and debug, `asUser`, the precise official verbs kept as pass-throughs, and `adminDb.webhooks`. Framework-agnostic, token-scoped, never bundled client-side.

Conventions: [dux-conventions.md](./dux-conventions.md) · Principles: [dux-vision.md §2](./dux-vision.md#2-design-principles) · Data-plane contracts: [dux-spec-root.md](./dux-spec-root.md)

## Implementation status

| Phase | Scope | Global phase | Status |
|---|---|---|---|
| A1 | `init` + the data plane: `query`, `subscribeQuery` | 6 | ☑ complete |
| A2 | Typed tx + debug | 6 | ☑ complete |
| A3 | `asUser` + pass-throughs | 6 | ☑ complete |
| A4 | `adminDb.webhooks` | 6 | ☑ complete |

Details: [§7 Phased implementation roadmap](#7-phased-implementation-roadmap).

- [1. Scope](#1-scope)
- [2. `init`](#2-init)
- [3. The data plane](#3-the-data-plane)
- [4. Typed tx and debug](#4-typed-tx-and-debug)
- [5. `asUser` and the pass-throughs](#5-asuser-and-the-pass-throughs)
- [6. Treatments and renames](#6-treatments-and-renames)
- [7. Phased implementation roadmap](#7-phased-implementation-roadmap)

---

## 1. Scope

The **full official admin surface** is covered — every method has a decided treatment ([§6](#6-treatments-and-renames)); nothing official is reachable only by abandoning dux. The whole subpath is **wrap-and-map**: `@instantdb/admin` stays an external optional peer; dux instantiates and composes its objects; renames live in the boundary module.

```ts
import { init } from '@mszr/idb-dux/admin'

const adminDb = init({ appId, adminToken, schema })

const { workspaces } = await adminDb.query(q({ workspaces: {} })) // Workspace[] — never undefined
adminDb.tx // typed like db.tx
await adminDb.transact(/* ... */)
```

## 2. `init`

`/admin` **owns** `@instantdb/admin` as an optional peer — apps never construct an official admin db to hand in; dux's `init` is the only setup step. Schema-level `options` are read from the schema, same as the client.

## 3. The data plane

### The contract

The server reads the same way the client does — **one data plane, shaped once**:

- **`query(q, opts?)`** — the primary read owns the bare name ([conventions §4](./dux-conventions.md#4-the-primary-read-rule)). Applies the full shaping contract from the [root spec](./dux-spec-root.md#4-result-shaping): array normalization, `$only`/`$at`/`$as`/`$m`, singularization. `opts` carries schema-typed `ruleParams`.

  ```ts
  const { workspace } = await adminDb.query(q({
    workspaces: { $: { where: { id: workspaceId }, $only } },
  }))
  // workspace: Workspace | undefined — same shaping semantics as the client
  ```

- **`subscribeQuery(q, cb?, opts?)`** — **same shaping per emission**: a subscription and a one-shot of the same query deliver the same shape. The official callback and async-iterator contracts are preserved; the handle is typed `IdbQuerySubscription`.

Admin returns **plain shaped data** — the `-Data/-State/-Refs` result pattern is a client-reactivity concept and deliberately does not apply to server one-shots ([conventions §3](./dux-conventions.md#3-the-result-pattern)).

## 4. Typed tx and debug

- **`tx` / `transact`** — the typed chain from the [root spec §5](./dux-spec-root.md#5-typed-tx): schema-typed `ruleParams`, dot-path `.link`. `transact`/`debugTransact` accept `IdbTxChunkInput<S>` (the per-namespace chunk union). One machinery, both runtimes.
- **`debugQuery`** — typed `ruleParams` plus the inspector's rules/ip/origin overrides; its `result` gets the **same shaping** as `query` (the data plane is shaped once — a `debugQuery` and a `query` of the same query return the same `result` shape), and the check results are renamed (`IdbAdminCheckResult`).
- **`debugTransact`** — pass-through with the inspector overrides; the summary result is `IdbAdminDebugTransactResult`.

## 5. `asUser` and the pass-throughs

- **`asUser({ email | token | guest })`** — returns the same dux admin db, permission-scoped. Everything above stays dux-shaped *by construction*, because the scoped db is built from the same composition.
- **`auth.*`** — pass-through: `createToken`, `verifyToken`, the magic-code quartet (`generateMagicCode` is the custom-email hook), `deleteUser`, `signOut`, `getUserFromRequest` keep official verbs. `getUserFromRequest` reads the official full-user cookie; the dux-native server-auth path is `/nuxt`'s kit with its token-only cookie ([dux-spec-nuxt.md](./dux-spec-nuxt.md)).
- **`storage.*` / `streams.*` / `rooms.getPresence`** — pass-through verbs, renamed types (`IdbStorage*`, `IdbStream*`, room presence via `IdbRoom*`). Official `@instantdb/resumable-stream` works with a dux `adminDb` — a tested compatibility target, not a wrap.
- **`webhooks`** — the `/webhooks` surface ([dux-spec-webhooks.md](./dux-spec-webhooks.md)), admin-token wired: `adminDb.webhooks.manager.create({ url, namespaces: ['tasks'], actions: ['create'] })`.

## 6. Treatments and renames

Per-method treatments, decided:

| Surface | Treatment |
|---|---|
| `query(q, opts?)` | the dux data plane: shaping + typed `ruleParams` |
| `subscribeQuery(q, cb?, opts?)` | same shaping per emission; official callback/async-iterator contracts preserved |
| `tx` / `transact` | the typed tx chain; `transact` accepts `IdbTxChunkInput<S>` |
| `debugQuery` | shaped `result` (like `query`) + typed `ruleParams`; `IdbAdminCheckResult` |
| `debugTransact` | pass-through, inspector overrides; `IdbAdminDebugTransactResult` |
| `asUser({ email \| token \| guest })` | returns the same dux admin db, permission-scoped |
| `auth.*` | pass-through, official verbs verbatim |
| `storage.*` / `streams.*` / `rooms.getPresence` | pass-through verbs, renamed types |
| `webhooks` | the `/webhooks` surface, token-wired |

Type renames in this surface's boundary module (pattern: [conventions §8](./dux-conventions.md#8-the-rename-table)):

| Official | dux |
|---|---|
| `InstantConfig` (minus `useDateObjects`) | `IdbAdminConfig` |
| `SubscribeQueryResponse` | `IdbQuerySubscription` (payload `IdbQuerySubscriptionPayload`, callback `IdbQuerySubscriptionCallback`) |
| `SubscriptionReadyState` | `IdbSubscriptionReadyState` |
| `SubscribeQuerySessionInfo` (not exported) | `IdbQuerySessionInfo` (authored fresh) |
| `DebugCheckResult` | `IdbAdminCheckResult` |
| `DebugTransactResult` / transact ack | `IdbAdminDebugTransactResult` / `IdbAdminTransactResult` |
| `ImpersonationOpts` | `IdbAdminImpersonation` |
| `FileOpts`, `UploadFileResponse`, `DeleteFileResponse` | `IdbStorageFileOpts`, `IdbStorageUploadResult`, `IdbStorageDeleteResult` |
| `CreateReadStreamOpts` / `CreateWriteStreamOpts`, the stream handles | `IdbStreamReadOpts` / `IdbStreamWriteOpts`, `IdbReadableStream` / `IdbWritableStream` |
| `User` | `IdbAuthUser` |

### Implementation approach (proposal)

```
src/admin/
  init.ts      # owns @instantdb/admin; builds the composed adminDb
  query.ts     # query + subscribeQuery over shapeResult from ../query
  webhooks.ts  # adminDb.webhooks — /webhooks surface, token-wired
  types.ts     # the boundary module: renames live here, nowhere else
  index.ts
```

`shapeResult` is imported from `query/` — the admin surface contains **zero shaping logic** of its own. `asUser` re-runs the same composition over the scoped official instance, which is what keeps every treatment intact on the scoped db.

---

## 7. Phased implementation roadmap

### Phase A1 — `init` + the data plane (global phase 6)

Done when: server reads are dux-shaped with no `init` injection anywhere; type + runtime suites green.

- [x] `init({ appId, adminToken, schema })` owning the optional peer
- [x] `query` with `shapeResult` + typed `ruleParams` opts
- [x] `subscribeQuery` with per-emission shaping; callback + async-iterator contracts
- [x] `IdbQuerySubscription` + data-plane types
- [x] runtime suite: shaping parity with client fixtures (same query, same shape)

### Phase A2 — typed tx + debug (global phase 6)

- [x] `adminDb.tx` / `transact` via the shared tx machinery (`IdbTxChunkInput` accepted)
- [x] `debugQuery` (shaped `result`) / `debugTransact` with typed `ruleParams`; `IdbAdminCheckResult`
- [x] `.dx.test.ts`: tx + query completions and where-key diagnostics on the admin surface

### Phase A3 — `asUser` + pass-throughs (global phase 6)

- [x] `asUser` returning the composed dux db (all treatments intact — locked by type test)
- [x] `auth.*` pass-through, verbatim verbs
- [x] `storage.*` / `streams.*` / `rooms.getPresence` pass-throughs + renamed types
- [x] compat test: dux `adminDb` satisfies what `@instantdb/resumable-stream` consumes

### Phase A4 — `adminDb.webhooks` (global phase 6; after webhooks H3)

- [x] expose the `/webhooks` surface token-wired at `adminDb.webhooks`
- [x] type test: identical surface to `/webhooks` `init({ appId, adminToken })`
