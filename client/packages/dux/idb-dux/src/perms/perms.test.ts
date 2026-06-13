/**
 * Runtime plane for `/perms`: the canonical app compiles to the exact CEL
 * strings Instant accepts — bind aliases emitted, staged values inlined,
 * `$default.bind` emitted once and referenced by alias, deterministic parens,
 * and every entity/ref/auth/ruleParam read pointed at the right CEL global.
 */
import type { AppSchema } from '@test'
import type { CommonCtx, Expr } from './index.js'
import { schema } from '@test'
import { describe, expect, it } from 'vitest'
import { definePerms } from './index.js'

/** Compile a single `tasks` view rule and return its CEL — the expression probe. */
function view(build: (ctx: CommonCtx<AppSchema, 'tasks', {}, {}, {}>) => Expr<boolean> | boolean): string {
  const rules = definePerms(schema)
    .namespaces({ tasks: ns => ns.allow({ view: build }) })
    .compile() as any
  return rules.tasks.allow.view
}

describe('definePerms — the canonical app', () => {
  const rules = definePerms(schema)
    .attrs(a => a.allow({ create: false }))
    .defaults(d => d
      .bind(({ auth }) => ({
        isSignedIn: auth.id.neq(null),
      }))
      .allow({ $default: false }))
    .namespaces({
      $users: ns => ns
        .bind(({ auth, e, er }) => ({
          isSelf: auth.id.eq(e.id),
          sharesWorkspace: er('memberships.workspace.memberships.user.id').contains(auth.id),
        }))
        .allow(({ b }) => ({
          view: b.isSelf.or(b.sharesWorkspace),
          create: true,
          update: b.isSelf,
        }))
        .fields(({ b }) => ({
          email: b.isSelf.or(b.sharesWorkspace),
        })),
      workspaces: ns => ns
        .stage(({ rp, e }) => ({
          inviteCode: rp('inviteCode'),
          inviteMatches: rp('inviteCode').eq(e.inviteCode),
        }))
        .bind(({ auth, er, s }) => ({
          isMember: er('memberships.user.id').contains(auth.id),
          hasInviteCode: s.inviteCode.neq(null).and(s.inviteMatches),
        }))
        .allow(({ b }) => ({
          view: b.isMember.or(b.hasInviteCode),
          create: b.isSignedIn,
          update: b.isMember,
          delete: b.isMember,
        })),
      memberships: ns => ns
        .bind(({ auth, er, rp }) => ({
          isMember: er('workspace.memberships.user.id').contains(auth.id),
          isSelf: er('user.id').contains(auth.id),
          hasInviteCode: rp('inviteCode').neq(null).and(er('workspace.inviteCode').contains(rp('inviteCode'))),
        }))
        .allow(({ b }) => ({
          view: b.isMember,
          create: b.isSignedIn,
          update: b.isSelf,
          delete: b.isSelf,
          link: {
            user: ({ auth, el }) => el.id.eq(auth.id),
            workspace: ({ rp, el }) => b.isMember.or(
              rp('inviteCode').neq(null).and(el.inviteCode.eq(rp('inviteCode'))),
            ),
          },
          unlink: {
            user: b.isSelf,
            workspace: b.isSelf,
          },
        })),
      tasks: ns => ns
        .bind(({ auth, er }) => ({
          isMember: er('workspace.memberships.user.id').contains(auth.id),
        }))
        .allow(({ b }) => ({
          view: b.isMember,
          create: b.isSignedIn.and(b.isMember),
          update: b.isMember,
          delete: b.isMember,
          link: {
            workspace: b.isMember,
            assignee: ({ el, er }) => b.isMember.and(
              er('workspace.memberships.user.id').contains(el.id),
            ),
          },
          unlink: {
            workspace: false,
            assignee: b.isMember,
          },
        })),
    })
    .compile() as any

  it('emits attrs create-only', () => {
    expect(rules.attrs).toEqual({ allow: { create: 'false' } })
  })

  it('emits $default.bind once and the $default allow', () => {
    expect(rules.$default).toEqual({
      bind: { isSignedIn: 'auth.id != null' },
      allow: { $default: 'false' },
    })
  })

  it('binds read the right CEL globals; refs become data.ref()', () => {
    expect(rules.$users.bind).toEqual({
      isSelf: 'auth.id == data.id',
      sharesWorkspace: 'auth.id in data.ref(\'memberships.workspace.memberships.user.id\')',
    })
  })

  it('references binds by bare alias in allow', () => {
    expect(rules.$users.allow).toEqual({
      view: 'isSelf || sharesWorkspace',
      create: 'true',
      update: 'isSelf',
    })
    expect(rules.$users.fields).toEqual({
      email: 'isSelf || sharesWorkspace',
    })
  })

  it('inlines staged values (never emits them) and resolves ruleParams', () => {
    expect(rules.workspaces.bind).toEqual({
      isMember: 'auth.id in data.ref(\'memberships.user.id\')',
      hasInviteCode: 'ruleParams.inviteCode != null && ruleParams.inviteCode == data.inviteCode',
    })
    // staged inviteCode/inviteMatches are authoring-only — not in the output
    expect(Object.keys(rules.workspaces.bind)).toEqual(['isMember', 'hasInviteCode'])
    expect(rules.workspaces.allow).toEqual({
      view: 'isMember || hasInviteCode',
      create: 'isSignedIn',
      update: 'isMember',
      delete: 'isMember',
    })
  })

  it('link rules read the linked entity via linkedData (per-label)', () => {
    expect(rules.memberships.allow.link).toEqual({
      user: 'linkedData.id == auth.id',
      workspace: 'isMember || ruleParams.inviteCode != null && linkedData.inviteCode == ruleParams.inviteCode',
    })
    expect(rules.memberships.allow.unlink).toEqual({
      user: 'isSelf',
      workspace: 'isSelf',
    })
  })

  it('mixes current-entity ref with linked id in a task link rule', () => {
    expect(rules.tasks.allow.link).toEqual({
      workspace: 'isMember',
      assignee: 'isMember && linkedData.id in data.ref(\'workspace.memberships.user.id\')',
    })
    expect(rules.tasks.allow.create).toBe('isSignedIn && isMember')
    expect(rules.tasks.allow.unlink).toEqual({ workspace: 'false', assignee: 'isMember' })
  })
})

