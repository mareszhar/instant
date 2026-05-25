import type { H3Event } from 'h3'
import type {
  InstantAuthSyncBody,
  InstantAuthSyncCookieOptions,
} from '../nuxt.js'
import { defineInstantAuthSyncHandler } from '../nuxt.js'

interface CustomUser {
  id: string
  refresh_token: string | null
  role: 'admin' | 'member'
}

interface MissingRefreshTokenUser {
  id: string
}

const body: InstantAuthSyncBody<CustomUser> = {
  type: 'sync-user',
  appId: 'app-id',
  user: {
    id: 'user-id',
    refresh_token: 'token',
    role: 'admin',
  },
}

const staticCookieOptions: InstantAuthSyncCookieOptions = {
  maxAge: 60,
  path: '/',
  sameSite: 'lax',
}

defineInstantAuthSyncHandler({
  getAppId: () => 'app-id',
  getCookieName: (appId, event) => {
    const requestPath = event.path
    return `${appId}:${requestPath}`
  },
  cookieOptions: staticCookieOptions,
})

defineInstantAuthSyncHandler({
  getAppId: (event: H3Event) => event.context.appId?.toString(),
  cookieOptions: (event, appId) => ({
    maxAge: appId === 'app-id' ? 60 : 30,
    secure: event.method === 'POST',
  }),
})

// @ts-expect-error - custom body users must include the refresh token field the sync handler consumes
type InvalidBody = InstantAuthSyncBody<MissingRefreshTokenUser>

void body
