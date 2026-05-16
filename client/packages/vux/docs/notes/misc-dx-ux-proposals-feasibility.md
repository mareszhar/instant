updated: 2026-05-16
status: completed

# Misc DX/UX Proposals Feasibility (`@mszr/idb-vux`)

Use this note to track additive DX/UX proposals that reduce common Vux SDK boilerplate without encoding app-specific UI opinions.

## Current status

- `queryOnceX` has now been implemented in the SDK codebase (typed authoring + namespace array massaging).
- `defineDb(...)` has now been implemented as a memoized factory for runtime-resolved app ids.
- `useAuth` now returns destructurable reactive refs (`isLoading`, `user`, `error`) for parity-style ergonomics.
- `useAuthX` has now been implemented with `refs` + `state` aliases sharing the same underlying auth data source.
- `useUser` now supports explicit requirement policy options (`clientOnly` | `yes` | `no`) with SSR-resilient defaults and init-level override.

## Next-wave X API proposals (implemented)

Sorted by priority for progressive implementation.

## P0: `useConnectionStatusX()` (implemented)

1. Value
Creates full X-pattern consistency for app-level status signals by pairing a single status ref with `refs` + `state` access.

2. Ergonomic improvement vs regular API
Regular `useConnectionStatus()` returns one ref (`Ref<ConnectionStatus>`), which is fine but inconsistent with the broader X mental model.
`useConnectionStatusX()` would expose one predictable object:

```ts
const connectionX = db.useConnectionStatusX()
connectionX.status.value
connectionX.refs.status.value
connectionX.state.status
```

3. Usage patterns enabled
Pattern A: clean `.value`-free script guards

```ts
const { state: connection } = db.useConnectionStatusX()
if (connection.status === 'connected') {
  flushPendingWrites()
}
```

Pattern B: composable passthrough via refs

```ts
function useNetworkBadge() {
  return { ...db.useConnectionStatusX().refs }
}
```

4. Outcome
Implemented as a thin additive wrapper over existing `useConnectionStatus`.

## P1: `useLocalIdX(name)` (implemented)

1. Value
Aligns local-id consumption with the X family and reduces `.value` noise for app/device/session identity flows.

2. Ergonomic improvement vs regular API
Regular `useLocalId(name)` returns `Readonly<Ref<string | null>>`.
`useLocalIdX(name)` would preserve baseline behavior and add consistent dual access:

```ts
const localIdX = db.useLocalIdX('device')
localIdX.localId.value
localIdX.refs.localId.value
localIdX.state.localId
```

3. Usage patterns enabled
Pattern A: reactive naming + local state consumption

```ts
const local = db.useLocalIdX(() => `workspace:${workspaceId.value}`)
watchEffect(() => {
  if (local.state.localId) {
    ensurePresenceIdentity(local.state.localId)
  }
})
```

Pattern B: forwarding composable-friendly refs

```ts
function usePresenceIdentity() {
  const idX = db.useLocalIdX('presence-device')
  return { ...idX.refs }
}
```

4. Outcome
Implemented as a thin additive wrapper over current reactive `useLocalId`.

## P2: `useUserX(opts?)` (implemented)

1. Value
Completes X coverage for auth-adjacent APIs for teams that want one predictable consumption style everywhere.

2. Ergonomic improvement vs regular API
Regular `useUser(opts?)` returns a single computed ref and can throw depending on requirement mode.
`useUserX(opts?)` could expose:

```ts
const userX = db.useUserX({ requireUser: 'no' })
userX.user.value
userX.state.user
```

3. Usage patterns enabled
Pattern A: standard X object shape even when route strictness differs per screen

```ts
const userX = db.useUserX({ requireUser: 'clientOnly' })
if (userX.state.user) {
  hydratePersonalization(userX.state.user.id)
}
```

4. Tradeoffs
`useUser` semantics are stricter than most hooks (throws in some modes), so X projection must be documented carefully to avoid masking strictness expectations.

5. Outcome
Implemented for full X symmetry across auth APIs, while preserving `useUser` strictness semantics.

## Not recommended as X APIs (for now)

1. `useSyncPresence`
Side-effect only (`void`), no stable data source to project as `refs/state`.

2. `useTopicEffect`
Side-effect subscription helper (`void`), same rationale.

3. `usePublishTopic`
Command-style function handle; an X variant would likely add indirection with little UX gain.

## Proposal: `queryOnceX` (implemented)

