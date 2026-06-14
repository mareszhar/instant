/**
 * Type-shape regression for the `Cursors` `room` prop. A room handle is often
 * stored in reactive state (a Pinia store, `reactive()`), which unwraps its
 * deep `core`/reactor types — a *concrete* room prop would then reject it,
 * forcing a `markRaw` at the call site. The prop must stay loose enough to
 * accept the handle however it is stored (no ceremony), while still being a
 * room-shaped object.
 */
import type { RoomsOf } from '@instantdb/core'
import type { AppSchema } from '@test'
import type { UnwrapNestedRefs } from 'vue'
import type { InstantDuxRoom } from '../InstantDuxRoom.js'
import type { Cursors } from './Cursors.js'
import { expectTypeOf, it } from 'vitest'

type Room = InstantDuxRoom<AppSchema, RoomsOf<AppSchema>, 'workspace'>
type CursorsRoomProp = NonNullable<InstanceType<typeof Cursors>['$props']['room']>

it('Cursors accepts a room handle plain or reactive/Pinia-wrapped', () => {
  // The plain handle.
  expectTypeOf<Room>().toExtend<CursorsRoomProp>()
  // The same handle read back through reactive()/Pinia, with its deep reactor
  // type unwrapped. A concrete room prop rejects this; the loose prop must not.
  expectTypeOf<UnwrapNestedRefs<Room>>().toExtend<CursorsRoomProp>()
})
