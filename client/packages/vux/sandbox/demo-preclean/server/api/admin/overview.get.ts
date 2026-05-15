import { getAdminDb, getSyncedInstantUser } from '../../utils/instantAdmin'

export default defineEventHandler(async (event) => {
  const adminDb = getAdminDb(event)
  const syncedUser = getSyncedInstantUser(event)

  try {
    const data = await adminDb.query({
      quests: {},
      $users: {},
    } as const)

    const { quests, $users: users } = data

    const totalQuests = quests.length
    const doneQuests = quests.filter(quest => quest.status === 'done').length
    const pendingQuests = totalQuests - doneQuests

    return {
      generatedAt: new Date().toISOString(),
      mode: 'live' as const,
      counts: {
        totalQuests,
        doneQuests,
        pendingQuests,
        userCount: users.length,
      },
      syncedUser,
      warning: '',
    }
  }
  catch {
    return {
      generatedAt: new Date().toISOString(),
      mode: 'degraded' as const,
      counts: {
        totalQuests: 0,
        doneQuests: 0,
        pendingQuests: 0,
        userCount: 0,
      },
      syncedUser,
      warning: 'Instant Admin API request failed from the Nuxt server in this environment.',
    }
  }
})
