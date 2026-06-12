import type { AppSchema } from '@test'
import { lookup, tx as officialTx } from '@instantdb/core'
import { describe, expect, it } from 'vitest'
import { typedTx } from './typedTx.js'

const tx = typedTx<AppSchema>()

describe('typedTx — dot-path link compilation', () => {
  it('compiles a dot-path key to the official lookup() wire form', () => {
    const dux = tx.memberships['m-1']!.link({ 'workspace.inviteCode': 'alpha-invite' })
    const official = officialTx.memberships!['m-1']!.link({
      workspace: lookup('inviteCode', 'alpha-invite'),
    })
    expect(dux.__ops).toEqual(official.__ops)
  })

  it('keeps plain id links untouched', () => {
    const dux = tx.tasks['t-1']!.link({ workspace: 'ws-1' })
    const official = officialTx.tasks!['t-1']!.link({ workspace: 'ws-1' })
    expect(dux.__ops).toEqual(official.__ops)
  })

  it('compiles dot-paths in unlink too', () => {
    const dux = tx.memberships['m-1']!.unlink({ 'workspace.inviteCode': 'beta-invite' })
    const official = officialTx.memberships!['m-1']!.unlink({
      workspace: lookup('inviteCode', 'beta-invite'),
    })
    expect(dux.__ops).toEqual(official.__ops)
  })

  it('mixes plain and dot-path keys in one call', () => {
    const dux = tx.tasks['t-1']!.link({
      'assignee': 'user-1',
      'workspace.inviteCode': 'alpha-invite',
    })
    const official = officialTx.tasks!['t-1']!.link({
      assignee: 'user-1',
      workspace: lookup('inviteCode', 'alpha-invite'),
    })
    expect(dux.__ops).toEqual(official.__ops)
  })
})

describe('typedTx — chain parity with the official builder', () => {
  it('produces identical ops for a full chain', () => {
    const dux = tx.workspaces['ws-1']!
      .create({ name: 'Alpha', inviteCode: 'alpha', createdAt: '2026-01-01' })
      .ruleParams({ inviteCode: 'alpha' })
    const official = officialTx.workspaces!['ws-1']!
      .create({ name: 'Alpha', inviteCode: 'alpha', createdAt: '2026-01-01' })
      .ruleParams({ inviteCode: 'alpha' })
    expect(dux.__ops).toEqual(official.__ops)
  })

  it('supports the official entity-level lookup addressing', () => {
    const dux = tx.workspaces.lookup('inviteCode', 'alpha').update({ name: 'Alpha²' })
    const official = officialTx.workspaces!.lookup!('inviteCode', 'alpha').update({
      name: 'Alpha²',
    })
    expect(dux.__ops).toEqual(official.__ops)
  })

  it('supports update opts and delete', () => {
    const dux = tx.tasks['t-1']!.update({ title: 'x' }, { upsert: false }).delete()
    const official = officialTx.tasks!['t-1']!
      .update({ title: 'x' }, { upsert: false })
      .delete()
    expect(dux.__ops).toEqual(official.__ops)
  })
})
