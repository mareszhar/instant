import type { User } from '@mszr/idb-vux'
import {
  createError,
  getRequestURL,
  readBody,
  setCookie,
} from 'h3'

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

interface SyncUserBody {
  type?: string
  appId?: string
  user?: User | null
}

function shouldUseSecureCookie(event: Parameters<typeof getRequestURL>[0]): boolean {
  return getRequestURL(event).protocol === 'https:'
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const appId = runtimeConfig.public.instantAppId

  if (!appId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing public runtime config: instantAppId',
    })
  }

  const body = await readBody<SyncUserBody>(event)

  if (!body?.type) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing "type" field',
    })
  }

  if (body.appId !== appId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'App ID mismatch',
    })
  }

  if (body.type !== 'sync-user') {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown type: ${body.type}`,
    })
  }

  const cookieName = `instant_user_${appId}`
  const secure = shouldUseSecureCookie(event)

  if (body.user?.refresh_token) {
    setCookie(event, cookieName, JSON.stringify(body.user), {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE_SECONDS,
      secure,
    })
  }
  else {
    setCookie(event, cookieName, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: -1,
      secure,
    })
  }

  return {
    ok: true,
  }
})
