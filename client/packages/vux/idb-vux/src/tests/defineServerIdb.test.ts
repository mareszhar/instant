import type { H3Event } from 'h3'
import type { ServerIdbAsUserOptions } from '../nuxt.js'
import { i } from '@instantdb/core'
import { describe, expect, it, vi } from 'vitest'
import { defineServerIdb, getDefaultServerIdbCookieName } from '../nuxt.js'

interface TestUser {
  id: string
  email: string
}

const schema = i.schema({
  entities: {
    tasks: i.entity({
      title: i.string(),
    }),
  },
})

interface TestDb {
  appId: string
  adminToken?: string
  scope: null | { token: string } | { guest: boolean } | { email: string }
  auth: {
    verifyToken: (token: string) => Promise<TestUser>
  }
  asUser: (options: { token: string } | { guest: boolean } | { email: string }) => TestDb
}

interface TestInitConfig {
  appId: string
  adminToken?: string
  schema?: typeof schema
}

function createEvent(cookie = '') {
  return {
    context: {},
    node: {
      req: {
        headers: {
          cookie,
        },
      },
    },
  } as H3Event
}

function createHarness(options: {
  appId?: string | null
  adminToken?: string | null
} = {}) {
  const initCalls: TestInitConfig[] = []
  const asUserCalls: ServerIdbAsUserOptions[] = []
  const getAppId = vi.fn(() => options.appId ?? 'app-1')
  const getAdminToken = vi.fn(() => options.adminToken ?? 'admin-token')
  const getCookieName = vi.fn(getDefaultServerIdbCookieName)
  const verifyToken = vi.fn(async (token: string) => {
    if (token === 'bad-token')
      throw new Error('Bad token')

    return {
      id: 'user-1',
      email: 'user@example.com',
    }
  })

  const init = vi.fn((config: TestInitConfig): TestDb => {
    initCalls.push(config)

    const db: TestDb = {
      appId: config.appId,
      scope: null,
      auth: {
        verifyToken,
      },
      asUser: vi.fn((scope: { token: string } | { guest: boolean } | { email: string }) => {
        asUserCalls.push(scope)

        return {
          ...db,
          scope,
        }
      }),
    }

    if (config.adminToken)
      db.adminToken = config.adminToken

    return db
  })

  const useIdb = defineServerIdb({
    init,
    schema,
    getAppId,
    getAdminToken,
    getCookieName,
  })

  return {
    asUserCalls,
    getAdminToken,
    getAppId,
    getCookieName,
    init,
    initCalls,
    useIdb,
    verifyToken,
  }
}

describe('defineServerIdb', () => {
  it('caches admin and base DBs separately', () => {
    const { init, useIdb } = createHarness()
    const event = createEvent()

    const firstAdmin = useIdb(event).adminDb
    const secondAdmin = useIdb(event, 'adminDb').adminDb
    const firstBase = useIdb(event, 'baseDb').baseDb
    const secondBase = useIdb(event, 'baseDb').baseDb

    expect(firstAdmin).toBe(secondAdmin)
    expect(firstBase).toBe(secondBase)
    expect(firstAdmin).not.toBe(firstBase)
    expect(firstAdmin.adminToken).toBe('admin-token')
    expect(firstBase.adminToken).toBeUndefined()
    expect(init).toHaveBeenCalledTimes(2)
  })

  it('does not require an admin token for base, guest, or token-scoped DB modes', () => {
    const { useIdb } = createHarness({ adminToken: null })
    const event = createEvent(`${getDefaultServerIdbCookieName('app-1')}=token-1`)

    expect(useIdb(event, 'baseDb').baseDb.adminToken).toBeUndefined()
    expect(useIdb(event, 'guestDb').guestDb.scope).toEqual({ guest: true })
    expect(useIdb(event, 'userDb!').userDb.scope).toEqual({ token: 'token-1' })
  })

  it('returns nulls for optional auth modes when the token is missing', async () => {
    const { useIdb } = createHarness()
    const event = createEvent()

    expect(useIdb(event, 'userDb?')).toEqual({
      token: null,
      userDb: null,
    })
    await expect(useIdb(event, 'user?')).resolves.toEqual({
      token: null,
      userDb: null,
      user: null,
    })
  })

  it('throws 401 for required auth modes when the token is missing or invalid', async () => {
    const { useIdb } = createHarness()

    expect(() => useIdb(createEvent(), 'userDb!')).toThrow(expect.objectContaining({
      statusCode: 401,
    }))

    await expect(useIdb(
      createEvent(`${getDefaultServerIdbCookieName('app-1')}=bad-token`),
      'user!',
    )).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('returns all DB variants and verified user state in all modes', async () => {
    const { useIdb } = createHarness()
    const event = createEvent(`${getDefaultServerIdbCookieName('app-1')}=token-1`)

    const all = await useIdb(event, 'all!')

    expect(all).toMatchObject({
      adminDb: {
        adminToken: 'admin-token',
      },
      guestDb: {
        scope: { guest: true },
      },
      token: 'token-1',
      userDb: {
        scope: { token: 'token-1' },
      },
      user: {
        id: 'user-1',
      },
    })
    expect(all.baseDb.adminToken).toBeUndefined()
  })

  it('reuses request-scoped auth work across composable calls', async () => {
    const {
      asUserCalls,
      getAdminToken,
      getAppId,
      getCookieName,
      useIdb,
      verifyToken,
    } = createHarness()
    const event = createEvent(`${getDefaultServerIdbCookieName('app-1')}=token-1`)

    const firstUserDb = useIdb(event, 'userDb!').userDb
    const secondUserDb = useIdb(event, 'userDb?').userDb
    const [requiredUser, allOptional] = await Promise.all([
      useIdb(event, 'user!'),
      useIdb(event, 'all?'),
    ])
    const laterGuestDb = useIdb(event, 'guestDb').guestDb

    expect(secondUserDb).toBe(firstUserDb)
    expect(requiredUser.userDb).toBe(firstUserDb)
    expect(allOptional.userDb).toBe(firstUserDb)
    expect(laterGuestDb).toBe(allOptional.guestDb)
    expect(verifyToken).toHaveBeenCalledTimes(1)
    expect(getAppId).toHaveBeenCalledTimes(1)
    expect(getAdminToken).toHaveBeenCalledTimes(1)
    expect(getCookieName).toHaveBeenCalledTimes(1)
    expect(asUserCalls.filter(scope => 'token' in scope)).toEqual([
      { token: 'token-1' },
    ])
    expect(asUserCalls.filter(scope => 'guest' in scope)).toEqual([
      { guest: true },
    ])
  })

  it('keeps verified auth scoped to a single request event', async () => {
    const { useIdb, verifyToken } = createHarness()
    const cookie = `${getDefaultServerIdbCookieName('app-1')}=token-1`
    const firstEvent = createEvent(cookie)
    const secondEvent = createEvent(cookie)

    await useIdb(firstEvent, 'user!')
    await useIdb(firstEvent, 'user?')
    await useIdb(secondEvent, 'user!')

    expect(verifyToken).toHaveBeenCalledTimes(2)
  })

  it('reuses failed verification while preserving optional and required auth semantics', async () => {
    const { useIdb, verifyToken } = createHarness()
    const event = createEvent(`${getDefaultServerIdbCookieName('app-1')}=bad-token`)

    await expect(useIdb(event, 'user?')).resolves.toEqual({
      token: null,
      userDb: null,
      user: null,
    })
    await expect(useIdb(event, 'user!')).rejects.toMatchObject({
      statusCode: 401,
    })
    expect(verifyToken).toHaveBeenCalledTimes(1)
  })
})
