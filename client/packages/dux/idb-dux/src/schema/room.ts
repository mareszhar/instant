/**
 * The room constructor — a room is a realtime channel, a wholly separate
 * concept from a namespace. It has no entities, no links, no `id`s: just a
 * `presence` shape (one live entry per peer) and named `topic` shapes (one per
 * broadcast message). Both are plain field maps — there is no `singular` or
 * `ruleParams`, because a room is never queried, singularized, or perm-governed.
 *
 * `i.room` builds the official `RoomDef` core expects (presence/topics as
 * `EntityDef`s) so the room hooks and the `IdbRoom*` extractors keep working;
 * the entity-def shape is core's transport detail, never dux's vocabulary.
 *
 * Docs: [dux-spec-root.md §2.7](../../docs/dux-spec-root.md#27-rooms)
 */
import type { AttrsDefs, EntityDef as EntityDefType } from '@instantdb/core'
import type { ValidFieldBuilders } from './namespace.js'
import { i as officialI } from '@instantdb/core'

/**
 * A room's shape: a `presence` field map plus named `topic` field maps.
 *
 * `Presence`/`Topics` are deliberately unconstrained — the same reason
 * `i.namespace`'s `fields` is ([namespace.ts]): an `AttrsDefs` constraint would
 * become the literal's contextual type and degrade a bare `i.string()` to
 * `DataAttrDef<any, …>`. Validation rides a parallel arm; the return re-tightens
 * with `Extract`.
 */
export interface IdbRoomConfig<Presence, Topics> {
  /** The shape of one peer's live presence entry. */
  presence?: Presence & ValidFieldBuilders<Presence>
  /** Named broadcast channels, each the shape of one message. */
  topics?: { [T in keyof Topics]: Topics[T] & ValidFieldBuilders<Topics[T]> }
}

/**
 * What `i.room()` returns: a core `RoomDef` (presence + topics as `EntityDef`s)
 * — exactly what `RoomsOf`/`IdbRoomPresence`/`IdbRoomTopics` read.
 */
export interface IdbRoomDef<Presence, Topics> {
  presence: EntityDefType<Extract<Presence, AttrsDefs>, {}, void>
  topics: { [T in keyof Topics]: EntityDefType<Extract<Topics[T], AttrsDefs>, {}, void> }
}

/**
 * The room constructor — the single home for a realtime channel's shape.
 *
 * @example
 *   rooms: {
 *     workspace: i.room({
 *       presence: { name: i.string(), typing: i.boolean().optional() },
 *       topics: { reaction: { emoji: i.string() } },
 *     }),
 *   }
 */
export function room<Presence = {}, Topics = {}>(
  config: IdbRoomConfig<Presence, Topics>,
): IdbRoomDef<Presence, Topics> {
  const presence = officialI.entity((config.presence ?? {}) as AttrsDefs)
  const topics = Object.fromEntries(
    Object.entries((config.topics ?? {}) as Record<string, AttrsDefs>).map(
      ([name, fields]) => [name, officialI.entity(fields)],
    ),
  )
  return { presence, topics } as IdbRoomDef<Presence, Topics>
}
