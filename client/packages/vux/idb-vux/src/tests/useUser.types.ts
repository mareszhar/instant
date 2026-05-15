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

type Schema = typeof schema

const dbDefault = init({
  appId: 'app-id',
  schema,
})

const defaultUser = dbDefault.useUser().value
const defaultUserTyped: User | undefined = defaultUser
// @ts-expect-error - default useUser behavior is clientOnly (possibly undefined)
const shouldFailDefaultNonNullable: User = defaultUser

const strictUserFromCall = dbDefault.useUser({ requireUser: 'yes' }).value
const strictUserFromCallTyped: User = strictUserFromCall

const optionalUserFromCall = dbDefault.useUser({ requireUser: 'no' }).value
const optionalUserFromCallTyped: User | undefined = optionalUserFromCall
// @ts-expect-error - requireUser no returns optional user
const shouldFailNoNonNullable: User = optionalUserFromCall

const dbStrict = init({
  appId: 'app-id',
  schema,
  requireUserInUseUser: 'yes',
})

const strictUserFromInit = dbStrict.useUser().value
const strictUserFromInitTyped: User = strictUserFromInit

const useDbOptional = defineDb({
  schema,
  getAppId: () => 'app-id',
})

const dbMaybe = useDbOptional()
const maybeUser = dbMaybe.useUser().value
const maybeUserTyped: User | undefined = maybeUser

const useDbStrict = defineDb({
  schema,
  getAppId: () => 'app-id',
  requireUserInUseUser: 'yes',
})

const strictDb = useDbStrict()
const strictDbUser = strictDb.useUser().value
const strictDbUserTyped: User = strictDbUser

void defaultUserTyped
void shouldFailDefaultNonNullable
void strictUserFromCallTyped
void optionalUserFromCallTyped
void shouldFailNoNonNullable
void strictUserFromInitTyped
void maybeUserTyped
void strictDbUserTyped
