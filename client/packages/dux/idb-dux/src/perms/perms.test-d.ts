/**
 * Type-shape plane for `/perms`: the per-namespace context resolves to the
 * right expression types, refs/ruleParams type from the schema, and the
 * action-only contexts gate `eu`/`el` so misuse can't typecheck.
 */
import type { AppSchema } from '@test'
import type {
  CommonCtx,
  EntityExpr,
  Expr,
  LinkCtx,
  ListExpr,
  RefPath,
  RefTerminal,
  UpdateCtx,
} from './index.js'
import { describe, expectTypeOf, it } from 'vitest'

type TasksCommon = CommonCtx<AppSchema, 'tasks', {}, {}, {}>
type WorkspacesCommon = CommonCtx<AppSchema, 'workspaces', {}, {}, {}>

describe('common context — entity reads', () => {
  it('e is the namespace entity, fields typed', () => {
    expectTypeOf<TasksCommon['e']>().toEqualTypeOf<EntityExpr<AppSchema, 'tasks'>>()
    expectTypeOf<TasksCommon['e']['title']>().toEqualTypeOf<Expr<string>>()
    expectTypeOf<TasksCommon['e']['isDone']>().toEqualTypeOf<Expr<boolean>>()
    expectTypeOf<TasksCommon['e']['id']>().toEqualTypeOf<Expr<string>>()
  })

  it('ef resolves the field value type from a string key', () => {
    expectTypeOf(({} as TasksCommon).ef('title')).toEqualTypeOf<Expr<string>>()
    expectTypeOf(({} as TasksCommon).ef('isDone')).toEqualTypeOf<Expr<boolean>>()
  })
})

describe('refs and ruleParams', () => {
  it('a ref path terminates in the attribute value type', () => {
    expectTypeOf<RefTerminal<AppSchema, 'tasks', 'workspace.memberships.user.id'>>()
      .toEqualTypeOf<string>()
    expectTypeOf<RefTerminal<AppSchema, 'tasks', 'assignee.email'>>().toEqualTypeOf<string>()
    expectTypeOf<RefTerminal<AppSchema, 'reports', 'analyses.score'>>().toEqualTypeOf<number>()
  })

  it('valid ref paths are members of the namespace RefPath union', () => {
    expectTypeOf<'workspace.memberships.user.id'>().toExtend<RefPath<AppSchema, 'tasks'>>()
    expectTypeOf<'assignee.email'>().toExtend<RefPath<AppSchema, 'tasks'>>()
  })

  it('er returns a list expression', () => {
    expectTypeOf(({} as TasksCommon).er('assignee.email')).toEqualTypeOf<ListExpr<string>>()
  })

  it('rp types from the namespace ruleParams declaration', () => {
    expectTypeOf(({} as WorkspacesCommon).rp('inviteCode')).toEqualTypeOf<Expr<string>>()
  })
})

describe('action-specific contexts', () => {
  it('update context exposes eu; common does not', () => {
    expectTypeOf<UpdateCtx<AppSchema, 'tasks', {}, {}, {}>['eu']>()
      .toEqualTypeOf<EntityExpr<AppSchema, 'tasks'>>()
    expectTypeOf<'eu' extends keyof TasksCommon ? true : false>().toEqualTypeOf<false>()
  })

  it('link context exposes el typed per link label', () => {
    // assignee → $users
    expectTypeOf<LinkCtx<AppSchema, 'tasks', 'assignee', {}, {}, {}>['el']>()
      .toEqualTypeOf<EntityExpr<AppSchema, '$users'>>()
    // workspace → workspaces
    expectTypeOf<LinkCtx<AppSchema, 'tasks', 'workspace', {}, {}, {}>['el']>()
      .toEqualTypeOf<EntityExpr<AppSchema, 'workspaces'>>()
    expectTypeOf<'el' extends keyof TasksCommon ? true : false>().toEqualTypeOf<false>()
  })

  it('create/update requests carry modifiedFields; common does not', () => {
    expectTypeOf<UpdateCtx<AppSchema, 'tasks', {}, {}, {}>['req']['modifiedFields']>()
      .toEqualTypeOf<ListExpr<string>>()
    expectTypeOf<'modifiedFields' extends keyof TasksCommon['req'] ? true : false>()
      .toEqualTypeOf<false>()
  })
})
