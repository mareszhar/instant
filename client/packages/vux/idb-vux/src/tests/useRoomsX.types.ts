import type { RoomSchemaShape } from '@instantdb/core'
import type { ComputedRef, UnwrapRef } from 'vue'
import type { InstantVuxDatabase } from '../InstantVuxDatabase.js'
import { i } from '@instantdb/core'
import { watch } from 'vue'

const schema = i.schema({
  entities: {
    users: i.entity({
      email: i.string().indexed(),
      name: i.string(),
    }),
    workspaces: i.entity({
      title: i.string(),
    }),
  },
  links: {},
})

type Schema = typeof schema

interface Rooms extends RoomSchemaShape {
  workspace: {
    presence: {
      name: string
      typing: boolean
    }
    topics: {
      reaction: {
        emoji: string
      }
    }
  }
}

declare const db: InstantVuxDatabase<Schema, false, Rooms>

const room = db.room('workspace', 'room-1')
const explicitRoom = db.room<'workspace'>('workspace', 'room-1')
declare const piniaLikeRoom: UnwrapRef<typeof explicitRoom>
const roomIdRef: ComputedRef<string> = explicitRoom.id
const roomTypeRef: ComputedRef<'workspace'> = explicitRoom.type

watch(explicitRoom.id, (id) => {
  const currentId: string = id
  void currentId
})

watch(explicitRoom.type, (type) => {
  const currentType: 'workspace' = type
  void currentType
})

watch(piniaLikeRoom.id, (id) => {
  const currentId: string = id
  void currentId
})

const presence = db.rooms.usePresence(explicitRoom, {
  keys: ['name'],
})
const piniaLikePresence = db.rooms.usePresence(piniaLikeRoom, {
  keys: ['name'],
})

const peersFromRef = presence.peers.value
const loadingFromRef: boolean = presence.isLoading.value

const presenceX = db.rooms.usePresenceX(explicitRoom, {
  keys: ['name'],
})
const piniaLikePresenceX = db.rooms.usePresenceX(piniaLikeRoom, {
  keys: ['name'],
})

const peersFromXRef = presenceX.peers.value
const peersFromXState = presenceX.state.peers
const loadingFromXState: boolean = presenceX.state.isLoading

const typing = db.rooms.useTypingIndicator(explicitRoom, 'typing')
const typingActiveFromRef = typing.active.value
const piniaLikeTyping = db.rooms.useTypingIndicator(piniaLikeRoom, 'typing')

const typingX = db.rooms.useTypingIndicatorX(explicitRoom, 'typing')
const typingActiveFromXRef = typingX.active.value
const typingActiveFromXState = typingX.state.active
typingX.state.setActive(true)
typingX.inputProps.onKeydown(new KeyboardEvent('keydown', { key: 'a' }))

const publishReaction = db.rooms.usePublishTopic(piniaLikeRoom, 'reaction')
publishReaction({ emoji: 'fire' })

db.rooms.useTopicEffect(piniaLikeRoom, 'reaction', (event, peer) => {
  const emoji: string = event.emoji
  const name: string = peer.name

  void emoji
  void name
})

db.rooms.useSyncPresence(piniaLikeRoom, {
  name: 'Alice',
})

// @ts-expect-error - unknown presence key should fail after Vue/Pinia unwrapping
db.rooms.usePresence(piniaLikeRoom, { keys: ['missing'] })

// @ts-expect-error - invalid topic payload should fail after Vue/Pinia unwrapping
publishReaction({ missing: 'field' })

void peersFromRef
void loadingFromRef
void piniaLikePresence
void peersFromXRef
void peersFromXState
void piniaLikePresenceX
void loadingFromXState
void typingActiveFromRef
void piniaLikeTyping
void typingActiveFromXRef
void typingActiveFromXState
void roomIdRef
void roomTypeRef
void room
