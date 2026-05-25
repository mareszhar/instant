export default defineEventHandler(async (event) => {
  const { adminDb } = useIsdb(event)
  const { userDb } = useIsdb(event, 'userDb?')
  const { user } = await useIsdb(event, 'user?')
  const idb = await useIsdb(event, 'all?')

  console.warn('idb stuff available!', adminDb, userDb, user, idb)
})