1. Current state
`queryOnce` existed, but imperative reads still required manual namespace unwrapping (`response.data.tasks ?? []`) and did not follow the same typed authoring path as `useQueryX`.

2. Target parity behavior
Expose an ergonomic one-shot read API that feels like the X family:
- schema-aware authoring validation
- compatibility with `defineQuery`
- top-level namespace defaults to `[]`

3. Feasibility
High (now completed). Implementation is additive and piggybacks on existing `queryOnce` runtime semantics.

4. Suggested implementation
Added `db.queryOnceX(query, opts?)` that:
- accepts the same typed authoring input shape as `useQueryX`
- delegates to `queryOnce` internally
- augments response with top-level namespace array fallbacks

5. Risks/tradeoffs
- Adds one more query API surface area to explain in docs.
- Users may overuse imperative queries where reactive subscriptions would be simpler.

6. Priority
High. This closes a practical gap for mutation-adjacent reads and DX consistency.

## Proposal: `defineDb(...)` helper factory (implemented)

1. Current state
Apps repeatedly author a local `useDb` singleton composable to wire `init({ appId, schema, ... })`, runtime config lookup, and optional first-party path setup.

2. Target behavior
Offer a first-party helper that standardizes the pattern while preserving app-level control:

```ts
const useDb = defineDb({
  schema,
  getAppId: () => useRuntimeConfig().public.instantAppId,
  firstPartyPath: '/api/instant',
  missingAppId: 'throw', // or 'null'
})
```

3. Feasibility
High (completed). Built as a thin utility around `init` with no core protocol changes.

4. Suggested implementation
Implemented:
- exported `defineDb` from `@mszr/idb-vux`
- memoized `useDb`-style getter with singleton semantics
- `missingAppId` support with default `'throw'` and optional `null`
- conditional return typing (`db` vs `db | null`) based on `missingAppId`

5. Risks/tradeoffs
- API must stay minimal to avoid becoming an opinionated framework wrapper.
- Need to document when custom app-level wrappers are still preferable.

6. Priority
Completed. This removed repeated setup code and formalized a safe runtime-config pattern.

## Proposal: `useAuthX()` convenience helper (implemented)

1. Current state
Before this initiative, `useAuth()` returned a reactive object shape that did not align with `useQuery`-style destructuring ergonomics.

2. Target behavior
Ship two aligned auth ergonomics layers:

```ts
const { isLoading, user, error } = db.useAuth()

const authX = db.useAuthX()
authX.user.value
authX.state.user?.email
```

3. Feasibility
High (completed). Implemented as a light wrapper over `useAuth`.

4. Suggested implementation
Implemented:
- `useAuth` now returns destructurable refs (`isLoading`, `user`, `error`)
- `useAuthX` adds `refs` + `state` aliases for X mental-model consistency
- no derived subjective fields were added (`isSignedIn`, labels, etc.)
- `refs` and `state` read from the same unified auth source per hook instance

5. Risks/tradeoffs
- Some overlap with `useAuth` may feel redundant.
- If scope expands beyond objective fields, this can drift into subjective app logic.

6. Priority
Completed. This closed the remaining auth ergonomics inconsistency with regular APIs.

## Proposal: safer `useUser` for SSR resilience + explicit auth strictness (implemented)

1. Current state
`useUser` previously used a type assertion fallback (`undefined as User`) in server/inert runtime branches, which avoided immediate throws but could still leak unsafe runtime reads.

2. Target behavior
Keep parity-oriented guarded-route semantics while making SSR behavior explicit and safe:
- default: throw on client when missing user, return `undefined` on server (`clientOnly`)
- opt-in strict: throw on both client + server (`yes`)
- opt-out strictness: never throw, return `undefined` when missing (`no`)

3. Feasibility
High (completed). Implemented entirely in Vux SDK wrapper layer.

4. Suggested implementation
Implemented:
- `useUser({ requireUser: 'clientOnly' | 'yes' | 'no' })`
- `init/defineDb` option: `requireUserInUseUser` to set per-db default behavior
- type-safe return narrowing:
  - `yes` => `ComputedRef<User>`
  - `clientOnly`/`no` => `ComputedRef<User | undefined>`

5. Risks/tradeoffs
- Slightly larger API surface around auth semantics.
- Developers choosing strict mode (`yes`) must handle SSR throws intentionally.

6. Priority
Completed. This removes unsafe assertion behavior while preserving parity paths and SSR-resilient defaults.
