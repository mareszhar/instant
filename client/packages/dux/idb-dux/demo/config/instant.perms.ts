// Typed permissions, authored against the schema and compiled to the plain
// rules object Instant accepts.
// Docs: https://github.com/mareszhar/instant/blob/dux/client/packages/dux/docs/dux-spec-perms.md
import { definePerms } from '@mszr/idb-dux/perms'
import { schema } from './instant.schema'

export default definePerms(schema)
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
        hasInviteCode: rp('inviteCode').neq(null).and(
          er('workspace.inviteCode').contains(rp('inviteCode')),
        ),
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
  .compile()
