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

const authX = db.useAuthX()

const loadingFromRef: boolean = authX.isLoading.value
const userIdFromRef: string | undefined = authX.user.value?.id
const errorFromRef: string | undefined = authX.error.value?.message

const loadingFromState: boolean = authX.state.isLoading
const userIdFromState: string | undefined = authX.state.user?.id
const errorFromState: string | undefined = authX.state.error?.message

// @ts-expect-error - X state is a readonly projection over refs
authX.state.isLoading = false

const { user, isLoading, error, refs, state } = db.useAuthX()

const loadingFromDestructuredRef: boolean = isLoading.value
const userIdFromDestructuredRef: string | undefined = user.value?.id
const errorFromDestructuredRef: string | undefined = error.value?.message
const userIdFromRefs: string | undefined = refs.user.value?.id
const userIdFromDestructuredState: string | undefined = state.user?.id

void loadingFromRef
void userIdFromRef
void errorFromRef
void loadingFromState
void userIdFromState
void errorFromState
void loadingFromDestructuredRef
void userIdFromDestructuredRef
void errorFromDestructuredRef
void userIdFromRefs
void userIdFromDestructuredState
