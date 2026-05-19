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
      createdAt: i.date().indexed(),
    }),
  },
  links: {
    questRequestor: {
      forward: {
        on: 'quests',
        has: 'one',
        label: 'requestor',
      },
      reverse: {
        on: 'users',
        has: 'many',
        label: 'requestedQuests',
      },
    },
  },
})

type Schema = typeof schema

declare const db: InstantVuxDatabase<Schema, false>
declare const maybeRequestorId: string | undefined

const q = defineQuery<Schema>()

// Shared authored shapes keep this matrix DRY across q/useQueryX/useInfiniteQueryX.
const authoredQueryObject = {
  quests: {
    requestor: {},
    $: {
      where: {
        'requestor.id': maybeRequestorId,
        'status': maybeRequestorId ? 'pending' : undefined,
      },
    },
  },
} as const

const authoredInfiniteQueryObject = {
  quests: {
    requestor: {},
    $: {
      limit: 20,
      order: {
        createdAt: 'desc',
      },
      where: {
        'requestor.id': maybeRequestorId,
      },
    },
  },
} as const

const authoredQ = q(authoredQueryObject)
const authoredInfiniteQ = q(authoredInfiniteQueryObject)

const regularQueryFromQ = db.useQuery(authoredQ)
const regularQueryFromFactory = db.useQuery(() => authoredQ)
const regularQueryFromObject = db.useQuery({
  quests: {
    requestor: {},
    $: {
      where: {
        status: 'pending',
      },
    },
  },
})

const regularInfiniteQueryFromQ = db.useInfiniteQuery(authoredInfiniteQ)
const regularInfiniteQueryFromFactory = db.useInfiniteQuery(() => authoredInfiniteQ)

const queryFromObject = db.useQueryX(authoredQueryObject)
const queryFromFactory = db.useQueryX(() => authoredQueryObject)
const queryFromQ = db.useQueryX(authoredQ)
const queryOnceXFromObject = db.queryOnceX(authoredQueryObject)
const queryOnceXFromQ = db.queryOnceX(authoredQ)

const infiniteXFromObject = db.useInfiniteQueryX(authoredInfiniteQueryObject)
const infiniteXFromFactory = db.useInfiniteQueryX(() => authoredInfiniteQueryObject)
const infiniteXFromQ = db.useInfiniteQueryX(authoredInfiniteQ)

const qRequestorEmail: string | undefined = regularQueryFromQ.data.value?.quests[0]?.requestor?.email
const regularFromFactoryRequestorName: string | undefined = regularQueryFromFactory.data.value?.quests[0]?.requestor?.name
const regularFromObjectRequestorName: string | undefined = regularQueryFromObject.data.value?.quests[0]?.requestor?.name
const regularInfiniteCanLoad: boolean = regularInfiniteQueryFromQ.canLoadNextPage.value
const regularInfiniteFactoryCanLoad: boolean = regularInfiniteQueryFromFactory.canLoadNextPage.value

const queryRequestorEmail: string | undefined = queryFromObject.quests.value[0]?.requestor?.email
const queryRequestorEmailFromState: string | undefined = queryFromObject.state.quests[0]?.requestor?.email
const queryFactoryRequestorEmail: string | undefined = queryFromFactory.quests.value[0]?.requestor?.email
const queryFromQTitle: string | undefined = queryFromQ.quests.value[0]?.title

const infiniteXRequestorEmail: string | undefined = infiniteXFromObject.quests.value[0]?.requestor?.email
const infiniteXRequestorEmailFromState: string | undefined = infiniteXFromObject.state.quests[0]?.requestor?.email
const infiniteXCanLoad: boolean = infiniteXFromObject.canLoadNextPage.value
const infiniteXFactoryRequestorName: string | undefined = infiniteXFromFactory.quests.value[0]?.requestor?.name
const infiniteXFromQTitle: string | undefined = infiniteXFromQ.quests.value[0]?.title

type QueryOnceXFromObjectPayload = Awaited<typeof queryOnceXFromObject>
type QueryOnceXFromQPayload = Awaited<typeof queryOnceXFromQ>

