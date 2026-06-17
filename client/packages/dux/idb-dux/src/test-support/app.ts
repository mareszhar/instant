/**
 * The canonical app — the one fixed schema every test plane draws from.
 * Change it here and every suite updates.
 *
 * Deliberate coverage built in:
 * - `$users` with a declared `singular` ('user' — the algorithm would say '$user')
 * - `analyses` with a declared namespace `singular` ('analysis' — irregular)
 * - a link label with a declared `singular` (`analyses` → 'analysis')
 * - a self-link (`tasks` → subtasks/parentTask)
 * - `ruleParams` on two namespaces (one required, one optional param)
 * - unique + indexed + optional fields, every value type, a non-indexed string
 * - `states`, whose algorithmic singular ('state') is a reserved result key —
 *   exercises the singularization-collision guard
 * - `fruits`, a runtime enum (`name`) and a type-level enum (`kind`) —
 *   exercises `$m` groupBy key/narrowing inference, present vs optional buckets
 * - rooms with presence and topics
 */
import { defineSchema, i } from '../schema/index.js'

export const schema = defineSchema({
  namespaces: {
    $users: i.namespace({
      singular: 'user', // overrides default Singularize('$users') → '$user'
      fields: {
        email: i.string().unique().indexed().optional(),
        name: i.string().indexed().optional(),
      },
    }),
    workspaces: i.namespace({
      fields: {
        name: i.string().indexed(),
        inviteCode: i.string().unique().indexed(),
        createdAt: i.date().indexed(),
      },
      ruleParams: {
        inviteCode: i.string(),
      },
    }),
    memberships: i.namespace({
      fields: { createdAt: i.date().indexed() },
      ruleParams: { inviteCode: i.string().optional() },
    }),
    tasks: i.namespace({
      fields: {
        title: i.string().indexed(),
        isDone: i.boolean().indexed(),
        createdAt: i.date().indexed(),
        notes: i.string().optional(), // deliberately non-indexed
        meta: i.json<{ tags: string[] }>().optional(),
      },
    }),
    reports: i.namespace({
      fields: { title: i.string() },
    }),
    analyses: i.namespace({
      singular: 'analysis',
      fields: { score: i.number().indexed() },
    }),
    states: i.namespace({
      // Singularize('states') → 'state', a reserved result key: a plain read is
      // fine, but `$only`/`$at` would collide, so the guard fires at that query.
      fields: { label: i.string().indexed() },
    }),
    fruits: i.namespace({
      fields: {
        // runtime enum: union inferred AND recorded at runtime → groupBy gets
        // guaranteed, narrowed, never-undefined buckets
        name: i.string(['apple', 'banana', 'orange']).indexed(),
        // type-level enum: type-only → groupBy buckets are optional
        kind: i.string<'sweet' | 'sour'>().optional(),
        // unique number — `indexBy` keeps the field's value type as the key
        sku: i.number().unique().indexed(),
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
    taskSubtasks: {
      forward: { on: 'tasks', has: 'many', label: 'subtasks' },
      reverse: { on: 'tasks', has: 'one', label: 'parentTask' },
    },
    reportAnalyses: {
      forward: { on: 'reports', has: 'many', label: 'analyses', singular: 'analysis' },
      reverse: { on: 'analyses', has: 'one', label: 'report' },
    },
  },
  rooms: {
    workspace: i.room({
      presence: { name: i.string(), typing: i.boolean().optional() },
      topics: { reaction: { emoji: i.string() } },
    }),
  },
})

export type AppSchema = typeof schema
