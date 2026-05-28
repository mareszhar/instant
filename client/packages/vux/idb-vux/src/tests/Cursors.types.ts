import type { RoomSchemaShape } from '@instantdb/core'
import type { InstantVuxRoom } from '../InstantVuxRoom.js'
import type {
  CursorSlotProps,
  CursorsProps,
} from '../Cursors.js'
import { i } from '@instantdb/core'
import Cursors from '../Cursors.js'

type IsAny<T> = 0 extends (1 & T) ? true : false
type AssertFalse<T extends false> = T

type UntypedCursorColorIsNotAny = AssertFalse<
  IsAny<CursorSlotProps['color']>
>
type UntypedCursorPresenceIsNotAny = AssertFalse<
  IsAny<CursorSlotProps['presence']>
>

const schema = i.schema({
  entities: {
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
      typing?: boolean
    }
    topics: {}
  }
}

declare const room: InstantVuxRoom<Schema, Rooms, 'workspace'>

const cursorProps: CursorsProps<Rooms, 'workspace'> = {
  room,
  renderCursor({ color, presence }) {
    const maybeColor: string | undefined = color
    const maybeName: string | undefined = presence?.name
    const maybeTyping: boolean | undefined = presence?.typing

    // @ts-expect-error - cursor slot presence should use the room presence schema
    const missingField = presence?.missing

    void maybeColor
    void maybeName
    void maybeTyping
    void missingField

    return null
  },
}

type WorkspaceCursorsInstance = InstanceType<typeof Cursors<Rooms, 'workspace'>>
type WorkspaceCursorSlotProps = Parameters<
  NonNullable<WorkspaceCursorsInstance['$slots']['cursor']>
>[0]

declare const workspaceSlotProps: WorkspaceCursorSlotProps

const componentSlotColor: string | undefined = workspaceSlotProps.color
const componentSlotName: string | undefined = workspaceSlotProps.presence?.name
const componentSlotTyping: boolean | undefined
  = workspaceSlotProps.presence?.typing

// @ts-expect-error - component cursor slot should reject unknown presence fields
const componentSlotMissingField = workspaceSlotProps.presence?.missing

void cursorProps
void componentSlotColor
void componentSlotName
void componentSlotTyping
void componentSlotMissingField
