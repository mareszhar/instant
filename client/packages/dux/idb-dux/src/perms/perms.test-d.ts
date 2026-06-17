/**
 * Type-shape plane for `/perms`: the per-namespace context resolves to the
 * right expression types, refs/ruleParams type from the schema, and the
 * action-only contexts gate `eu`/`el` so misuse can't typecheck.
 */
import type { AppSchema } from '@test'
import type {
  ActionCtx,
  CommonCtx,
  Conforms,
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

  it('ActionCtx selects the right context per action', () => {
    // update gets the updated entity
    expectTypeOf<ActionCtx<AppSchema, 'tasks', {}, {}, {}, 'update'>['eu']>()
      .toEqualTypeOf<EntityExpr<AppSchema, 'tasks'>>()
    // view/delete do not
    expectTypeOf<'eu' extends keyof ActionCtx<AppSchema, 'tasks', {}, {}, {}, 'view'> ? true : false>()
      .toEqualTypeOf<false>()
    // create carries modifiedFields but not eu
    expectTypeOf<ActionCtx<AppSchema, 'tasks', {}, {}, {}, 'create'>['req']['modifiedFields']>()
      .toEqualTypeOf<ListExpr<string>>()
    expectTypeOf<'eu' extends keyof ActionCtx<AppSchema, 'tasks', {}, {}, {}, 'create'> ? true : false>()
      .toEqualTypeOf<false>()
  })
})

describe('runtime-enum conformance — .conforms()', () => {
  type FruitsCommon = CommonCtx<AppSchema, 'fruits', {}, {}, {}>
  type FruitsUpdate = UpdateCtx<AppSchema, 'fruits', {}, {}, {}>

  it('exposes conforms on a runtime-enum field only', () => {
    // `name` is a runtime enum — conforms on property access and string key, on e and eu
    expectTypeOf(({} as FruitsCommon).e.name).toExtend<Conforms>()
    expectTypeOf(({} as FruitsCommon).ef('name')).toExtend<Conforms>()
    expectTypeOf(({} as FruitsUpdate).eu.name).toExtend<Conforms>()
    // `kind` is a type-level enum (`i.string<…>()`) — narrowed but not runtime-backed
    expectTypeOf(({} as FruitsCommon).e.kind).not.toExtend<Conforms>()
    // a plain field never has it
    expectTypeOf(({} as TasksCommon).e.title).not.toExtend<Conforms>()
  })

  it('exposes conforms on a ref/auth-ref whose terminal is a runtime enum', () => {
    expectTypeOf(({} as TasksCommon).er('assignee.role')).toExtend<Conforms>()
    expectTypeOf(({} as TasksCommon).er('assignee.email')).not.toExtend<Conforms>()
    expectTypeOf(({} as TasksCommon).auth.role).toExtend<Conforms>()
    expectTypeOf(({} as TasksCommon).ar('$user.memberships.user.role')).toExtend<Conforms>()
    expectTypeOf(({} as TasksCommon).ar('$user.memberships.user.email')).not.toExtend<Conforms>()
  })
})
