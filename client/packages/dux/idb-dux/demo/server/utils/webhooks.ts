import { defineWebhookHandlers } from '@mszr/idb-dux/webhooks'

export interface WebhookLogEntry {
  at: string
  namespace: string
  action: string
  summary: string
}

// A tiny in-memory ring buffer so the demo can show deliveries arriving.
// Real apps would notify, enqueue, or persist instead.
const MAX_LOG_ENTRIES = 20
export const recentWebhookChanges: WebhookLogEntry[] = []

function record(namespace: string, action: string, summary: string) {
  recentWebhookChanges.unshift({ at: new Date().toISOString(), namespace, action, summary })
  if (recentWebhookChanges.length > MAX_LOG_ENTRIES)
    recentWebhookChanges.length = MAX_LOG_ENTRIES
}

// Plain object literal, full per-change narrowing — `after`/`before` is
// `IdbEntity<'tasks'>`, the same entity type queries and tx speak. No helper
// ceremony, no schema generic at the call site ([dux-spec-webhooks.md §4]).
export const webhookHandlers = defineWebhookHandlers({
  tasks: {
    create: ({ after }) => record('tasks', 'create', `created "${after.title}"`),
    update: ({ after }) => record('tasks', 'update', `"${after.title}" → ${after.isDone ? 'done' : 'pending'}`),
    delete: ({ before }) => record('tasks', 'delete', `deleted "${before.title}"`),
  },
  workspaces: {
    create: ({ after }) => record('workspaces', 'create', `created "${after.name}"`),
    delete: ({ before }) => record('workspaces', 'delete', `deleted "${before.name}"`),
  },
  $default: change => record(change.namespace, change.action, `change to ${change.namespace}`),
})
