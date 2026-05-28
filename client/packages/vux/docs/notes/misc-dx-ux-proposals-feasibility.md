updated: 2026-05-28
status: active

# Misc DX/UX Proposals Feasibility (`@mszr/idb-vux`)

Use this note to track additive DX/UX proposals that reduce common Vux SDK boilerplate without encoding app-specific UI opinions.

## Current status

- `queryOnceX` has now been implemented in the SDK codebase (typed authoring + namespace array massaging).
- `defineDb(...)` has now been implemented as a memoized factory for runtime-resolved app ids.
- `useAuth` now returns destructurable reactive refs (`isLoading`, `user`, `error`) for parity-style ergonomics.
- `useAuthX` has now been implemented with `refs` + `state` aliases sharing the same underlying auth data source.
- `useUser` now supports explicit requirement policy options (`clientOnly` | `yes` | `no`) with SSR-resilient defaults and init-level override.
- Room handles now use a store-friendly raw factory return with watchable computed `id`/`type` refs. `db.roomX(...)` is not currently planned because regular `db.room(...)` now covers the important room-handle ergonomics without adding a second shape.

## Implemented X API proposals

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

## Room API proposals

## P3: `db.room(...)` watchability parity tightening (implemented)

1. Value
Regular `db.room(...)` is a baseline parity API, so common Vue usage should be as close as possible to the official SDK while avoiding avoidable TypeScript gotchas.

Official Vue currently normalizes `db.room(type, id)` inputs into computed refs internally, so the runtime object returned by `db.room(...)` can be watched by passing `room.id` or `room.type` directly to Vue `watch`. However, the public class type is `ComputedRef<T> | T`, so a type-only verification of the official Vue source shows `watch(room.id, ...)` fails TypeScript overload resolution because the source might be a plain string. The same verification also shows a Vue/Pinia-unwrapped official room cannot be passed back to `usePresence` because TypeScript recurses into core internals and hits private `PersistedObject` fields.

Vux already improves the Pinia/store case by returning raw room handles with a shallow public core projection. The remaining parity-by-usage gap is making this direct watch pattern type-check:

```ts
const room = db.room('workspace', () => workspaces.current?.id)

watch(room.id, (id) => {
  console.log(id)
})

watch(room.type, (type) => {
  console.log(type)
})
```

2. Target behavior
Keep regular `db.room(...)` as the official-compatible room handle:

```ts
const room = db.room('workspace', workspaceId)

db.rooms.usePresence(room, { keys: ['name'] })
db.rooms.useTopicEffect(room, 'reaction', onReaction)
db.rooms.useTypingIndicator(room, 'chat-input')
```

Also support reactive inputs without requiring callers to use `toValue`:

```ts
const room = db.room('workspace', () => workspaces.current?.id)

watch(room.id, loadRoomSettings)
```

And keep the Vux store-friendly improvement:

```ts
export const useRoomStore = defineStore('room', () => {
  const room = db.room('workspace', () => workspaces.current?.id)
  const presence = db.rooms.usePresenceX(room, { keys: ['name'] })

  return { room, presence }
})
```

3. Feasibility
High. The implementation can keep the runtime semantics already used by official Vue (`computed(() => toValue(...))`) while narrowing the return type for rooms produced by `db.room(...)`.

Possible implementation shapes:
- Make `InstantVuxRoom.id` and `InstantVuxRoom.type` always `ComputedRef`s by normalizing in the constructor.
- Or keep the class constructor flexible but have `db.room(...)` return a narrower room-handle type whose `id` and `type` are computed refs.

The second shape preserves more compatibility for direct `new InstantVuxRoom(...)` tests or internal construction while making the public factory ergonomic.

4. Risks/tradeoffs
- Narrowing `id`/`type` to computed refs is a type-level divergence from official Vue's exported class shape, but it matches the runtime object returned by official `db.room(...)` and improves the same usage pattern.
- If users instantiate `InstantVuxRoom` directly and expect string `room.id`, constructor normalization would be a breaking change. Prefer a factory-return type if that compatibility matters.
- This does not add no-`.value` script reads for room identity; it only makes the direct Vue watch source ergonomic.

5. Outcome
Implemented via a factory-return room-handle type. `InstantVuxRoom` can still model the official-compatible constructor shape, while `db.room(...)` returns a raw handle whose `id` and `type` are computed refs.

## P4: `db.roomX(...)` (not planned for now)

1. Value
This was considered as a Vux-native room handle that follows the X mental model while remaining directly usable anywhere a regular room is accepted.

2. Current decision
Do not implement this yet. Regular `db.room(...)` now covers the important ergonomics:
- stable raw handle, safe to return from Pinia setup stores
- computed `id` and `type`, so direct `watch(room.id, ...)` and `watch(room.type, ...)` work
- assignable to `db.rooms.*` APIs and `<Cursors>`
- no `shallowRef`, `toValue`, or `skipHydrate` required in userland

That makes `roomX` comparatively low-value. Unlike query/auth X APIs, a room is already a handle, not a nested result object with multiple state fields. Since the thing users most often need to pass around is the room handle itself, destructuring an X result does not map cleanly to the normal pattern.

3. Shape considered

```ts
const room = db.roomX('workspace', () => workspaces.current?.id)

watch(room.id, loadRoomSettings)
watch(room.type, syncRoomTypeMetric)

room.refs.id.value
room.state.id

db.rooms.usePresenceX(room, { keys: ['name'] })
db.rooms.useTopicEffect(room, 'reaction', onReaction)
```

This augmented-handle shape would work, but `room.state.id` is only a marginal improvement over `room.id.value` when `state` cannot naturally be renamed to the room itself.

4. Rejected shape

```ts
const { state: room } = db.roomX('workspace', workspaceId)

db.rooms.usePresenceX(room, { keys: ['name'] }) // misleading: this would not be a room handle
```

This would look more like other X APIs, but it is misleading for rooms. `state` would be a projection of room identity, not the actual room handle accepted by `db.rooms.*` APIs or `<Cursors>`.

5. Consistency with existing X pattern
An augmented-handle `roomX` could be consistent with the raw getter state projection pattern:
- `room.id` and `room.type` would be the source refs/computed refs.
- `room.refs` would point at the same refs for explicit forwarding.
- `room.state` would be a raw getter projection over those refs.
- the room shell would be marked raw so Pinia does not hydrate SDK-owned room internals.

The inconsistency is ergonomic rather than technical: query/auth X APIs return result objects, while room APIs need the returned value to remain the primary handle.

6. What it would enable beyond regular `db.room(...)`
Only small conveniences:
- no-`.value` room identity reads in script:

```ts
const room = db.roomX('workspace', () => workspaces.current?.id)

if (room.state.id) {
  console.log(room.state.id)
}
```

- ref forwarding from composables without inventing a local shape:

```ts
function useCurrentRoom() {
  const room = db.roomX('workspace', () => workspaces.current?.id)
  return { room, ...room.refs }
}
```

These are not enough to justify a new API while regular `db.room(...)` is already store-friendly and watchable.

7. Revisit criteria
Reconsider only if room handles gain more SDK-owned reactive state than `id`/`type`, or if users repeatedly need a first-party room identity projection in stores/composables. Until then, keeping one excellent regular room API is clearer.

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
