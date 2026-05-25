import type { H3Event } from 'h3'
import { describe, expect, it, vi } from 'vitest'
import {
  defineInstantAuthSyncHandler,
  getDefaultServerIdbCookieName,
} from '../nuxt.js'

type MockHeaders = Record<string, string | string[] | number | undefined>

function createMockResponse() {
  const headers: MockHeaders = {}

  return {
    headers,
    getHeader: vi.fn((name: string) => headers[name.toLowerCase()]),
    setHeader: vi.fn((name: string, value: string | string[]) => {
      headers[name.toLowerCase()] = value
    }),
    appendHeader: vi.fn((name: string, value: string) => {
      const key = name.toLowerCase()
      const existing = headers[key]

      if (!existing) {
        headers[key] = value
      }
      else if (Array.isArray(existing)) {
        existing.push(value)
      }
      else {
        headers[key] = [existing.toString(), value]
      }
    }),
    removeHeader: vi.fn((name: string) => {
      delete headers[name.toLowerCase()]
    }),
  }
}

function createEvent(
  body: unknown,
  headers: Record<string, string> = {},
) {
  const response = createMockResponse()
  const event = {
    context: {},
    method: 'POST',
    node: {
      req: {
        body,
        connection: {},
        headers: {
          'content-type': 'application/json',
          ...headers,
        },
      },
      res: response,
    },
  } as unknown as H3Event

  return {
    event,
    response,
  }
}

function getSetCookie(response: ReturnType<typeof createMockResponse>) {
  const value = response.headers['set-cookie']

  if (Array.isArray(value))
    return value.join('\n')

  return value?.toString() ?? ''
}

describe('defineInstantAuthSyncHandler', () => {
  it('sets the default auth token cookie for synced users', async () => {
    const handler = defineInstantAuthSyncHandler({
      getAppId: () => 'app-1',
    })
    const { event, response } = createEvent(
      {
        type: 'sync-user',
        appId: 'app-1',
        user: {
          id: 'user-1',
          isGuest: false,
          refresh_token: 'token-1',
        },
      },
      {
        'x-forwarded-proto': 'https',
      },
    )

    await expect(handler(event)).resolves.toBeNull()

    const cookie = getSetCookie(response)
    expect(cookie).toContain(`${getDefaultServerIdbCookieName('app-1')}=token-1`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Max-Age=604800')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Secure')
  })

  it('deletes the auth cookie when the synced user is missing', async () => {
    const handler = defineInstantAuthSyncHandler({
      getAppId: () => 'app-1',
      getCookieName: appId => `custom_token_${appId}`,
      cookieOptions: {
        path: '/dashboard',
        sameSite: 'lax',
      },
    })
    const { event, response } = createEvent({
      type: 'sync-user',
      appId: 'app-1',
      user: null,
    })

    await expect(handler(event)).resolves.toBeNull()

    const cookie = getSetCookie(response)
    expect(cookie).toContain('custom_token_app-1=')
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('Path=/dashboard')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('Max-Age=604800')
  })

  it('accepts event-based cookie options', async () => {
    const cookieOptions = vi.fn((event: H3Event, appId: string) => ({
      maxAge: appId === 'app-1' ? 60 : 30,
      secure: event.method === 'POST',
    }))
    const handler = defineInstantAuthSyncHandler({
      getAppId: () => 'app-1',
      cookieOptions,
    })
    const { event, response } = createEvent({
      type: 'sync-user',
      appId: 'app-1',
      user: {
        refresh_token: 'token-1',
      },
    })

    await handler(event)

    expect(cookieOptions).toHaveBeenCalledWith(event, 'app-1')
    expect(getSetCookie(response)).toContain('Max-Age=60')
    expect(getSetCookie(response)).toContain('Secure')
  })

  it('validates app id and message type', async () => {
    const handler = defineInstantAuthSyncHandler({
      getAppId: () => 'app-1',
    })

    await expect(handler(createEvent({}).event)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing "type" field',
    })

    await expect(handler(createEvent({
      type: 'sync-user',
      appId: 'other-app',
      user: null,
    }).event)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'App ID mismatch',
    })

    await expect(handler(createEvent({
      type: 'something-else',
      appId: 'app-1',
      user: null,
    }).event)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Unknown type: something-else',
    })
  })

  it('throws a setup error when the resolved app id is missing', async () => {
    const handler = defineInstantAuthSyncHandler({
      getAppId: () => '',
    })

    await expect(handler(createEvent({
      type: 'sync-user',
      appId: 'app-1',
      user: null,
    }).event)).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Missing required auth sync config: appId',
    })
  })
})
