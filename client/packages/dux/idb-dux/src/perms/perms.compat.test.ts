/**
 * Compat-target runtime: `instant-cli push perms` evaluates `instant.perms.ts`
 * and sends the default export to the backend, so the compiled object must be
 * a plain JSON-serializable tree of CEL strings — no class instances, no
 * functions left behind (dux-spec-perms.md §13).
 */
import { schema } from '@test'
import { describe, expect, it } from 'vitest'
import { definePerms } from './index.js'

describe('perms — push fixture', () => {
  const rules = definePerms(schema)
    .attrs(a => a.allow({ create: false }))
    .defaults(d => d
      .bind(({ auth }) => ({ isSignedIn: auth.id.neq(null) }))
      .allow({ $default: false }))
    .namespaces({
      tasks: ns => ns
        .bind(({ auth, er }) => ({ isMember: er('workspace.memberships.user.id').contains(auth.id) }))
        .allow(({ b }) => ({ view: b.isMember, create: b.isSignedIn })),
    })
    .compile()

  it('round-trips through JSON unchanged (plain CEL strings)', () => {
    expect(JSON.parse(JSON.stringify(rules))).toEqual(rules)
  })

  it('every allow value is a string', () => {
    const allow = (rules as any).tasks.allow
    for (const value of Object.values(allow))
      expect(typeof value).toBe('string')
  })
})
