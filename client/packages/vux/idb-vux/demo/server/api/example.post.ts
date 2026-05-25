export default defineEventHandler(async (event) => {
  const { adminDb } = useIdbn(event)
  const { userDb } = useIdbn(event, 'userDb?')
  const { user } = await useIdbn(event, 'user?')
  const idb = await useIdbn(event, 'all?')

  console.warn('idb stuff available!', adminDb, userDb, user, idb)
})
