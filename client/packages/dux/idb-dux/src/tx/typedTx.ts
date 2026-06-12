/**
 * The typed tx runtime: core's `txInit()` proxy wrapped so `.link()`/
 * `.unlink()` dot-path keys compile to the official `lookup()` wire form.
 * Everything else passes through untouched — the chain stays core's chain.
 */
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type { IdbTx } from './types.js'
import { lookup, txInit } from '@instantdb/core'

/** `{ 'workspace.inviteCode': code }` → `{ workspace: lookup('inviteCode', code) }` */
function compileLinkArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    const dot = key.indexOf('.')
    if (dot === -1)
      out[key] = value
    else
      out[key.slice(0, dot)] = lookup(key.slice(dot + 1), value)
  }
  return out
}

function wrapChunk(chunk: any): any {
  return new Proxy(chunk, {
    get(target, prop) {
      if (prop === 'link' || prop === 'unlink') {
        return (args: Record<string, unknown>) =>
          wrapChunk(target[prop](compileLinkArgs(args)))
      }
      const member = target[prop]
      if (typeof member === 'function')
        return (...args: unknown[]) => wrapChunk(member(...args))
      return member
    },
  })
}

function wrapNamespace(namespace: any): any {
  return new Proxy(namespace, {
    get(target, prop) {
      if (prop === 'lookup') {
        return (attr: string, value: unknown) =>
          wrapChunk(target.lookup(attr, value))
      }
      const member = target[prop]
      return typeof member === 'object' && member !== null
        ? wrapChunk(member)
        : member
    },
  })
}

/**
 * Build the typed tx chain for a schema. Schema-independent at runtime —
 * all typing is schema-derived; the only runtime behavior added over core
 * is dot-path `.link` compilation.
 */
export function typedTx<S extends IdbSchema = IdbRegisteredSchema>(): IdbTx<S> {
  const tx = txInit()
  return new Proxy(tx as object, {
    get: (target, ns) => wrapNamespace((target as any)[ns]),
  }) as IdbTx<S>
}