describe('expression breadth — list methods', () => {
  it('isEmpty / isNonEmpty / size / at', () => {
    expect(view(({ er }) => er('workspace.memberships.user.id').isEmpty()))
      .toBe('data.ref(\'workspace.memberships.user.id\') == []')
    expect(view(({ er }) => er('workspace.memberships.user.id').isNonEmpty()))
      .toBe('data.ref(\'workspace.memberships.user.id\') != []')
    expect(view(({ er }) => er('workspace.memberships.user.id').size().lte(2)))
      .toBe('size(data.ref(\'workspace.memberships.user.id\')) <= 2')
    expect(view(({ er, auth }) => er('workspace.memberships.user.id').at(0).eq(auth.id)))
      .toBe('data.ref(\'workspace.memberships.user.id\')[0] == auth.id')
  })

  it('some / every compile to CEL exists / all macros, naming the variable', () => {
    expect(view(({ er, auth }) => er('workspace.memberships.user.id').some(uid => uid.eq(auth.id))))
      .toBe('data.ref(\'workspace.memberships.user.id\').exists(uid, uid == auth.id)')
    expect(view(({ er, auth }) => er('workspace.memberships.user.id').every(uid => uid.eq(auth.id))))
      .toBe('data.ref(\'workspace.memberships.user.id\').all(uid, uid == auth.id)')
  })
})

describe('expression breadth — functional helpers', () => {
  it('and / or fold, not wraps', () => {
    expect(view(({ f, auth }) => f.or(auth.id.eq('a'), auth.id.eq('b'))))
      .toBe('auth.id == \'a\' || auth.id == \'b\'')
    expect(view(({ f, e }) => f.and(e.isDone.eq(true), e.title.eq('x'), e.notes.eq('y'))))
      .toBe('data.isDone == true && data.title == \'x\' && data.notes == \'y\'')
    expect(view(({ f, e }) => f.not(e.isDone.eq(true)))).toBe('!(data.isDone == true)')
  })

  it('list / in / contains / size / null', () => {
    expect(view(({ f, e }) => f.in(e.title, ['a', 'b']))).toBe('data.title in [\'a\', \'b\']')
    expect(view(({ f, er, auth }) => f.contains(er('workspace.memberships.user.id'), auth.id)))
      .toBe('auth.id in data.ref(\'workspace.memberships.user.id\')')
    expect(view(({ f, e }) => f.eq(f.list('a', 'b').size(), 2) as any))
      .toBe('size([\'a\', \'b\']) == 2')
    expect(view(({ f, e }) => e.notes.eq(f.null() as any))).toBe('data.notes == null')
  })
})

describe('expression breadth — raw + deterministic parens', () => {
  it('raw passes through and is always wrapped when composed', () => {
    expect(view(({ raw }) => raw('auth.email.endsWith(\'@x.com\')')))
      .toBe('auth.email.endsWith(\'@x.com\')')
    expect(view(({ f, raw, auth }) => f.and(raw('a || b'), auth.id.eq('x'))))
      .toBe('(a || b) && auth.id == \'x\'')
  })

  it('parenthesizes only where CEL precedence requires it', () => {
    // && binds tighter than ||, so the and-group needs no parens under or
    expect(view(({ e }) => e.isDone.eq(true).and(e.title.eq('x')).or(e.notes.eq('y'))))
      .toBe('data.isDone == true && data.title == \'x\' || data.notes == \'y\'')
    // an or-group under && does need them
    expect(view(({ e }) => e.isDone.eq(true).or(e.title.eq('x')).and(e.notes.eq('y'))))
      .toBe('(data.isDone == true || data.title == \'x\') && data.notes == \'y\'')
  })
})

