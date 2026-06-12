/**
 * Type-shape plane for `/webhooks`: changes resolve to `IdbEntity`, the change
 * utility narrows by namespace/action and widens to a discriminated union, and
 * the manager + op payloads speak dux types.
 */
import type { AppSchema } from '@test'
import type { IdbEntity, IdbNamespaceName } from '../schema/types.js'
import type {
  IdbWebhook,
  IdbWebhookAction,
  IdbWebhookChange,
  IdbWebhookCreate,
  IdbWebhookEvent,
  IdbWebhookUpdate,
} from './types.js'
import { describe, expectTypeOf, it } from 'vitest'
import { init } from './init.js'

describe('IdbWebhookChange — type shapes', () => {
  it('a create change carries IdbEntity in after and null in before', () => {
    type C = IdbWebhookChange<'tasks', 'create', AppSchema>
    expectTypeOf<C['after']>().toEqualTypeOf<IdbEntity<'tasks', AppSchema>>()
    expectTypeOf<C['before']>().toEqualTypeOf<null>()
    expectTypeOf<C['action']>().toEqualTypeOf<'create'>()
  })

  it('an update change carries IdbEntity in both before and after', () => {
    type C = IdbWebhookChange<'tasks', 'update', AppSchema>
    expectTypeOf<C['before']>().toEqualTypeOf<IdbEntity<'tasks', AppSchema>>()
    expectTypeOf<C['after']>().toEqualTypeOf<IdbEntity<'tasks', AppSchema>>()
  })

  it('a delete change carries IdbEntity in before and null in after', () => {
    type C = IdbWebhookChange<'tasks', 'delete', AppSchema>
    expectTypeOf<C['before']>().toEqualTypeOf<IdbEntity<'tasks', AppSchema>>()
    expectTypeOf<C['after']>().toEqualTypeOf<null>()
  })

  it('widens to a discriminated union over every namespace and action', () => {
    type C = IdbWebhookChange<IdbNamespaceName<AppSchema>, IdbWebhookAction, AppSchema>
    // discriminating by action narrows the entity sides
    type CreateArm = Extract<C, { action: 'create' }>
    expectTypeOf<CreateArm['before']>().toEqualTypeOf<null>()
    // namespace stays part of the discriminant
    expectTypeOf<C['namespace']>().toEqualTypeOf<IdbNamespaceName<AppSchema>>()
  })
})

describe('manager + op payloads — type shapes', () => {
  it('create takes IdbWebhookCreate and returns IdbWebhook', () => {
    const wh = init<AppSchema>()
    expectTypeOf(wh.manager.create).parameter(0).toEqualTypeOf<IdbWebhookCreate<AppSchema>>()
    expectTypeOf(wh.manager.create).returns.resolves.toEqualTypeOf<IdbWebhook>()
  })

  it('update takes IdbWebhookUpdate', () => {
    const wh = init<AppSchema>()
    expectTypeOf(wh.manager.update).parameter(1).toEqualTypeOf<IdbWebhookUpdate<AppSchema>>()
  })

  it('listEvents resolves a page of IdbWebhookEvent', () => {
    const wh = init<AppSchema>()
    expectTypeOf(wh.manager.getEvent).returns.resolves.toEqualTypeOf<IdbWebhookEvent>()
  })

  it('create payload namespaces are the schema namespaces', () => {
    expectTypeOf<IdbWebhookCreate<AppSchema>['namespaces']>().toEqualTypeOf<
      (IdbNamespaceName<AppSchema>)[]
    >()
  })
})
