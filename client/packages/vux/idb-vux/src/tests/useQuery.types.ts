import type { ValidQuery } from '@instantdb/core'
import type { InstantVuxDatabase } from '../InstantVuxDatabase.js'
import { i } from '@instantdb/core'
import { ref } from 'vue'

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

const regularQueryState = db.useQuery({
  quests: {
    assignee: {},
    $: {
      where: {
        status: 'pending',
        priority: { $gte: 2 },
      },
    },
  },
})

const { isLoading, error, data } = regularQueryState
const loadingFromDestructuredRef: boolean = isLoading.value
const errorFromDestructuredRef: { message: string } | undefined = error.value
const firstQuestTitleFromConst: string | undefined = data.value?.quests[0]?.title
const firstAssigneeEmailFromConst: string | undefined = data.value?.quests[0]?.assignee?.email

const regularFactoryState = db.useQuery(() => ({
  quests: {
    assignee: {},
    $: {
      where: {
        status: 'done',
      },
    },
  },
}))

const firstQuestTitleFromFactory: string | undefined = regularFactoryState.data.value?.quests[0]?.title
const firstAssigneeEmailFromFactory: string | undefined = regularFactoryState.data.value?.quests[0]?.assignee?.email

db.useQuery({
  // @ts-expect-error - unknown namespace should fail for regular object usage
  unknownNamespace: {},
})

const invalidRegularWhereQuery = {
  quests: {
    $: {
      where: {
        notAField: 'x',
      },
    },
  },
} as const

// @ts-expect-error - unknown where key should fail for regular query typing
const shouldRejectInvalidRegularWhere: ValidQuery<typeof invalidRegularWhereQuery, Schema> = invalidRegularWhereQuery

const usersByNameState = db.useQuery({
  users: {
    $: {
      where: {
        name: 'me',
      },
    },
  },
})

const firstUserNameFromConst: string | undefined = usersByNameState.data.value?.users[0]?.name

const queryRef = ref<null | {
  quests: {
    assignee: {}
    $: {
      where: {
        status: string
      }
    }
  }
}>({
  quests: {
    assignee: {},
    $: {
      where: {
        status: 'queued',
      },
    },
  },
})

const optsRef = ref({ keepPreviousData: true })
const queryFromRefState = db.useQuery(queryRef, optsRef)
const queryFromRefTitle: string | undefined = queryFromRefState.data.value?.quests[0]?.title

void firstQuestTitleFromConst
void firstAssigneeEmailFromConst
void firstQuestTitleFromFactory
void firstAssigneeEmailFromFactory
void firstUserNameFromConst
void queryFromRefTitle
void loadingFromDestructuredRef
void errorFromDestructuredRef
