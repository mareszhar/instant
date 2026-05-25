import type { InstantVuxDatabase } from '../InstantVuxDatabase.js'
import { i } from '@instantdb/core'
import { defineQuery } from '../index.js'

const schema = i.schema({
  entities: {
    users: i.entity({
      email: i.string().indexed(),
    }),
    posts: i.entity({
      title: i.string(),
      createdAt: i.date().indexed(),
      status: i.string().indexed(),
    }),
  },
  links: {
    postRequestor: {
      forward: {
        on: 'posts',
        has: 'one',
        label: 'requestor',
      },
      reverse: {
        on: 'users',
        has: 'many',
        label: 'requestedPosts',
      },
    },
  },
})

type Schema = typeof schema

declare const db: InstantVuxDatabase<Schema, false>
declare const maybeStatus: string | undefined

const q = defineQuery<Schema>()

const infiniteQuery = db.useInfiniteQueryX({
  posts: {
    $: {
      limit: 20,
      order: {
        createdAt: 'desc',
      },
      where: {
        status: maybeStatus,
      },
    },
  },
})

const firstTitle: string | undefined = infiniteQuery.posts.value[0]?.title
const firstTitleFromState: string | undefined = infiniteQuery.state.posts[0]?.title
const loading: boolean = infiniteQuery.isLoading.value
const canLoad: boolean = infiniteQuery.canLoadNextPage.value

infiniteQuery.loadNextPage()

const fromQ = db.useInfiniteQueryX(q({
  posts: {
    requestor: {},
    $: {
      limit: 5,
      where: {
        'status': 'done',
        'requestor.id': 'requestor-1',
      },
    },
  },
}))

const titleFromQ: string | undefined = fromQ.posts.value[0]?.title

const fromFactory = db.useInfiniteQueryX(() => ({
  posts: {
    requestor: {},
    $: {
      limit: 10,
      where: {
        'status': maybeStatus,
        'requestor.id': maybeStatus ? 'requestor-2' : undefined,
      },
    },
  },
}))

const titleFromFactory: string | undefined = fromFactory.posts.value[0]?.title

const spreadRefs = { ...infiniteQuery.refs }
const spreadTitle: string | undefined = spreadRefs.posts.value[0]?.title
const spreadCanLoad: boolean = spreadRefs.canLoadNextPage.value

db.useInfiniteQueryX({
  posts: {
    $: {
      where: {
        // @ts-expect-error - linked namespace attrs should be validated in useInfiniteQueryX
        'requestor.notAnAttributeInLinkedNamespace': 'x',
      },
    },
  },
})

void firstTitle
void firstTitleFromState
void loading
void canLoad
void titleFromQ
void titleFromFactory
void spreadTitle
void spreadCanLoad
