import type { InstantVuxDatabase } from '../InstantVuxDatabase.js'
import { i } from '@instantdb/core'

const schema = i.schema({
  entities: {
    users: i.entity({
      email: i.string().indexed(),
    }),
  },
  links: {},
})

type Schema = typeof schema

declare const db: InstantVuxDatabase<Schema, false>

const auth = db.useAuth()

const authLoading: boolean = auth.isLoading.value
const authUserId: string | undefined = auth.user.value?.id
const authErrorMessage: string | undefined = auth.error.value?.message

const { isLoading, user, error } = db.useAuth()

const loadingFromDestructuredRef: boolean = isLoading.value
const userIdFromDestructuredRef: string | undefined = user.value?.id
const errorMessageFromDestructuredRef: string | undefined = error.value?.message

void authLoading
void authUserId
void authErrorMessage
void loadingFromDestructuredRef
void userIdFromDestructuredRef
void errorMessageFromDestructuredRef
