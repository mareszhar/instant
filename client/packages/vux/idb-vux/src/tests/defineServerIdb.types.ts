import type { H3Event } from 'h3'
import type { InstantServerDb } from '../nuxt.js'
import { init } from '@instantdb/admin'
import { i } from '@instantdb/core'
import { defineServerIdb } from '../nuxt.js'

const schema = i.schema({
  entities: {
    users: i.entity({
      email: i.string().indexed(),
    }),
    tasks: i.entity({
      title: i.string().indexed(),
      isDone: i.boolean().indexed(),
    }),
  },
  links: {
    taskAssignee: {
      forward: {
        on: 'tasks',
        has: 'one',
        label: 'assignee',
      },
      reverse: {
        on: 'users',
        has: 'many',
        label: 'assignedTasks',
      },
    },
  },
})

type Schema = typeof schema
type AnyServerDb = InstantServerDb<Schema>
type AdminDb = InstantServerDb<Schema, 'adminDb'>
type BaseDb = InstantServerDb<Schema, 'baseDb'>
type GuestDb = InstantServerDb<Schema, 'guestDb'>
type UserDb = InstantServerDb<Schema, 'userDb'>

declare const event: H3Event

const useIdb = defineServerIdb({
  init,
  schema,
  getAppId: () => 'app-id',
  getAdminToken: () => 'admin-token',
})

function acceptsAnyServerDb(db: AnyServerDb) {
  return db
}

function acceptsAdminDb(db: AdminDb) {
  return db
}

function acceptsBaseDb(db: BaseDb) {
  return db
}

function acceptsGuestDb(db: GuestDb) {
  return db
}

function acceptsUserDb(db: UserDb) {
  return db
}

const rawDb = init({
  appId: 'app-id',
  schema,
})

// @ts-expect-error - raw admin SDK DBs are not branded as server DBs
acceptsAnyServerDb(rawDb)

const { adminDb } = useIdb(event)
adminDb.query({
  tasks: {},
})
acceptsAnyServerDb(adminDb)
acceptsAdminDb(adminDb)
// @ts-expect-error - adminDb is not a user-scoped DB
acceptsUserDb(adminDb)

// @ts-expect-error - schema-specific adminDb should reject unknown namespaces
adminDb.query({
  unknownNamespace: {},
})

const { baseDb } = useIdb(event, 'baseDb')
baseDb.query({
  tasks: {
    assignee: {},
  },
})
acceptsAnyServerDb(baseDb)
acceptsBaseDb(baseDb)
// @ts-expect-error - baseDb is not a privileged adminDb
acceptsAdminDb(baseDb)

// @ts-expect-error - schema-specific baseDb should reject unknown namespaces
baseDb.query({
  unknownNamespace: {},
})

const { guestDb } = useIdb(event, 'guestDb')
guestDb.query({
  tasks: {},
})
acceptsAnyServerDb(guestDb)
acceptsGuestDb(guestDb)
// @ts-expect-error - guestDb is not a token-scoped userDb
acceptsUserDb(guestDb)

const optionalUserDb = useIdb(event, 'userDb?')
if (optionalUserDb.userDb) {
  optionalUserDb.userDb.query({
    tasks: {},
  })
  acceptsAnyServerDb(optionalUserDb.userDb)
  acceptsUserDb(optionalUserDb.userDb)
}

const requiredUserDb = useIdb(event, 'userDb!')
requiredUserDb.userDb.query({
  tasks: {},
})
acceptsAnyServerDb(requiredUserDb.userDb)
acceptsUserDb(requiredUserDb.userDb)
// @ts-expect-error - userDb is not a privileged adminDb
acceptsAdminDb(requiredUserDb.userDb)

async function testAsyncModes() {
  const optionalUser = await useIdb(event, 'user?')
  const optionalUserEmail: string | null | undefined = optionalUser.user?.email

  if (optionalUser.userDb)
    acceptsUserDb(optionalUser.userDb)

  const requiredUser = await useIdb(event, 'user!')
  const requiredUserId: string = requiredUser.user.id
  acceptsUserDb(requiredUser.userDb)

  const all = await useIdb(event, 'all!')
  all.adminDb.query({
    tasks: {},
  })
  all.baseDb.query({
    users: {},
  })
  all.guestDb.query({
    tasks: {},
  })
  all.userDb.query({
    users: {},
  })

  acceptsAdminDb(all.adminDb)
  acceptsBaseDb(all.baseDb)
  acceptsGuestDb(all.guestDb)
  acceptsUserDb(all.userDb)
  acceptsAnyServerDb(all.adminDb)
  acceptsAnyServerDb(all.baseDb)
  acceptsAnyServerDb(all.guestDb)
  acceptsAnyServerDb(all.userDb)
  // @ts-expect-error - all.adminDb is not user-scoped
  acceptsUserDb(all.adminDb)
  // @ts-expect-error - all.userDb is not a privileged adminDb
  acceptsAdminDb(all.userDb)

  void optionalUserEmail
  void requiredUserId
}

void testAsyncModes
