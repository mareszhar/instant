import type { InstantVuxDatabase } from '../InstantVuxDatabase.js'
import { i } from '@instantdb/core'
import { defineQuery } from '../index.js'

const schema = i.schema({
  entities: {
    users: i.entity({
      email: i.string().indexed(),
      name: i.string(),
    }),
    quests: i.entity({
      title: i.string(),
      status: i.string().indexed(),
      priority: i.number().indexed(),
      createdAt: i.date(),
    }),
  },
  links: {
    questAssignee: {
      forward: {
        on: 'quests',
        has: 'one',
        label: 'assignee',
      },
      reverse: {
        on: 'users',
        has: 'many',
        label: 'assignedQuests',
      },
    },
    userGuildmates: {
      forward: {
        on: 'users',
        has: 'many',
        label: 'guildmates',
      },
      reverse: {
        on: 'users',
        has: 'many',
        label: 'guildmatesOf',
      },
    },
  },
})

type Schema = typeof schema

const q = defineQuery<Schema>()

const transparentQuery = q({
  quests: {
    assignee: {},
    $: {
      where: {
        'status': 'pending',
        'priority': { $gte: 2 },
        'assignee.email': { $ilike: '%guild%' },
      },
    },
  },
})

q({
  quests: {
    $: {
      where: {
        title: { $like: '%dragon%' },
      },
    },
  },
})

q({
  quests: {
    $: {
      where: {
        'assignee.name': 'Ari',
        'assignee.assignedQuests.priority': { $gte: 1 },
        'assignee.guildmates.email': { $ilike: '%guild%' },
      },
    },
  },
})

q({
  quests: {
    $: {
      where: q.where('quests', {
        'status': 'done',
        'assignee.id': { $isNull: false },
      }),
    },
  },
})

q({
  quests: {
    $: {
      where: {
        // Beyond the 2-hop strict cap: accepted through soft fallback.
        'assignee.assignedQuests.assignee.email': { $ilike: '%guild%' },
      },
    },
  },
})

q({
  quests: {
    assignee: {},
    $: {
      where: {
        // @ts-expect-error - unknown linked field should fail directly in q()
        'assignee.lol': 'yes',
      },
    },
  },
})

q({
  quests: {
    assignee: {},
    $: {
      where: {
        // @ts-expect-error - linked namespace attrs should be validated in q()
        'assignee.notAnAttributeInLinkedNamespace': 'x',
      },
    },
  },
})

q({
  quests: {
    assignee: {},
    $: {
      where: {
        // @ts-expect-error - unknown linked field
        'assignee.unknownField': 'x',
      },
    },
  },
})

q({
  quests: {
    $: {
      where: {
        // @ts-expect-error - unknown linked field within strict 2-hop typing
        'assignee.assignedQuests.unknownField': 'x',
      },
    },
  },
})

q.where('quests', {
  // @ts-expect-error - $like only valid on string fields
  priority: { $like: '%high%' },
})

q.where('quests', {
  // @ts-expect-error - non-indexed string field cannot use comparison operators
  title: { $gte: 'archived' },
})

q.where('quests', {
  // @ts-expect-error - unknown where operator
  title: { $doesNotExist: 'x' },
})

q.where('quests', {
  // @ts-expect-error - unknown where operator even in soft fallback keys
  'assignee.assignedQuests.assignee.email': { $doesNotExist: 'x' },
})

q({
  quests: {
    $: {
      where: {
        // @ts-expect-error - non-indexed string field cannot use comparison operators in transparent q()
        title: { $gte: 'archived' },
      },
    },
  },
})

q({
  quests: {
    $: {
      where: {
        // @ts-expect-error - unknown where operator in transparent q()
        title: { $doesNotExist: 'x' },
      },
    },
  },
})

declare const db: InstantVuxDatabase<Schema, false>

const queryFromConst = db.useQuery(transparentQuery)
const firstAssigneeIdFromConst: string | undefined = queryFromConst.data.value?.quests[0]?.assignee?.id
const firstQuestTitleFromConst: string | undefined = queryFromConst.data.value?.quests[0]?.title

const readonlyQuestFields = ['id'] as const
const readonlyStatuses = ['pending', 'done'] as const
const readonlyWhereGroups = [
  { status: { $in: readonlyStatuses } },
  { priority: { $gte: 2 } },
] as const

const readonlyArraysQuery = q({
  quests: {
    $: {
      fields: readonlyQuestFields,
      where: {
        and: readonlyWhereGroups,
      },
    },
  },
})

const queryFromReadonlyArrays = db.useQuery(readonlyArraysQuery)
const firstQuestIdFromReadonlyArrays: string | undefined = queryFromReadonlyArrays.data.value?.quests[0]?.id
// @ts-expect-error - readonly fields should still narrow selected attrs
const firstQuestTitleFromReadonlyArrays: string | undefined = queryFromReadonlyArrays.data.value?.quests[0]?.title

const queryOnceFromReadonlyArrays = db.queryOnce(readonlyArraysQuery)
type QueryOnceFromReadonlyArraysPayload = Awaited<typeof queryOnceFromReadonlyArrays>
declare const queryOnceFromReadonlyArraysPayload: QueryOnceFromReadonlyArraysPayload
const firstQueryOnceIdFromReadonlyArrays: string | undefined = queryOnceFromReadonlyArraysPayload.data.quests[0]?.id
// @ts-expect-error - readonly fields should still narrow queryOnce selected attrs
const firstQueryOnceTitleFromReadonlyArrays: string | undefined = queryOnceFromReadonlyArraysPayload.data.quests[0]?.title

const factoryQuery = q({
  quests: {
    assignee: {},
    $: {
      where: {
        'assignee.email': { $ilike: '%guild%' },
      },
    },
  },
})

const queryFromFactory = db.useQuery(() => factoryQuery)

const firstAssigneeIdFromFactory: string | undefined = queryFromFactory.data.value?.quests[0]?.assignee?.id
const firstQuestTitleFromFactory: string | undefined = queryFromFactory.data.value?.quests[0]?.title

const queryFromInlineQ = db.useQuery(() => q({
  quests: {
    assignee: {},
    $: {
      where: {
        'assignee.email': { $ilike: '%guild%' },
      },
    },
  },
}))

const firstAssigneeIdFromInlineQ: string | undefined = queryFromInlineQ.data.value?.quests[0]?.assignee?.id
const firstQuestTitleFromInlineQ: string | undefined = queryFromInlineQ.data.value?.quests[0]?.title

declare const maybeAssigneeId: string | undefined
const queryWithOptionalWhereValue = q({
  quests: {
    assignee: {},
    $: {
      where: {
        'assignee.id': maybeAssigneeId,
        'status': maybeAssigneeId ? 'pending' : undefined,
      },
    },
  },
})

const queryFromOptionalWhereValue = db.useQuery(() => queryWithOptionalWhereValue)
const firstAssigneeIdFromOptionalWhereValue: string | undefined = queryFromOptionalWhereValue.data.value?.quests[0]?.assignee?.id
const firstQuestTitleFromOptionalWhereValue: string | undefined = queryFromOptionalWhereValue.data.value?.quests[0]?.title

void firstAssigneeIdFromConst
void firstQuestTitleFromConst
void firstQuestIdFromReadonlyArrays
void firstQueryOnceIdFromReadonlyArrays
void firstAssigneeIdFromFactory
void firstQuestTitleFromFactory
void firstAssigneeIdFromInlineQ
void firstQuestTitleFromInlineQ
void firstAssigneeIdFromOptionalWhereValue
void firstQuestTitleFromOptionalWhereValue
