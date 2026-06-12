/**
 * Runtime plane for `/webhooks`: handler merging, dispatch precedence and
 * retry semantics, and dispatch parity against the official pipeline.
 *
 * `verify`/`fetchPayload`/`process` are thin pass-throughs to the wrapped
 * package; their crypto/network mechanics are the official package's tests.
 * Dispatch is the only branching verb, so it carries the parity weight here —
 * plus the wiring smoke tests that prove each rename reaches its official verb.
 */
import type { AppSchema } from '@test'
import type { IdbWebhookChange, IdbWebhookHandlers, IdbWebhookPayload } from './types.js'
import { Webhooks } from '@instantdb/webhooks'
import { describe, expect, it, vi } from 'vitest'
import { defineWebhookHandlers } from './defineWebhookHandlers.js'
import { init } from './init.js'

type Action = 'create' | 'update' | 'delete'

function change(namespace: string, action: Action, id = 'r1'): IdbWebhookChange {
  return {
    namespace,
    id,
    action,
    before: action === 'create' ? null : { id, title: 'before' },
    after: action === 'delete' ? null : { id, title: 'after' },
    idempotencyKey: `${namespace}-${action}-${id}`,
  } as unknown as IdbWebhookChange
}

function payload(changes: IdbWebhookChange[]): IdbWebhookPayload<AppSchema> {
  return { data: changes, idempotencyKey: 'k' } as unknown as IdbWebhookPayload<AppSchema>
}

const webhooks = init<AppSchema>()

describe('defineWebhookHandlers — merging', () => {
  it('merges entries for different namespaces', () => {
    const onTask = vi.fn()
    const onReport = vi.fn()
    const handlers = defineWebhookHandlers<AppSchema>(
      { tasks: { create: onTask } },
      { reports: { delete: onReport } },
    )
    expect(handlers).toEqual({ tasks: { create: onTask }, reports: { delete: onReport } })
  })

  it('merges actions within the same namespace', () => {
    const onCreate = vi.fn()
    const onUpdate = vi.fn()
    const onDefault = vi.fn()
    const handlers = defineWebhookHandlers<AppSchema>(
      { tasks: { create: onCreate } },
      { tasks: { update: onUpdate, $default: onDefault } },
    )
    expect(handlers).toEqual({ tasks: { create: onCreate, update: onUpdate, $default: onDefault } })
  })

  it('later entries override earlier ones for the same namespace.action', () => {
    const first = vi.fn()
    const second = vi.fn()
    const handlers = defineWebhookHandlers<AppSchema>(
      { tasks: { create: first } },
      { tasks: { create: second } },
    )
    expect(handlers.tasks!.create).toBe(second)
  })

  it('later top-level $default replaces the earlier one wholesale', () => {
    const first = vi.fn()
    const second = vi.fn()
    const handlers = defineWebhookHandlers<AppSchema>({ $default: first }, { $default: second })
    expect(handlers.$default).toBe(second)
  })

  it('top-level $default does not touch per-namespace handlers', () => {
    const onTask = vi.fn()
    const top = vi.fn()
    const handlers = defineWebhookHandlers<AppSchema>(
      { tasks: { create: onTask } },
      { $default: top },
    )
    expect(handlers).toEqual({ tasks: { create: onTask }, $default: top })
  })

  it('returns an empty map when given no entries', () => {
    expect(defineWebhookHandlers<AppSchema>()).toEqual({})
  })
})

