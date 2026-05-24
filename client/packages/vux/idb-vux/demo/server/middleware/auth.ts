export default defineEventHandler(async (event) => {
  const db = useAdminDb(event)
  const cookieName = getAuthCookieName(event)
  const refreshToken = getCookie(event, cookieName)
  const scopedDb = refreshToken ? db.asUser({ token: refreshToken }) : null
  const user = refreshToken ? await db.auth.verifyToken(refreshToken) : null

  event.context.db = db
  event.context.scopedDb = scopedDb
  event.context.user = user
})
