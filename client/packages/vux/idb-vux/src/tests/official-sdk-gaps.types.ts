/**
 * official-sdk-gaps.types.ts
 *
 * Verifies claimed TypeScript gaps in the official @instantdb/vue SDK.
 * Run: pnpm typecheck (tsc --noEmit checks this file)
 *
 * Labels: CONFIRMED GAP, NOT A GAP
 */

import type { InstaQLEntity } from '@instantdb/core'
import type { InstantVueDatabase } from '@instantdb/vue'
import { i, id } from '@instantdb/core'

// ─── Schema ─────────────────────────────────────────────────────────────────

const schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      name: i.string().indexed(),
    }),
    todos: i.entity({
      title: i.string().indexed(),
      isDone: i.boolean().indexed(),
    }),
  },
  links: {
    todoOwner: {
      forward: { on: 'todos', has: 'one', label: 'owner' },
      reverse: { on: '$users', has: 'many', label: 'ownedTodos' },
    },
  },
  rooms: {
    chat: {
      presence: i.entity({
        name: i.string(),
        typing: i.boolean().optional(),
      }),
      topics: {
        emoji: i.entity({ value: i.string() }),
      },
    },
  },
})

type Schema = typeof schema

declare const db: InstantVueDatabase<Schema>

// ─── CONFIRMED GAP 1: ruleParams — accepts any object, no schema validation ─
// RuleParams = { [key: string]: any } — every call below should be a TS error
// but none of them are. ruleParams is fully untyped.

db.tx.todos[id()]!.ruleParams({ completelyMade: 'up', alsoWrong: 123 })
db.tx.$users[id()]!.ruleParams({ anyProp: true, evenThis: null })

// ─── CONFIRMED GAP 2: InstaQLEntity — no support for $: { fields: [...] } ──
// InstaQLEntity's 3rd param is InstaQLEntitySubquery, which only allows link
// labels as keys. Passing $: { fields: [...] } is rejected with a type error.
// There is no 1:1 mapping between how queries are authored and how InstaQLEntity
// is typed for field narrowing.

// @ts-expect-error — $ is not a valid subquery key; InstaQLEntitySubquery only allows link labels
type _AttemptedNarrow = InstaQLEntity<Schema, 'todos', { $: { fields: ['isDone'] } }>

// The actual way to narrow requires the 4th positional type param — non-obvious,
// not documented, and inconsistent with query authoring style:
type ActuallyNarrowTodo = InstaQLEntity<Schema, 'todos', {}, ['isDone']>
declare const actuallyNarrow: ActuallyNarrowTodo

// isDone is present:
const _isDonePresent: boolean = actuallyNarrow.isDone

// title should be absent — uncomment to verify the 4th-param narrowing works:
// @ts-expect-error — title excluded by field narrowing via 4th param
const _titleAbsent: string = actuallyNarrow.title

// ─── NOT A GAP: Room type names ARE validated ────────────────────────────────

// @ts-expect-error — 'nonExistentRoom' is not a declared room type
db.room('nonExistentRoom', 'id')

// Valid room type passes:
const room = db.room('chat', 'room-1')

// ─── NOT A GAP: Presence shape IS typed from schema ──────────────────────────
// useSyncPresence accepts Partial<PresenceShape>, so partial data is valid.
// But completely wrong fields still fail.

// @ts-expect-error — unknownField is not in the chat presence schema
db.rooms.useSyncPresence(room, { unknownField: 'x' })

// Partial presence data (missing name) is valid because Partial<> is used:
db.rooms.useSyncPresence(room, { typing: true })

// Full presence data also valid:
db.rooms.useSyncPresence(room, { name: 'Mares', typing: false })

// ─── NOT A GAP: .create() required fields ARE enforced ───────────────────────

// @ts-expect-error — title is required and missing
db.tx.todos[id()]!.create({ isDone: false })

// Valid create passes:
db.tx.todos[id()]!.create({ title: 'hello', isDone: false })

// ─── NOT A GAP: link labels in .link() ARE validated ─────────────────────────

// @ts-expect-error — 'nonExistentLink' is not a valid link label for todos
db.tx.todos[id()]!.link({ nonExistentLink: 'some-id' })

// Valid link passes:
db.tx.todos[id()]!.link({ owner: 'some-user-id' })

// ─── Suppress unused-var noise ───────────────────────────────────────────────
void _isDonePresent
