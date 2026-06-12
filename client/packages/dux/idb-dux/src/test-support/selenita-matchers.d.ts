/**
 * Type-plane shim for the selenita vitest addon under vitest 4.
 *
 * selenita 0.2.0 augments `declare module 'vitest' { interface Assertion<T> }`,
 * but vitest 4 declares `Assertion<T = any>` — the type-parameter lists
 * differ, so the merge is silently rejected and the matchers go untyped.
 * The runtime addon (`expect.extend`) works fine; this file re-declares the
 * same matcher signatures on vitest 4's `Matchers` extension point. Drop it
 * once selenita ships a vitest-4-compatible augmentation.
 */
import type { CompletionItemKind } from '@mszr/selenita/vitest'

declare module 'vitest' {
  interface Matchers<T = any> {
    toContainCompletion: (name: string) => void
    toContainCompletions: (names: string[]) => void
    /** Order-insensitive exact match on `completions`. */
    toEqualCompletions: (names: string[]) => void
    toHaveKind: (kind: CompletionItemKind) => void
    toHaveType: (type: string) => void
    toHaveDocumentation: (doc: string | RegExp) => void
    toBeDeprecated: () => void
    toBeClean: () => void
    toHaveError: ((code: number, message?: RegExp) => void) & ((message: RegExp) => void)
    toHaveErrorCount: (count: number) => void
    /** Assert that all group members expose identical completions (order-insensitive). */
    toHaveCompletionParity: () => void
    toBeActiveOnParameter: (index: number) => void
    toHaveParameterCount: (count: number) => void
    /** Store or compare a type-level snapshot in `__type_snapshots__/`. */
    toMatchTypeSnapshot: (name?: string) => void
  }
}
