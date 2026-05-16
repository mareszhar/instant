import type { RoomSchemaShape } from '@instantdb/core'
import type { InstantVuxDatabase } from '../InstantVuxDatabase.js'
import { i } from '@instantdb/core'

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

const presence = db.rooms.usePresence(explicitRoom, {
  keys: ['name'],
})

const peersFromRef = presence.peers.value
const loadingFromRef: boolean = presence.isLoading.value

const presenceX = db.rooms.usePresenceX(explicitRoom, {
  keys: ['name'],
})

const peersFromXRef = presenceX.peers.value
const peersFromXState = presenceX.state.peers
const loadingFromXState: boolean = presenceX.state.isLoading

const typing = db.rooms.useTypingIndicator(explicitRoom, 'typing')
const typingActiveFromRef = typing.active.value

const typingX = db.rooms.useTypingIndicatorX(explicitRoom, 'typing')
const typingActiveFromXRef = typingX.active.value
const typingActiveFromXState = typingX.state.active
typingX.state.setActive(true)
typingX.inputProps.onKeydown(new KeyboardEvent('keydown', { key: 'a' }))

void peersFromRef
void loadingFromRef
void peersFromXRef
void peersFromXState
void loadingFromXState
void typingActiveFromRef
void typingActiveFromXRef
void typingActiveFromXState
void room
