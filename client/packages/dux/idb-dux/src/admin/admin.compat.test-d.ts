/**
 * Compat-target plane for `/admin`: `@instantdb/resumable-stream` consumes an
 * admin db's `streams` surface (`createReadStream`/`createWriteStream`). dux
 * doesn't wrap it — this suite locks that a dux `adminDb` exposes the same
 * streams surface the official db does, so resumable-stream works against dux
 * apps unchanged ([dux-vision.md §3.1]).
 */
import type { InstantAdminDatabase } from '@instantdb/admin'
import type { CreateResumableStreamContextOptions } from '@instantdb/resumable-stream'
import type { AppSchema } from '@test'
import type { IdbAdminClient } from './init.js'
import type { IdbAdminConfig } from './types.js'
import { describe, expectTypeOf, it } from 'vitest'

declare const adminDb: IdbAdminClient<AppSchema>
declare const config: IdbAdminConfig<AppSchema>

describe('resumable-stream compatibility', () => {
  it('the dux adminDb streams surface matches the official one', () => {
    type OfficialStreams = InstantAdminDatabase<AppSchema, false>['streams']
    expectTypeOf(adminDb.streams).toEqualTypeOf<OfficialStreams>()
  })

  it('a dux admin config supplies the credentials resumable-stream needs', () => {
    expectTypeOf(config.appId).toExtend<CreateResumableStreamContextOptions['appId']>()
    expectTypeOf(config.adminToken).toExtend<CreateResumableStreamContextOptions['adminToken']>()
    expectTypeOf(config.apiURI).toExtend<CreateResumableStreamContextOptions['apiURI']>()
  })
})
