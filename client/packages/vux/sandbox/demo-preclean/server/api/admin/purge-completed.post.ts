import { getAdminDb } from '../../utils/instantAdmin'

export default defineEventHandler(async (event) => {
  const adminDb = getAdminDb(event)

  try {
    const data = await adminDb.query({
      quests: {
        $: {
          where: {
            status: 'done',
          },
        },
      },
    } as const)

    const completedQuests = data.quests
    const deletions = completedQuests.map(quest => adminDb.tx.quests[quest.id]!.delete())

    if (deletions.length > 0) {
      await adminDb.transact(deletions)
    }

    return {
      generatedAt: new Date().toISOString(),
      mode: 'live' as const,
      deletedCount: deletions.length,
      totalBefore: completedQuests.length,
      totalAfter: 0,
      warning: '',
    }
  }
  catch {
    return {
      generatedAt: new Date().toISOString(),
      mode: 'degraded' as const,
      deletedCount: 0,
      totalBefore: 0,
      totalAfter: 0,
      warning: 'Instant Admin API request failed from the Nuxt server in this environment.',
    }
  }
})
