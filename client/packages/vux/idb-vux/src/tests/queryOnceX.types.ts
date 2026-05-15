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
  },
})

type Schema = typeof schema

declare const db: InstantVuxDatabase<Schema, false>
declare const maybeAssigneeId: string | undefined

const q = defineQuery<Schema>()

const fromObject = db.queryOnceX({
  quests: {
    assignee: {},
    $: {
      where: {
        status: 'pending',
      },
    },
  },
})

const fromQ = db.queryOnceX(q({
  quests: {
    assignee: {},
    $: {
      where: {
        'assignee.id': maybeAssigneeId,
      },
    },
  },
}))

type QueryOnceFromObject = Awaited<typeof fromObject>
type QueryOnceFromQ = Awaited<typeof fromQ>

declare const queryOnceFromObject: QueryOnceFromObject
declare const queryOnceFromQ: QueryOnceFromQ

const firstQuestTitleFromObject: string | undefined = queryOnceFromObject.quests[0]?.title
const firstAssigneeEmailFromObject: string | undefined = queryOnceFromObject.quests[0]?.assignee?.email
const firstQuestTitleFromQ: string | undefined = queryOnceFromQ.quests[0]?.title

db.queryOnceX({
  quests: {
    $: {
      where: {
        // @ts-expect-error - unknown where key should fail directly in queryOnceX plain object authoring
        notAField: 'x',
      },
    },
  },
})

db.queryOnceX({
  quests: {
    assignee: {},
    $: {
      where: {
        // @ts-expect-error - linked namespace attrs should be validated in queryOnceX
        'assignee.notAnAttributeInLinkedNamespace': 'x',
      },
    },
  },
})

void firstQuestTitleFromObject
void firstAssigneeEmailFromObject
void firstQuestTitleFromQ
