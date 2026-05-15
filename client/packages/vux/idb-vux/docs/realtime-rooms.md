# Realtime Rooms and Components

Audience: app developers building ephemeral realtime UX.

`@mszr/idb-vux` exposes room primitives for presence, topics, and typing, plus auth/cursor components.

## Rooms

```ts
const room = db.room('project', projectId)
```

## Presence

```ts
const presence = db.rooms.usePresence(room, {
  keys: ['name', 'cursor'],
})

db.rooms.useSyncPresence(room, {
  name: profile.value.name,
})
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
