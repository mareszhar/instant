import { i as officialI } from '@instantdb/core'
import { validateSchema } from '@instantdb/platform'
/**
 * Compatibility-target suite ([workspace spec §4.6]): dux schema output stays
 * a valid input to the official tools dux doesn't wrap — CLI push (which
 * gates on the `InstantSchemaDef` constructor and evaluates the file) and the
 * platform API (`validateSchema`, `schemaPush`).
 */
import { schema } from '@test'
import { describe, expect, it } from 'vitest'

/** What the backend's system catalog would report for the canonical app. */
const systemCatalogIdentNames = { $users: new Set(['id', 'email']) }

describe('defineSchema — compatibility targets', () => {
  it('satisfies the CLI push constructor invariant', () => {
    // `instant-cli push` gates on exactly this check (cli/src/lib/pushSchema.ts).
    expect(schema.constructor.name).toBe('InstantSchemaDef')
  })

  it('passes the platform API schema validation', () => {
    expect(() => validateSchema(schema, systemCatalogIdentNames)).not.toThrow()
  })

  it('projects exactly what official i.schema would for the same app', () => {
    const official = officialI.schema({
      entities: {
        $users: officialI.entity({
          email: officialI.string().unique().indexed().optional(),
          name: officialI.string().indexed().optional(),
        }),
        workspaces: officialI.entity({
          name: officialI.string().indexed(),
          inviteCode: officialI.string().unique().indexed(),
          createdAt: officialI.date().indexed(),
        }),
        memberships: officialI.entity({ createdAt: officialI.date().indexed() }),
        tasks: officialI.entity({
          title: officialI.string().indexed(),
          isDone: officialI.boolean().indexed(),
          createdAt: officialI.date().indexed(),
          notes: officialI.string().optional(),
          meta: officialI.json<{ tags: string[] }>().optional(),
        }),
        reports: officialI.entity({ title: officialI.string() }),
        analyses: officialI.entity({ score: officialI.number().indexed() }),
        states: officialI.entity({ label: officialI.string().indexed() }),
        fruits: officialI.entity({
          // a runtime enum projects exactly like a plain indexed string —
          // its declared values ride along non-enumerably, never to the wire
          name: officialI.string().indexed(),
          kind: officialI.string().optional(),
          sku: officialI.number().unique().indexed(),
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
          forward: { on: 'reports', has: 'many', label: 'analyses' },
          reverse: { on: 'analyses', has: 'one', label: 'report' },
        },
      },
      rooms: {
        workspace: {
          presence: officialI.entity({
            name: officialI.string(),
            typing: officialI.boolean().optional(),
          }),
          topics: {
            reaction: officialI.entity({ emoji: officialI.string() }),
          },
        },
      },
    })

    expect(JSON.parse(JSON.stringify(schema))).toEqual(
      JSON.parse(JSON.stringify(official)),
    )
  })
})
