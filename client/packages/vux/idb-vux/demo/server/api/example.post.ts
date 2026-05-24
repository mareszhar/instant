export default defineEventHandler((event) => {
  const { db, scopedDb, user } = event.context
  console.warn('idb stuff available on event!', db, scopedDb, user)
})
