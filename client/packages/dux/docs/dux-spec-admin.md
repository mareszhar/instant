updated: 2026-06-11
status: spec — contracts are binding; implementation approaches are proposals in their service

# dux spec — `/admin`

The full server surface: the dux data plane over `@instantdb/admin`, typed tx and debug, `asUser`, the precise official verbs kept as pass-throughs, and `adminDb.webhooks`. Framework-agnostic, token-scoped, never bundled client-side.

Conventions: [dux-conventions.md](./dux-conventions.md) · Principles: [dux-vision.md §2](./dux-vision.md#2-design-principles) · Data-plane contracts: [dux-spec-root.md](./dux-spec-root.md)

## Implementation status

| Phase | Scope | Global phase | Status |
|---|---|---|---|
| A1 | `init` + the data plane: `query`, `subscribeQuery` | 6 | ☐ not started |
| A2 | Typed tx + debug | 6 | ☐ not started |
| A3 | `asUser` + pass-throughs | 6 | ☐ not started |
| A4 | `adminDb.webhooks` | 6 | ☐ not started |

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

- **`tx` / `transact`** — the typed chain from the [root spec §5](./dux-spec-root.md#5-typed-tx): schema-typed `ruleParams`, dot-path `.link`. One machinery, both runtimes.
- **`debugQuery` / `debugTransact`** — pass-throughs with typed `ruleParams`; check-result types renamed (`IdbAdminCheckResult`).

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
| `tx` / `transact` | the typed tx chain |
| `debugQuery` / `debugTransact` | pass-through, typed `ruleParams`, `IdbAdminCheckResult` |
| `asUser({ email \| token \| guest })` | returns the same dux admin db, permission-scoped |
| `auth.*` | pass-through, official verbs verbatim |
| `storage.*` / `streams.*` / `rooms.getPresence` | pass-through verbs, renamed types |
| `webhooks` | the `/webhooks` surface, token-wired |

Type renames in this surface's boundary module (pattern: [conventions §8](./dux-conventions.md#8-the-rename-table)):

| Official | dux |
|---|---|
| `SubscribeQueryResponse` | `IdbQuerySubscription` |
| `DebugCheckResult` | `IdbAdminCheckResult` |
| `FileOpts` (and storage option/result types) | `IdbStorageFileOpts`, `IdbStorage*` |
| stream types | `IdbStream*` |
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

- [ ] `init({ appId, adminToken, schema })` owning the optional peer
- [ ] `query` with `shapeResult` + typed `ruleParams` opts
- [ ] `subscribeQuery` with per-emission shaping; callback + async-iterator contracts
- [ ] `IdbQuerySubscription` + data-plane types
- [ ] runtime suite: shaping parity with client fixtures (same query, same shape)

### Phase A2 — typed tx + debug (global phase 6)

- [ ] `adminDb.tx` / `transact` via the shared tx machinery
- [ ] `debugQuery` / `debugTransact` with typed `ruleParams`; `IdbAdminCheckResult`
- [ ] `.dx.test.ts`: tx completions on the admin surface (queryGroup with the client suite)

### Phase A3 — `asUser` + pass-throughs (global phase 6)

- [ ] `asUser` returning the composed dux db (all treatments intact — locked by type test)
- [ ] `auth.*` pass-through, verbatim verbs
- [ ] `storage.*` / `streams.*` / `rooms.getPresence` pass-throughs + renamed types
- [ ] compat test: dux `adminDb` satisfies what `@instantdb/resumable-stream` consumes

### Phase A4 — `adminDb.webhooks` (global phase 6; after webhooks H3)

- [ ] expose the `/webhooks` surface token-wired at `adminDb.webhooks`
- [ ] type test: identical surface to `/webhooks` `init({ appId, adminToken })`
