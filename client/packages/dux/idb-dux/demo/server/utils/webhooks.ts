import type { IdbAdminClient } from '@mszr/idb-dux/admin'
import { id } from '@mszr/idb-dux'
import { init as initAdmin } from '@mszr/idb-dux/admin'
import { defineWebhookHandlers } from '@mszr/idb-dux/webhooks'
import schema from '~~/config/instant.schema'

// Deliveries arrive outside the request kit (Instant POSTs them), so the
// handlers persist through their own admin db, built lazily from runtime
// config. adminDb bypasses perms — exactly right for a verified machine writer.
let adminDb: IdbAdminClient | undefined
function getAdminDb() {
  if (!adminDb) {
    const config = useRuntimeConfig()
    adminDb = initAdmin({
      appId: config.public.instantAppId,
      adminToken: config.instantAppAdminToken,
      schema,
    })
  }
  return adminDb
}

// Append one delivery to a workspace's journal. The panel reads these back
// through a workspace-scoped query, so a delivery only ever surfaces for the
// workspace that caused it ([app/stores/webhooks.ts]).
function journal(workspaceId: string, namespace: string, action: string, summary: string) {
  const db = getAdminDb()
  return db.transact(
    db.tx.webhookEvents[id()]!
      .create({ namespace, action, summary, receivedAt: Date.now() })
      .link({ workspace: workspaceId }),
  )
}

// Plain object literal, full per-change narrowing — `after`/`before` is
// `IdbEntity<'tasks'>`, the same entity type queries and tx speak (including the
// denormalized `workspaceId` that scopes the journal). No helper ceremony, no
// schema generic at the call site ([dux-spec-webhooks.md §4]).
export const webhookHandlers = defineWebhookHandlers({
  tasks: {
    create: ({ after }) => journal(after.workspaceId, 'tasks', 'create', `created "${after.title}"`),
    update: ({ after }) => journal(after.workspaceId, 'tasks', 'update', `"${after.title}" → ${after.isDone ? 'done' : 'pending'}`),
    delete: ({ before }) => journal(before.workspaceId, 'tasks', 'delete', `deleted "${before.title}"`),
  },
})
