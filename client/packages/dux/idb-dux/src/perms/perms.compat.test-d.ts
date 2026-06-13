/**
 * Compat-target plane for `/perms`: the compiled object is the official
 * `InstantRules` shape, so `instant-cli push perms` (which evaluates the file)
 * and the platform API consume `definePerms(...).compile()` unchanged
 * (dux-spec-perms.md §13). If upstream moves the rules shape, this fails first.
 */
import type { InstantRules } from '@instantdb/core'
import type { AppSchema } from '@test'
import type { IdbPerms } from './index.js'
import { schema } from '@test'
import { describe, expectTypeOf, it } from 'vitest'
import { definePerms } from './index.js'

describe('perms — official compatibility', () => {
  it('IdbPerms is the official InstantRules shape', () => {
    expectTypeOf<IdbPerms<AppSchema>>().toEqualTypeOf<InstantRules<AppSchema>>()
  })

  it('compile() output is assignable to InstantRules', () => {
    const rules = definePerms(schema)
      .namespaces({ tasks: ns => ns.allow({ view: true }) })
      .compile()
    expectTypeOf(rules).toExtend<InstantRules<AppSchema>>()
  })
})
