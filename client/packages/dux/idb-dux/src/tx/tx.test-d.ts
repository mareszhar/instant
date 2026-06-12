import type { TransactionChunk } from '@instantdb/core'
import type { AppSchema } from '@test'
import type { IdbTxLink, IdbTxRuleParams } from './types.js'
import { describe, expectTypeOf, it } from 'vitest'
import { typedTx } from './typedTx.js'

const tx = typedTx<AppSchema>()

describe('typed tx — type shapes', () => {
  it('types plain link keys per label cardinality', () => {
    type Link = IdbTxLink<'tasks', AppSchema>
    expectTypeOf<Link['workspace']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<Link['subtasks']>().toEqualTypeOf<string | readonly string[] | undefined>()
  })

  it('narrows dot-path keys to the linked namespace unique fields', () => {
    type Link = IdbTxLink<'memberships', AppSchema>
    expectTypeOf<Link['workspace.inviteCode']>().toEqualTypeOf<string | undefined>()
    // user has one unique field, email
    expectTypeOf<Link['user.email']>().toEqualTypeOf<string | undefined>()
  })

  it('types ruleParams from the schema declaration', () => {
    expectTypeOf<IdbTxRuleParams<'workspaces', AppSchema>>().toEqualTypeOf<{
      inviteCode: string
    }>()
    expectTypeOf<IdbTxRuleParams<'memberships', AppSchema>>().toEqualTypeOf<{
      inviteCode?: string
    }>()
  })

  it('carries the official __ops/__etype runtime shape transact consumes', () => {
    const chunk = tx.tasks['t-1']!.update({ title: 'x' })
    // the op list satisfies what core's transact reads off a chunk
    const ops: TransactionChunk<any, any>['__ops'] = chunk.__ops
    expectTypeOf(ops).toEqualTypeOf<TransactionChunk<any, any>['__ops']>()
    expectTypeOf(chunk.__etype).toExtend<TransactionChunk<any, any>['__etype']>()
  })

  it('types entity-level lookup over unique fields', () => {
    expectTypeOf(tx.workspaces.lookup)
      .parameter(0)
      .toEqualTypeOf<'inviteCode'>()
  })
})
