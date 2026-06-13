/**
 * Type-shape plane for `/admin`: the data plane returns the same `IdbQueryData`
 * the client does (shaped, never `undefined`), the subscription's payloads carry
 * that shaped data, `asUser` returns the same dux db, and `webhooks` is the
 * `/webhooks` surface verbatim.
 */
import type { AppSchema } from '@test'
import type { IdbEntity } from '../schema/index.js'
import type { IdbWebhooks } from '../webhooks/index.js'
import type { IdbAdminClient } from './init.js'
import type { IdbAuthUser, IdbSubscriptionReadyState } from './types.js'
import { describe, expectTypeOf, it } from 'vitest'

declare const adminDb: IdbAdminClient<AppSchema>

type Workspace = IdbEntity<'workspaces', AppSchema>
type Task = IdbEntity<'tasks', AppSchema>

describe('admin query — shaped return', () => {
  it('normalizes top-level scopes to arrays', async () => {
    const { workspaces } = await adminDb.query({ workspaces: {} })
    expectTypeOf(workspaces).toEqualTypeOf<Workspace[]>()
  })

  it('coerces $only to Entity | undefined under the singular key', async () => {
    const { workspace } = await adminDb.query({ workspaces: { $: { $only: true } } })
    expectTypeOf(workspace).toEqualTypeOf<Workspace | undefined>()
  })

  it('flags an unknown root namespace at the offending key', async () => {
    // @ts-expect-error nope is not a namespace
    await adminDb.query({ nope: {} })
  })
})

describe('admin subscribeQuery — shaped payloads', () => {
  it('the handle exposes the subscription surface', () => {
    const sub = adminDb.subscribeQuery({ workspaces: { $: { $only: true } } })
    expectTypeOf(sub.close).toEqualTypeOf<() => void>()
    expectTypeOf(sub.readyState).toEqualTypeOf<IdbSubscriptionReadyState>()
    expectTypeOf(sub.isClosed).toEqualTypeOf<boolean>()
  })

  it('the callback payload data is the shaped data plane', () => {
    adminDb.subscribeQuery({ workspaces: { $: { $only: true } } }, (payload) => {
      expectTypeOf(payload.type).toEqualTypeOf<'ok' | 'error'>()
      // The ok arm carries the shaped data plane — same as `query`'s return.
      if (payload.type === 'ok')
        expectTypeOf(payload.data.workspace).toEqualTypeOf<Workspace | undefined>()
    })
  })
})

describe('admin tx + debug', () => {
  it('tx is the schema-typed chain', () => {
    expectTypeOf(adminDb.tx.tasks).toBeObject()
  })

  it('debugQuery shapes the result and types ruleParams', async () => {
    const { result } = await adminDb.debugQuery(
      { workspaces: { $: { $only: true } } },
      { ruleParams: { inviteCode: 'x' } },
    )
    expectTypeOf(result.workspace).toEqualTypeOf<Workspace | undefined>()
  })
})

describe('admin asUser + webhooks', () => {
  it('asUser returns the same dux admin db', () => {
    expectTypeOf(adminDb.asUser({ guest: true })).toEqualTypeOf<IdbAdminClient<AppSchema>>()
  })

  it('webhooks is the /webhooks surface (identical to webhooks.init)', () => {
    expectTypeOf(adminDb.webhooks).toEqualTypeOf<IdbWebhooks<AppSchema>>()
  })

  it('auth methods speak the renamed user type', () => {
    expectTypeOf<IdbAuthUser>().toExtend<{ id: string }>()
  })
})

void (async () => {
  // The data plane validates against the schema exactly like the client.
  // @ts-expect-error isDone is a boolean, not a string
  await adminDb.query({ tasks: { $: { where: { isDone: 'yes' } } } })
  void (null as unknown as Task)
})
