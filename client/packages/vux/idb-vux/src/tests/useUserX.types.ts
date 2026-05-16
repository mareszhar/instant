import type { User } from '@instantdb/core'
import { i } from '@instantdb/core'
import { defineDb, init } from '../index.js'

const schema = i.schema({
  entities: {
    users: i.entity({
      email: i.string().indexed(),
    }),
  },
  links: {},
})

const dbDefault = init({
  appId: 'app-id',
  schema,
})

const defaultUserFromRef = dbDefault.useUserX().user.value
const defaultUserFromState = dbDefault.useUserX().state.user
const defaultUserFromRefTyped: User | undefined = defaultUserFromRef
const defaultUserFromStateTyped: User | undefined = defaultUserFromState

// @ts-expect-error - default useUserX behavior is clientOnly (possibly undefined)
const shouldFailDefaultNonNullableFromRef: User = defaultUserFromRef
// @ts-expect-error - default useUserX behavior is clientOnly (possibly undefined)
const shouldFailDefaultNonNullableFromState: User = defaultUserFromState

const strictUserFromCallRef = dbDefault.useUserX({ requireUser: 'yes' }).user.value
const strictUserFromCallState = dbDefault.useUserX({ requireUser: 'yes' }).state.user
const strictUserFromCallRefTyped: User = strictUserFromCallRef
const strictUserFromCallStateTyped: User = strictUserFromCallState

const optionalUserFromCallRef = dbDefault.useUserX({ requireUser: 'no' }).user.value
const optionalUserFromCallState = dbDefault.useUserX({ requireUser: 'no' }).state.user
const optionalUserFromCallRefTyped: User | undefined = optionalUserFromCallRef
const optionalUserFromCallStateTyped: User | undefined = optionalUserFromCallState

// @ts-expect-error - requireUser no returns optional user
const shouldFailNoNonNullableFromRef: User = optionalUserFromCallRef
// @ts-expect-error - requireUser no returns optional user
const shouldFailNoNonNullableFromState: User = optionalUserFromCallState

const dbStrict = init({
  appId: 'app-id',
  schema,
  requireUserInUseUser: 'yes',
})

const strictUserFromInitRef = dbStrict.useUserX().user.value
const strictUserFromInitState = dbStrict.useUserX().state.user
const strictUserFromInitRefTyped: User = strictUserFromInitRef
const strictUserFromInitStateTyped: User = strictUserFromInitState

const useDbOptional = defineDb({
  schema,
  getAppId: () => 'app-id',
})

const dbMaybe = useDbOptional()
const maybeUserFromRef = dbMaybe.useUserX().user.value
const maybeUserFromState = dbMaybe.useUserX().state.user
const maybeUserFromRefTyped: User | undefined = maybeUserFromRef
const maybeUserFromStateTyped: User | undefined = maybeUserFromState

const useDbStrict = defineDb({
  schema,
  getAppId: () => 'app-id',
  requireUserInUseUser: 'yes',
})

const strictDb = useDbStrict()
const strictDbUserFromRef = strictDb.useUserX().user.value
const strictDbUserFromState = strictDb.useUserX().state.user
const strictDbUserFromRefTyped: User = strictDbUserFromRef
const strictDbUserFromStateTyped: User = strictDbUserFromState

void defaultUserFromRefTyped
void defaultUserFromStateTyped
void shouldFailDefaultNonNullableFromRef
void shouldFailDefaultNonNullableFromState
void strictUserFromCallRefTyped
void strictUserFromCallStateTyped
void optionalUserFromCallRefTyped
void optionalUserFromCallStateTyped
void shouldFailNoNonNullableFromRef
void shouldFailNoNonNullableFromState
void strictUserFromInitRefTyped
void strictUserFromInitStateTyped
void maybeUserFromRefTyped
void maybeUserFromStateTyped
void strictDbUserFromRefTyped
void strictDbUserFromStateTyped
