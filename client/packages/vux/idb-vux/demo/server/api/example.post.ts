import { useIdb } from '../utils/idb'

export default defineEventHandler(async (event) => {
  const { adminDb } = useIdb(event)
  const { userDb } = useIdb(event, 'userDb?')
  const { user } = await useIdb(event, 'user?')
  const idb = await useIdb(event, 'all?')

  console.warn('idb stuff available!', adminDb, userDb, user, idb)
})
