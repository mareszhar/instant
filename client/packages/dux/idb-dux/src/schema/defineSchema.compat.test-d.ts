/**
 * Compatibility-target suite, type plane: dux schema output is a valid
 * platform API push input *by construction*.
 */
import type { PlatformApi } from '@instantdb/platform'
import type { AppSchema } from '@test'
import { describe, expectTypeOf, it } from 'vitest'

type SchemaPushBody = Parameters<PlatformApi['schemaPush']>[1]

describe('defineSchema — platform compatibility (type plane)', () => {
  it('is a valid schemaPush body schema', () => {
    expectTypeOf<AppSchema>().toExtend<SchemaPushBody['schema']>()
  })
})
