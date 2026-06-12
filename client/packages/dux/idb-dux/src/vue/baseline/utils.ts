// Vendored from @instantdb/vue/src/utils.ts — see UPSTREAM.md.
import { getCurrentScope, onScopeDispose } from 'vue'

/**
 * Run `fn` when the current effect scope is disposed. Returns true if a scope
 * was active (and the callback was registered), false otherwise. Lets hooks
 * work both inside component setup and inside a manual `effectScope()` without
 * blowing up when called outside any scope.
 */
export function tryOnScopeDispose(fn: () => void): boolean {
  if (getCurrentScope()) {
    onScopeDispose(fn)
    return true
  }
  return false
}

// DUX-DELTA(ssr): the SSR-resilience floor (vision principle 6). Hooks must
// not crash on the server and must not open subscriptions there; this is the
// one predicate every reactive baseline hook guards on. No official
// counterpart — it is dux's addition, isolated here so the drift check never
// flags it as upstream divergence.
export function isClient(): boolean {
  return typeof window !== 'undefined'
}
// END DUX-DELTA
