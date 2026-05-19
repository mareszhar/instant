import type { InstantVuxDatabase } from '../InstantVuxDatabase.js'
import { i } from '@instantdb/core'
import { ref } from 'vue'

const schema = i.schema({
  entities: {
    users: i.entity({
      email: i.string().indexed(),
      name: i.string(),
    }),
    posts: i.entity({
      title: i.string(),
      createdAt: i.date().indexed(),
      status: i.string().indexed(),
    }),
  },
  links: {},
})

type Schema = typeof schema

declare const db: InstantVuxDatabase<Schema, false>

const infiniteQuery = db.useInfiniteQuery({
  posts: {
    $: {
      limit: 20,
      order: {
        createdAt: 'desc',
      },
    },
  },
})

const { isLoading, error, data, canLoadNextPage } = infiniteQuery
const firstTitle: string | undefined = data.value?.posts[0]?.title
const canLoad: boolean = canLoadNextPage.value
const loading: boolean = isLoading.value
const errorMessage: string | undefined = error.value?.message

infiniteQuery.loadNextPage()

const filteredQuery = db.useInfiniteQuery(() => ({
  posts: {
    $: {
      where: {
        status: 'published',
      },
      limit: 10,
    },
  },
}))

const filteredTitle: string | undefined = filteredQuery.data.value?.posts[0]?.title

const infiniteQueryRef = ref<null | {
  posts: {
    $: {
      limit: number
      where: {
        status: string
      }
    }
  }
}>({
  posts: {
    $: {
      limit: 5,
      where: {
        status: 'draft',
      },
    },
  },
})
const infiniteOptsRef = ref({ ruleParams: { tenant: 'a' } })
const infiniteFromRef = db.useInfiniteQuery(infiniteQueryRef, infiniteOptsRef)
const infiniteFromRefTitle: string | undefined = infiniteFromRef.data.value?.posts[0]?.title

void firstTitle
void canLoad
void loading
void errorMessage
void filteredTitle
void infiniteFromRefTitle
