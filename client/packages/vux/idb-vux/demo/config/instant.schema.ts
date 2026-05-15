import { i } from '@mszr/idb-vux'

const schema = i.schema({
  entities: {
    $users: i.entity({
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
    workspaceOwner: {
      forward: { on: 'workspaces', has: 'one', label: 'owner' },
      reverse: { on: '$users', has: 'many', label: 'ownedWorkspaces' },
    },
    membershipWorkspace: {
      forward: { on: 'memberships', has: 'one', label: 'workspace' },
      reverse: { on: 'workspaces', has: 'many', label: 'memberships' },
    },
    membershipUser: {
      forward: { on: 'memberships', has: 'one', label: 'user' },
      reverse: { on: '$users', has: 'many', label: 'memberships' },
    },
    taskWorkspace: {
      forward: { on: 'tasks', has: 'one', label: 'workspace' },
      reverse: { on: 'workspaces', has: 'many', label: 'tasks' },
    },
    taskAssignee: {
      forward: { on: 'tasks', has: 'one', label: 'assignee' },
      reverse: { on: '$users', has: 'many', label: 'assignedTasks' },
    },
  },
  rooms: {
    workspace: {
      presence: i.entity({
        name: i.string(),
        typing: i.boolean().optional(),
      }),
      topics: {
        reaction: i.entity({
          emoji: i.string(),
        }),
      },
    },
  },
})

type AppSchema = typeof schema

export type { AppSchema }
export default schema
