/**
 * Compat-target plane: dux's authored-fresh handler surface stays a valid
 * input to the official `@instantdb/webhooks` package. dux owns the dialect;
 * the backend-facing contract is that the output still satisfies the wrapped
 * tool (dux-vision.md §1.2). If upstream moves these shapes, this suite fails
 * before a user does.
 *
 * The one deliberate divergence: dux's broad `$default` change is distributed
 * over the namespace (you can narrow `change.namespace` to the matching entity),
 * where the official broad record leaves `namespace` a coarse union. That makes
 * dux richer, not narrower — so the lock here is (1) per-`(ns, action)` record
 * identity, (2) namespace-scoped maps assign straight to official, and (3)
 * every concrete official record is accepted by a dux `$default`, which is what
 * makes dispatching real deliveries through dux handlers sound.
 */
import type {
  WebhookHandlers,
  WebhookPayload,
  WebhookPayloadRecordFor,
} from '@instantdb/webhooks'
import type { AppSchema } from '@test'
import type { IdbWebhookChange, IdbWebhookHandlers, IdbWebhookPayload } from './types.js'
import { describe, expectTypeOf, it } from 'vitest'

describe('webhooks — official compatibility', () => {
  it('a per-(ns, action) change is exactly the official per-record type', () => {
    expectTypeOf<IdbWebhookChange<'tasks', 'create', AppSchema>>().toExtend<
      WebhookPayloadRecordFor<AppSchema, 'tasks', 'create'>
    >()
    expectTypeOf<WebhookPayloadRecordFor<AppSchema, 'tasks', 'create'>>().toExtend<
      IdbWebhookChange<'tasks', 'create', AppSchema>
    >()
  })

  it('a namespace-scoped handler map is assignable to official WebhookHandlers', () => {
    expectTypeOf<Omit<IdbWebhookHandlers<AppSchema>, '$default'>>().toExtend<
      WebhookHandlers<AppSchema>
    >()
  })

  it('a dux $default accepts every concrete official record (dispatch is sound)', () => {
    type IdbDuxDefault = NonNullable<IdbWebhookHandlers<AppSchema>['$default']>
    expectTypeOf<WebhookPayloadRecordFor<AppSchema, 'tasks', 'create'>>().toExtend<
      Parameters<IdbDuxDefault>[0]
    >()
    expectTypeOf<WebhookPayloadRecordFor<AppSchema, 'reports', 'delete'>>().toExtend<
      Parameters<IdbDuxDefault>[0]
    >()
  })

  it('IdbWebhookPayload is the official WebhookPayload', () => {
    expectTypeOf<IdbWebhookPayload<AppSchema>>().toEqualTypeOf<WebhookPayload<AppSchema>>()
  })
})
