import type { AppSchema } from '@test'
/**
 * Type-shape plane for `/nuxt`: the kit's keys narrow per mode, so a route
 * declares its auth strictness and the types follow — no manual narrowing,
 * `userDb` only where asked.
 */
import type { H3Event } from 'h3'
import type { IdbAdminClient, IdbAuthUser } from '../admin/index.js'
import type { IdbServerKitFactory } from './types.js'
import { describe, expectTypeOf, it } from 'vitest'

declare const event: H3Event
declare const useKit: IdbServerKitFactory<AppSchema>

describe('server kit — mode-narrowed keys', () => {
  it('no mode yields just the admin db', async () => {
    const kit = await useKit(event)
    expectTypeOf(kit.adminDb).toEqualTypeOf<IdbAdminClient<AppSchema>>()
    // @ts-expect-error no user without a mode
    void kit.user
  })

  it('user? yields an optional user', async () => {
    const kit = await useKit(event, 'user?')
    expectTypeOf(kit.user).toEqualTypeOf<IdbAuthUser | undefined>()
    // @ts-expect-error userDb only on userDb modes
    void kit.userDb
  })

  it('user yields a required user', async () => {
    const kit = await useKit(event, 'user')
    expectTypeOf(kit.user).toEqualTypeOf<IdbAuthUser>()
  })

  it('userDb yields a required user and scoped db', async () => {
    const kit = await useKit(event, 'userDb')
    expectTypeOf(kit.user).toEqualTypeOf<IdbAuthUser>()
    expectTypeOf(kit.userDb).toEqualTypeOf<IdbAdminClient<AppSchema>>()
  })

  it('userDb? yields optionals', async () => {
    const kit = await useKit(event, 'userDb?')
    expectTypeOf(kit.user).toEqualTypeOf<IdbAuthUser | undefined>()
    expectTypeOf(kit.userDb).toEqualTypeOf<IdbAdminClient<AppSchema> | undefined>()
  })
})
