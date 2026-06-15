import type { LinkAttrDef, PresenceOf, ResolveAttrs, RoomsOf, TopicsOf } from '@instantdb/core'
import type { IdbSchema } from './defineSchema.js'
import type { IdbRegisteredSchema } from './register.js'
import type { Expand } from './util.js'

/** A namespace name in the schema. */
export type IdbNamespaceName<S extends IdbSchema = IdbRegisteredSchema>
  = keyof S['entities'] & string

/**
 * The bare entity: `id` + fields only. Links live *between* entities, so the
 * plain entity has none — `IdbEntityWithLinks` adds them, queries shape them.
 */
export type IdbEntity<
  NS extends IdbNamespaceName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = Expand<{ id: string } & ResolveAttrs<S['entities'], NS, false>>

/**
 * The entity plus every link label, one hop, cardinality-aware
 * (`Entity[]` or `Entity | undefined`), fields-only inside — deeper shapes
 * are what queries are for.
 */
export type IdbEntityWithLinks<
  NS extends IdbNamespaceName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = Expand<
  { id: string } & ResolveAttrs<S['entities'], NS, false> & {
    [L in keyof S['entities'][NS]['links']]: S['entities'][NS]['links'][L] extends LinkAttrDef<
      infer Cardinality,
      infer Target
    >
      ? Target extends IdbNamespaceName<S>
        ? Cardinality extends 'one'
          ? IdbEntity<Target, S> | undefined
          : IdbEntity<Target, S>[]
        : never
      : never
  }
>

// ==========
// room type extractors

/**
 * Every room defined in the schema's `rooms` block, keyed by room name —
 * the schema-rooted extractor (official `RoomsOf`). Schema is the unmarked
 * root domain, so room shapes read straight off your schema.
 */
export type IdbRooms<S extends IdbSchema = IdbRegisteredSchema> = RoomsOf<S>

/** A room name in the schema. */
export type IdbRoomName<S extends IdbSchema = IdbRegisteredSchema>
  = keyof IdbRooms<S> & string

/**
 * The presence shape of a room (official `PresenceOf`) — what `usePresence`
 * peers and `db.rooms.getPresence` are typed against.
 */
export type IdbRoomPresence<
  RoomType extends IdbRoomName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = PresenceOf<S, RoomType>

/** The topics map of a room (official `TopicsOf`). */
export type IdbRoomTopics<
  RoomType extends IdbRoomName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = TopicsOf<S, RoomType>