describe('dispatch — resolution order', () => {
  it('exact namespace.action wins over both $default levels', async () => {
    const exact = vi.fn()
    const nsDefault = vi.fn()
    const top = vi.fn()
    await webhooks.dispatch(
      { tasks: { create: exact, $default: nsDefault }, $default: top } as IdbWebhookHandlers<AppSchema>,
      payload([change('tasks', 'create')]),
    )
    expect(exact).toHaveBeenCalledTimes(1)
    expect(nsDefault).not.toHaveBeenCalled()
    expect(top).not.toHaveBeenCalled()
  })

  it('namespace $default wins over top-level $default', async () => {
    const nsDefault = vi.fn()
    const top = vi.fn()
    await webhooks.dispatch(
      { tasks: { $default: nsDefault }, $default: top } as IdbWebhookHandlers<AppSchema>,
      payload([change('tasks', 'update')]),
    )
    expect(nsDefault).toHaveBeenCalledTimes(1)
    expect(top).not.toHaveBeenCalled()
  })

  it('top-level $default catches changes with no namespace match', async () => {
    const top = vi.fn()
    await webhooks.dispatch(
      { tasks: { create: vi.fn() }, $default: top } as IdbWebhookHandlers<AppSchema>,
      payload([change('reports', 'delete')]),
    )
    expect(top).toHaveBeenCalledTimes(1)
    expect(top.mock.calls[0]![0].namespace).toBe('reports')
  })

  it('changes with no matching handler are skipped without error', async () => {
    const create = vi.fn()
    await expect(
      webhooks.dispatch(
        { tasks: { create } } as IdbWebhookHandlers<AppSchema>,
        payload([change('tasks', 'create', 'a'), change('tasks', 'update', 'b'), change('reports', 'delete', 'c')]),
      ),
    ).resolves.toBeUndefined()
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]![0].id).toBe('a')
  })

  it('routes each change to its own most-specific handler', async () => {
    const create = vi.fn()
    const nsDefault = vi.fn()
    const top = vi.fn()
    await webhooks.dispatch(
      { tasks: { create, $default: nsDefault }, $default: top } as IdbWebhookHandlers<AppSchema>,
      payload([change('tasks', 'create', 'a'), change('tasks', 'update', 'b'), change('reports', 'delete', 'c')]),
    )
    expect(create.mock.calls[0]![0].id).toBe('a')
    expect(nsDefault.mock.calls[0]![0].id).toBe('b')
    expect(top.mock.calls[0]![0].id).toBe('c')
  })
})

describe('dispatch — retry semantics', () => {
  it('rejects when any handler rejects, so process returns non-2xx and Instant retries', async () => {
    const ok = vi.fn().mockResolvedValue(undefined)
    const bad = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(
      webhooks.dispatch(
        { tasks: { create: ok, update: bad } } as IdbWebhookHandlers<AppSchema>,
        payload([change('tasks', 'create', 'a'), change('tasks', 'update', 'b')]),
      ),
    ).rejects.toThrow('boom')
    expect(ok).toHaveBeenCalledTimes(1)
    expect(bad).toHaveBeenCalledTimes(1)
  })
})

describe('dispatch — parity with the official pipeline', () => {
  it('routes identically to official processPayload on a shared fixture', async () => {
    const fixture = payload([
      change('tasks', 'create', 'a'),
      change('tasks', 'update', 'b'),
      change('reports', 'delete', 'c'),
    ])
    const calls = (handler: (id: string) => void) =>
      ({
        tasks: { create: (c: any) => handler(`tasks.create:${c.id}`), $default: (c: any) => handler(`tasks.$default:${c.id}`) },
        $default: (c: any) => handler(`$default:${c.id}`),
      })

    const duxSeen: string[] = []
    await webhooks.dispatch(calls(s => duxSeen.push(s)) as IdbWebhookHandlers<AppSchema>, fixture)

    const officialSeen: string[] = []
    const official = new Webhooks<AppSchema>({ appId: 'app', adminToken: 'tok' })
    await official.processPayload(calls(s => officialSeen.push(s)) as any, fixture as any)

    expect(duxSeen.sort()).toEqual(officialSeen.sort())
    expect(duxSeen.sort()).toEqual(['$default:c', 'tasks.$default:b', 'tasks.create:a'])
  })
})

describe('init — verb wiring and capability gating', () => {
  it('exposes the full pipeline plus the manager', () => {
    const wh = init()
    expect(typeof wh.verify).toBe('function')
    expect(typeof wh.fetchPayload).toBe('function')
    expect(typeof wh.dispatch).toBe('function')
    expect(typeof wh.process).toBe('function')
    expect(typeof wh.processNode).toBe('function')
    expect(typeof wh.manager.create).toBe('function')
  })

  it('verify reaches the official verifier (rejects a malformed signature)', async () => {
    await expect(init().verify({ signature: 'garbage', body: '{}' })).rejects.toThrow(
      /Invalid Instant-Signature header/,
    )
  })

  it('manager requires credentials — throws without appId', async () => {
    await expect(init().manager.list()).rejects.toThrow(/appId/)
  })
})
