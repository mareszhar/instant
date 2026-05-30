import { defineQuery, i, init } from '../index.js'

const schema = i.schema({
  entities: {
    users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),
    workspaces: i.entity({
      name: i.string().indexed(),
      inviteCode: i.string().unique().indexed(),
      createdAt: i.date().indexed(),
    }),
    memberships: i.entity({
      createdAt: i.date().indexed(),
    }),
    tasks: i.entity({
      title: i.string().indexed(),
      isDone: i.boolean().indexed(),
      createdAt: i.date().indexed(),
    }),
  },
  links: {
    membershipWorkspace: {
      forward: { on: 'memberships', has: 'one', label: 'ownerWorkspace' },
      reverse: { on: 'workspaces', has: 'many', label: 'ownedMemberships' },
    },
    membershipUser: {
      forward: { on: 'memberships', has: 'one', label: 'ownerUser' },
      reverse: { on: 'users', has: 'many', label: 'ownedMemberships' },
    },
    taskWorkspace: {
      forward: { on: 'tasks', has: 'one', label: 'ownerWorkspace' },
      reverse: { on: 'workspaces', has: 'many', label: 'ownedTasks' },
    },
    taskAssignee: {
      forward: { on: 'tasks', has: 'one', label: 'assignee' },
      reverse: { on: 'users', has: 'many', label: 'assignedTasks' },
    },
  },
})

type AppSchema = typeof schema

const q = defineQuery<AppSchema>()
const db = init({ appId: 'test', schema })

// TESTS (INDIRECT):

const queryObjectOne = {
  workspaces: {},
  /* cursor */
}

const _queryOnce = db.queryOnce(queryObjectOne)
const _queryOnceX = db.queryOnceX(queryObjectOne)
const _useQuery = db.useQuery(queryObjectOne)
const _useQueryX = db.useQueryX(queryObjectOne)
const _useInfiniteQuery = db.useInfiniteQuery(queryObjectOne)
const _useInfiniteQueryX = db.useInfiniteQueryX(queryObjectOne)
const _anyMethodWithQ = db.useQuery(() => q(queryObjectOne))

// TESTS (DIRECT):

const _queryOnceDirect = db.queryOnce({
  workspaces: {},
  // @ts-expect-error - QERR_QUERY_ROOT_KEY_UNKNOWN: nonexistentNamespace is not a valid top-level key in q() query."
  nonexistentNamespace: {},
  /* cursor */
})

interface Fruit {
  name: string
  price: number
  availableQuantity: number
}

function registerFruit(fruit: Fruit) { }

registerFruit({
  name: 'apple',
  price: 5,
  availableQuantity: 100,
})

// registerFruit({ /* cursor */ })
