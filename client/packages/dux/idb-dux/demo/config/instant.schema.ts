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
        // Denormalized copy of the linked workspace's id. Webhook payloads carry
        // an entity's fields but not its links, so a `tasks.delete` delivery —
        // arriving after the row is gone — has no other way to say which
        // workspace it belonged to. Perms pin this to the actual linked
        // workspace ([instant.perms.ts]) so it can't be forged to route a
        // delivery into another workspace's journal.
        workspaceId: i.string().indexed(),
      },
    }),
    // The per-workspace webhook delivery journal. The receiver writes a row per
    // delivery ([server/api/webhooks/receive.post.ts]); the panel reads them
    // back through an ordinary workspace-scoped query, so one visitor never sees
    // another's deliveries — the same isolation the rest of the demo relies on.
    webhookEvents: i.namespace({
      fields: {
        namespace: i.string().indexed(),
        action: i.string().indexed(),
        summary: i.string(),
        receivedAt: i.date().indexed(),
      },
    }),
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
    webhookEventWorkspace: {
      forward: { on: 'webhookEvents', has: 'one', label: 'workspace' },
      reverse: { on: 'workspaces', has: 'many', label: 'webhookEvents' },
    },
  },
  rooms: {
    workspace: {
      presence: i.namespace({
        fields: {
          name: i.string(),
          typing: i.boolean().optional(),
        },
      }),
      topics: {
        reaction: i.namespace({
          fields: {
            emoji: i.string(),
          },
        }),
      },
    },
  },
})

export type AppSchema = typeof schema
export default schema

// Register the schema once — `q` and every `Idb*` type utility then default
// to it across the whole project ([dux-conventions.md §7]).
declare module '@mszr/idb-dux' {
  interface IdbRegister {
    schema: typeof schema
  }
}
