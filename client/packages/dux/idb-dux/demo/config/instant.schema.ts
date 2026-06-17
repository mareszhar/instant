import { defineSchema, i } from '@mszr/idb-dux'

export const schema = defineSchema({
  namespaces: {
    $users: i.namespace({
      fields: {
        email: i.string().unique().indexed().optional(),
      },
    }),
    workspaces: i.namespace({
      fields: {
        name: i.string().indexed(),
        inviteCode: i.string().unique().indexed(),
        createdAt: i.date().indexed(),
      },
      ruleParams: {
        inviteCode: i.string().optional(),
      },
    }),
    memberships: i.namespace({
      fields: {
        createdAt: i.date().indexed(),
      },
      ruleParams: {
        inviteCode: i.string().optional(),
      },
    }),
    tasks: i.namespace({
      fields: {
        title: i.string().indexed(),
        isDone: i.boolean().indexed(),
        createdAt: i.date().indexed(),
      },
    }),

    // >>> FOR SANDBOX EXPERIMENTS (START) <<<
    fruits: i.namespace({
      fields: {
        // A runtime enum: the union is inferred AND recorded at runtime, so a
        // `$m` groupBy on `name` gets a guaranteed, narrowed, never-undefined
        // bucket per value. (`i.string<'apple' | …>()` narrows the type only.)
        name: i.string(['apple', 'banana', 'orange']).indexed(),
      },
    }),
    // >>> FOR SANDBOX EXPERIMENTS (END) <<<
  },
  links: {
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
    workspace: i.room({
      presence: {
        name: i.string(),
        typing: i.boolean().optional(),
      },
      topics: {
        reaction: { emoji: i.string() },
      },
    }),
  },
})

export type AppSchema = typeof schema
export default schema

// Register the schema once — `q` and every `Idb*` type utility then default
// to it across the whole project.
// Docs: https://github.com/mareszhar/instant/blob/dux/client/packages/dux/docs/dux-conventions.md#7-global-schema-registration
declare module '@mszr/idb-dux' {
  interface IdbRegister {
    schema: typeof schema
  }
}
