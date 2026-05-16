# Realtime Rooms and Components

Audience: app developers building ephemeral realtime UX.

`@mszr/idb-vux` exposes room primitives for presence, topics, and typing, plus auth/cursor components.

Baseline room hooks mirror the official `@instantdb/vue` room contract (ref-first fields).
Vux also ships additive room `X` variants for `refs + state` ergonomics.
For the full additive surface index, see [DX/UX enhancements](./dx-ux-enhancements.md).

## Rooms

```ts
const room = db.room('project', projectId)
```

`type` and `id` can be plain values or reactive getters/refs.

## Presence

```ts
const presence = db.rooms.usePresence(room, {
  keys: ['name', 'cursor'],
})

const peerList = computed(() => Object.values(presence.peers.value))

db.rooms.useSyncPresence(room, () => ({
  name: profile.value.name,
  cursor: cursor.value,
}))
```

`usePresence` returns refs (`peers`, `isLoading`, `user`, `error`) plus `publishPresence`.

### Presence X (additive)

```ts
const presenceX = db.rooms.usePresenceX(room, {
  keys: ['name', 'cursor'],
})

const { peers } = presenceX.refs
const { state: presenceState } = presenceX

const peersViaRefs = computed(() => Object.values(peers.value))
const peersViaState = computed(() => Object.values(presenceState.peers))
```

## Topics

```ts
db.rooms.useTopicEffect(room, 'emoji', (event, peer) => {
  console.log('topic event', event, peer)
})

const publishEmoji = db.rooms.usePublishTopic(room, 'emoji')
publishEmoji({ value: '🔥' })
```

## Typing indicator

```ts
const typing = db.rooms.useTypingIndicator(room, 'chatTyping', {
  timeout: 1000,
  stopOnEnter: true,
})

const anyTyping = computed(() => typing.active.value.length > 0)
```

`typing.inputProps` exposes lowercase `onKeydown` and `onBlur` for `v-bind` event compatibility.

### Typing X (additive)

```ts
const typingX = db.rooms.useTypingIndicatorX(room, 'chatTyping')
const { state: typingState } = typingX

const anyTyping = computed(() => typingState.active.length > 0)
```

## Components

- `SignedIn` and `SignedOut` for auth-aware rendering
- `Cursors` for presence-driven cursor UIs

```vue
<SignedIn :db="db">
  <Cursors :room="room" />
</SignedIn>
```

## Runtime notes

- Room hooks are scope-aware and clean up subscriptions on dispose.
- Server runtime paths are inert to prevent SSR crashes.
- `X` room hooks are additive and share the same underlying room subscription source as baseline hooks.
