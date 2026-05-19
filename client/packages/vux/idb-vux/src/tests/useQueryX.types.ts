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

const query = db.useQueryX({
  quests: {
    assignee: {},
    $: {
      where: {
        status: 'pending',
      },
    },
  },
})

const loadingFromRef: boolean = query.isLoading.value
const loadingFromState: boolean = query.state.isLoading

const firstQuestTitleFromRef: string | undefined = query.quests.value[0]?.title
const firstAssigneeEmailFromRef: string | undefined = query.quests.value[0]?.assignee?.email
const firstQuestTitleFromState: string | undefined = query.state.quests[0]?.title

// @ts-expect-error - X state is a readonly projection over refs
query.state.isLoading = false

const queryFromQ = db.useQueryX(q({
  quests: {
    assignee: {},
    $: {
      where: {
        'assignee.id': maybeAssigneeId,
      },
    },
  },
}))

const firstQuestTitleFromQFactoryRef: string | undefined = queryFromQ.quests.value[0]?.title
const firstQuestTitleFromQFactoryState: string | undefined = queryFromQ.state.quests[0]?.title

const queryFromFactory = db.useQueryX(() => ({
  quests: {
    assignee: {},
    $: {
      where: {
        'assignee.id': maybeAssigneeId,
      },
    },
  },
}))

const loadingFromPlainFactory: boolean = queryFromFactory.isLoading.value
const firstQuestTitleFromPlainFactory: string | undefined = queryFromFactory.quests.value[0]?.title
const firstAssigneeIdFromPlainFactoryData: string | undefined = queryFromFactory.data.value?.quests[0]?.assignee?.id

const { quests, isLoading, state: queryState } = db.useQueryX({
  quests: {
    assignee: {},
  },
})

const questsFromDestructuredRef: string | undefined = quests.value[0]?.title
const loadingFromDestructuredRef: boolean = isLoading.value
const questsFromDestructuredState: string | undefined = queryState.quests[0]?.title

const spreadRefs = { ...query.refs }
const firstQuestTitleFromSpreadRefs: string | undefined = spreadRefs.quests.value[0]?.title

db.useQueryX({
  // @ts-expect-error - unknown namespace should fail in useQueryX plain object authoring
  unknownNamespace: {},
})

// @ts-expect-error - unknown where key should fail directly in useQueryX plain object authoring
db.useQueryX({
  quests: {
    $: {
      where: {
        notAField: 'x',
      },
    },
  },
})

// @ts-expect-error - unknown where operator should fail in useQueryX plain object authoring
db.useQueryX({
  quests: {
    $: {
      where: {
        title: {
          $doesNotExist: 'x',
        },
      },
    },
  },
})

// @ts-expect-error - $like is string-only and should fail in useQueryX factory authoring
db.useQueryX(() => ({
  quests: {
    $: {
      where: {
        priority: {
          $like: '%high%',
        },
      },
    },
  },
}))

// @ts-expect-error - linked namespace attrs should be validated in useQueryX
db.useQueryX({
  quests: {
    assignee: {},
    $: {
      where: {
        'assignee.notAnAttributeInLinkedNamespace': 'x',
      },
    },
  },
})

void loadingFromRef
void loadingFromState
void firstQuestTitleFromRef
void firstAssigneeEmailFromRef
void firstQuestTitleFromState
void firstQuestTitleFromQFactoryRef
void firstQuestTitleFromQFactoryState
void loadingFromPlainFactory
void firstQuestTitleFromPlainFactory
void firstAssigneeIdFromPlainFactoryData
void questsFromDestructuredRef
void loadingFromDestructuredRef
void questsFromDestructuredState
void firstQuestTitleFromSpreadRefs
