import type { UnwrapRef } from 'vue'
import type { SignedIn, SignedOut } from '../index.js'
import type { InstantVuxDatabase } from '../InstantVuxDatabase.js'
import { i } from '@instantdb/core'
import { defineDb, init } from '../index.js'

const schema = i.schema({
  entities: {
    todos: i.entity({
      title: i.string(),
      isDone: i.boolean(),
      createdAt: i.date(),
    }),
  },
  links: {},
})

type Schema = typeof schema

const useDb = defineDb({
  schema,
  firstPartyPath: '/api/instant',
  getAppId: () => 'app-id',
})

const strictDb = useDb()
const strictTypedDb: InstantVuxDatabase<Schema, false> = strictDb
declare const piniaLikeStrictDb: UnwrapRef<typeof strictDb>
const piniaLikeStrictTypedDb: InstantVuxDatabase<Schema, false> = piniaLikeStrictDb

const signedInProps: InstanceType<typeof SignedIn>['$props'] = {
  db: piniaLikeStrictDb,
}
const signedOutProps: InstanceType<typeof SignedOut>['$props'] = {
  db: piniaLikeStrictDb,
}

const initDb = init({
  appId: 'app-id',
  schema,
})
declare const piniaLikeInitDb: UnwrapRef<typeof initDb>
const piniaLikeInitTypedDb: InstantVuxDatabase<Schema, false> = piniaLikeInitDb
piniaLikeInitDb.useAuth()

const useDateObjectsDb = defineDb({
  schema,
  useDateObjects: true,
  getAppId: () => 'app-id',
})

const dbWithDateObjects = useDateObjectsDb()
const strictDateObjectsTypedDb: InstantVuxDatabase<Schema, true> = dbWithDateObjects

const useDbNullable = defineDb({
  schema,
  getAppId: () => undefined,
  missingAppId: null,
})

const nullableDb = useDbNullable()
const nullableTypedDb: InstantVuxDatabase<Schema, false> | null = nullableDb

// @ts-expect-error - nullable useDb return cannot be assigned to non-null db type
const shouldFailNonNullAssign: InstantVuxDatabase<Schema, false> = nullableDb

void strictTypedDb
void piniaLikeStrictTypedDb
void signedInProps
void signedOutProps
void piniaLikeInitTypedDb
void strictDateObjectsTypedDb
void nullableTypedDb
void shouldFailNonNullAssign
