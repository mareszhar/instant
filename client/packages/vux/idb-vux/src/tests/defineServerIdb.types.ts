import type {
  InstantSchemaDef,
  InstaQLResponse,
  User,
  ValidQuery,
} from '@instantdb/core'
import type { H3Event } from 'h3'
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

interface TestAdminDb<Schema extends InstantSchemaDef<any, any, any>> {
  auth: {
    verifyToken: (token: string) => Promise<User>
  }
  asUser: (options: { token: string } | { guest: true } | { email: string }) => TestAdminDb<Schema>
  query: <Q extends ValidQuery<Q, Schema>>(
    query: Q,
  ) => Promise<InstaQLResponse<Schema, Q, false>>
}

declare function init<
  Schema extends InstantSchemaDef<any, any, any>,
>(config: {
  appId: string
  adminToken?: string
  schema?: Schema
  useDateObjects?: false
}): TestAdminDb<Schema>

declare const event: H3Event

const useIdb = defineServerIdb({
  init,
  schema,
  getAppId: () => 'app-id',
  getAdminToken: () => 'admin-token',
})

const { adminDb } = useIdb(event)
adminDb.query({
  tasks: {},
})

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

// @ts-expect-error - schema-specific baseDb should reject unknown namespaces
baseDb.query({
  unknownNamespace: {},
})

const { guestDb } = useIdb(event, 'guestDb')
guestDb.query({
  tasks: {},
})

const optionalUserDb = useIdb(event, 'userDb?')
if (optionalUserDb.userDb) {
  optionalUserDb.userDb.query({
    tasks: {},
  })
}

const requiredUserDb = useIdb(event, 'userDb!')
requiredUserDb.userDb.query({
  tasks: {},
})

async function testAsyncModes() {
  const optionalUser = await useIdb(event, 'user?')
  const optionalUserEmail: string | null | undefined = optionalUser.user?.email

  const requiredUser = await useIdb(event, 'user!')
  const requiredUserId: string = requiredUser.user.id

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

  void optionalUserEmail
  void requiredUserId
}

void testAsyncModes
