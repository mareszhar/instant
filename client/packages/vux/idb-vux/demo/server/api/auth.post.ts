export default defineEventHandler(async (event) => {
  const { type, appId, user } = await readBody<SyncUserPayload>(event)
  const runtimeConfig = useRuntimeConfig(event)

  if (appId !== runtimeConfig.public.instantAppId)
    throw createError({ statusCode: 403, statusMessage: 'App ID mismatch' })

  if (type !== 'sync-user')
    throw createError({ statusCode: 400, statusMessage: `Unknown type: ${type}` })

  const cookieName = getAuthCookieName(event)

  if (user?.refresh_token) {
    setCookie(event, cookieName, user.refresh_token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      secure: !import.meta.dev,
    })
  }
  else {
    deleteCookie(event, cookieName)
  }
})