declare const queryOnceXFromObjectPayload: QueryOnceXFromObjectPayload
declare const queryOnceXFromQPayload: QueryOnceXFromQPayload

const queryOnceXRequestorEmail: string | undefined = queryOnceXFromObjectPayload.quests[0]?.requestor?.email
const queryOnceXFromQTitle: string | undefined = queryOnceXFromQPayload.quests[0]?.title

infiniteXFromObject.loadNextPage()

const invalidRootQuery = {
  unknownNamespace: {},
} as const

q({
  // @ts-expect-error - unknown namespace should fail in q()
  unknownNamespace: {},
})

db.useQueryX({
  // @ts-expect-error - unknown namespace should fail in useQueryX object authoring
  unknownNamespace: {},
})

db.useInfiniteQueryX({
  // @ts-expect-error - unknown namespace should fail in useInfiniteQueryX object authoring
  unknownNamespace: {},
})

db.queryOnceX({
  // @ts-expect-error - unknown namespace should fail in queryOnceX object authoring
  unknownNamespace: {},
})

// @ts-expect-error - unknown namespace should fail in q() for shared invalid root query
q(invalidRootQuery)
// @ts-expect-error - unknown namespace should fail in useQueryX for shared invalid root query
db.useQueryX(invalidRootQuery)
// @ts-expect-error - unknown namespace should fail in useInfiniteQueryX for shared invalid root query
db.useInfiniteQueryX(invalidRootQuery)
// @ts-expect-error - unknown namespace should fail in queryOnceX for shared invalid root query
db.queryOnceX(invalidRootQuery)

const invalidLinkedAttributeQuery = {
  quests: {
    requestor: {},
    $: {
      where: {
        'requestor.notAnAttributeInLinkedNamespace': 'x',
      },
    },
  },
} as const

// @ts-expect-error - linked namespace attrs should be validated in q()
q(invalidLinkedAttributeQuery)
// @ts-expect-error - linked namespace attrs should be validated in useQueryX
db.useQueryX(invalidLinkedAttributeQuery)
// @ts-expect-error - linked namespace attrs should be validated in useInfiniteQueryX
db.useInfiniteQueryX(invalidLinkedAttributeQuery)
// @ts-expect-error - linked namespace attrs should be validated in queryOnceX
db.queryOnceX(invalidLinkedAttributeQuery)

const invalidWhereKeyQuery = {
  quests: {
    $: {
      where: {
        notAField: 'x',
      },
    },
  },
} as const

// @ts-expect-error - unknown where key should fail in q()
q(invalidWhereKeyQuery)
// @ts-expect-error - unknown where key should fail in useQueryX object authoring
db.useQueryX(invalidWhereKeyQuery)
// @ts-expect-error - unknown where key should fail in useInfiniteQueryX object authoring
db.useInfiniteQueryX(invalidWhereKeyQuery)
// @ts-expect-error - unknown where key should fail in queryOnceX object authoring
db.queryOnceX(invalidWhereKeyQuery)

const invalidOperatorQuery = {
  quests: {
    $: {
      where: {
        title: {
          $doesNotExist: 'x',
        },
      },
    },
  },
} as const

// @ts-expect-error - invalid where operator should fail in q()
q(invalidOperatorQuery)
// @ts-expect-error - invalid where operator should fail in useQueryX
db.useQueryX(invalidOperatorQuery)
// @ts-expect-error - invalid where operator should fail in useInfiniteQueryX
db.useInfiniteQueryX(invalidOperatorQuery)
// @ts-expect-error - invalid where operator should fail in queryOnceX
db.queryOnceX(invalidOperatorQuery)

void qRequestorEmail
void regularFromFactoryRequestorName
void regularFromObjectRequestorName
void regularInfiniteCanLoad
void regularInfiniteFactoryCanLoad
void queryRequestorEmail
void queryRequestorEmailFromState
void queryFactoryRequestorEmail
void queryFromQTitle
void infiniteXRequestorEmail
void infiniteXRequestorEmailFromState
void infiniteXCanLoad
void infiniteXFactoryRequestorName
void infiniteXFromQTitle
void queryOnceXRequestorEmail
void queryOnceXFromQTitle