describe('rate limits', () => {
  it('passes the config through and renders rl usage', () => {
    const rules = definePerms(schema)
      .rateLimits({
        createTask: { limits: [{ capacity: 10, refill: { period: '1 minute' } }] },
      })
      .namespaces({
        tasks: ns => ns.allow(({ rl, auth }) => ({ create: rl.createTask.limit(auth.id) })),
      })
      .compile() as any
    expect(rules.$rateLimits).toEqual({
      createTask: { limits: [{ capacity: 10, refill: { period: '1 minute' } }] },
    })
    expect(rules.tasks.allow.create).toBe('rateLimit.createTask.limit(auth.id)')
  })
})

describe('runtime schema validation (definePerms(schema))', () => {
  it('throws on an unknown namespace', () => {
    expect(() => definePerms(schema).namespaces({ nope: (ns: any) => ns } as any))
      .toThrow(/not a namespace/)
  })

  it('throws on an unknown field', () => {
    expect(() => definePerms(schema).namespaces({
      tasks: ns => ns.bind(({ e }) => ({ x: (e as any).nope })),
    })).toThrow(/not a field/)
  })

  it('throws on an invalid ref path', () => {
    expect(() => definePerms(schema).namespaces({
      tasks: ns => ns.bind(({ er }) => ({ x: er('workspace.nope' as any) } as any)),
    })).toThrow(/ref path/)
  })

  it('throws on an undeclared ruleParam', () => {
    expect(() => definePerms(schema).namespaces({
      tasks: ns => ns.bind(({ rp }) => ({ x: (rp as any)('nope') })),
    })).toThrow(/ruleParam/)
  })

  it('throws on a duplicate bind name', () => {
    expect(() => definePerms(schema).namespaces({
      tasks: ns => ns
        .bind(({ auth }) => ({ dup: auth.id.neq(null) }))
        .bind(({ auth }) => ({ dup: auth.id.eq(null) } as any)),
    })).toThrow(/already defined/)
  })

  it('does not validate in type-only mode (no schema value)', () => {
    expect(() => definePerms<typeof schema>().namespaces({
      tasks: ns => ns.bind(({ er }) => ({ x: er('workspace.nope' as any) } as any)),
    }).compile()).not.toThrow()
  })
})

describe('action-specific stageFor / bindFor', () => {
  it('bindFor emits into the namespace bind block, usable in its action', () => {
    const r = definePerms(schema).namespaces({
      tasks: ns => ns
        .bind(({ auth, er }) => ({ isMember: er('workspace.memberships.user.id').contains(auth.id) }))
        .bindFor('update', ({ e, eu }) => ({ titleChanged: eu.title.neq(e.title) }))
        .allow({ update: ({ b }) => b.isMember.and(b.titleChanged) }),
    }).compile() as any
    expect(r.tasks.bind).toEqual({
      isMember: 'auth.id in data.ref(\'workspace.memberships.user.id\')',
      titleChanged: 'newData.title != data.title',
    })
    expect(r.tasks.allow.update).toBe('isMember && titleChanged')
  })

  it('stageFor stays authoring-only (inlined, never emitted)', () => {
    const r = definePerms(schema).namespaces({
      tasks: ns => ns
        .stageFor('update', ({ e, eu }) => ({ titleChanged: eu.title.neq(e.title) }))
        .allow({ update: ({ s }) => s.titleChanged }),
    }).compile() as any
    expect(r.tasks.allow.update).toBe('newData.title != data.title')
    expect(r.tasks.bind).toBeUndefined()
  })

  it('bindFor(link, label) scopes el to the linked namespace', () => {
    const r = definePerms(schema).namespaces({
      memberships: ns => ns
        .bindFor('link', 'user', ({ auth, el }) => ({ linksSelf: el.id.eq(auth.id) }))
        .allow({ link: { user: ({ b }) => b.linksSelf } }),
    }).compile() as any
    expect(r.memberships.bind).toEqual({ linksSelf: 'linkedData.id == auth.id' })
    expect(r.memberships.allow.link).toEqual({ user: 'linksSelf' })
  })

  it('stageFor(link, label) inlines per-label staged values', () => {
    const r = definePerms(schema).namespaces({
      memberships: ns => ns
        .stageFor('link', 'workspace', ({ rp, el }) => ({ codeMatches: el.inviteCode.eq(rp('inviteCode')) }))
        .allow({ link: { workspace: ({ s }) => s.codeMatches } }),
    }).compile() as any
    expect(r.memberships.allow.link).toEqual({ workspace: 'linkedData.inviteCode == ruleParams.inviteCode' })
    expect(r.memberships.bind).toBeUndefined()
  })

  it('rejects an action bind name that clashes with a common bind', () => {
    expect(() => definePerms(schema).namespaces({
      tasks: ns => ns
        .bind(({ auth }) => ({ dup: auth.id.neq(null) }))
        .bindFor('update', ({ eu }) => ({ dup: eu.title.neq(null) } as any)),
    })).toThrow(/already defined/)
  })
})
