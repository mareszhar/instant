/**
 * The admin data plane — `query` and `subscribeQuery` shaped through the same
 * `shapeResult` the client uses ([dux-spec-admin.md §3]). The admin surface
 * contains zero shaping logic of its own: it wires the query out (`toWireQuery`)
 * and reshapes what comes back (`shapeResult`), so a one-shot and a
 * subscription of the same query deliver the same shape by construction.
 */
import type { InstantAdminDatabase } from '@instantdb/admin'
import type { IdbSchema } from '../schema/defineSchema.js'
import type {
  IdbQuerySubscription,
  IdbQuerySubscriptionCallback,
  IdbQuerySubscriptionPayload,
} from './types.js'
import { shapeResult, toWireQuery } from '../query/index.js'

type AnyRecord = Record<string, any>
type OfficialDb = InstantAdminDatabase<any, false>

/** Shape one subscription emission's `data`, leaving the error arm untouched. */
function shapePayload(
  payload: AnyRecord,
  query: AnyRecord,
  schema: IdbSchema,
): AnyRecord {
  if (payload.type !== 'ok')
    return payload
  return { ...payload, data: shapeResult(payload.data, query, schema) }
}

/** Run a one-shot read and shape the result. */
export async function runQuery(
  official: OfficialDb,
  schema: IdbSchema,
  query: AnyRecord,
  opts: AnyRecord | undefined,
): Promise<AnyRecord> {
  const data = await official.query(toWireQuery(query) as any, opts as any)
  return shapeResult(data, query, schema)
}

/**
 * Subscribe, shaping each emission. The official callback and async-iterator
 * contracts are preserved; only `data` is reshaped on the way through.
 */
export function runSubscribeQuery<Q, S extends IdbSchema>(
  official: OfficialDb,
  schema: IdbSchema,
  query: AnyRecord,
  cb: IdbQuerySubscriptionCallback<Q, S> | undefined,
  opts: AnyRecord | undefined,
): IdbQuerySubscription<Q, S> {
  const wire = toWireQuery(query)
  const wrappedCb = cb
    ? (payload: AnyRecord) =>
        cb(shapePayload(payload, query, schema) as IdbQuerySubscriptionPayload<Q, S>)
    : undefined
  const sub = official.subscribeQuery(wire as any, wrappedCb as any, opts as any)

  async function* shaped(): AsyncIterableIterator<IdbQuerySubscriptionPayload<Q, S>> {
    for await (const payload of sub)
      yield shapePayload(payload as AnyRecord, query, schema) as IdbQuerySubscriptionPayload<Q, S>
  }

  return {
    close: () => sub.close(),
    [Symbol.iterator]: () => sub[Symbol.iterator](),
    [Symbol.asyncIterator]: () => shaped(),
    get readyState() {
      return sub.readyState
    },
    get isClosed() {
      return sub.isClosed
    },
    get sessionInfo() {
      return sub.sessionInfo
    },
  }
}
