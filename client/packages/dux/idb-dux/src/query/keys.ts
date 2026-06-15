/**
 * Type-level scope-key resolution — the mirror of `resolveSingularKey` in
 * `shapeResult.ts`. Both derive from the same schema metadata, so the
 * TypeScript key and the runtime key always match.
 *
 * `ParentNS` is `null` for top-level scopes (the key is a namespace name) and
 * the parent's namespace name for nested scopes (the key is a link label).
 */
import type { IdbSchema } from '../schema/defineSchema.js'
import type { Singularize } from '../schema/singularize.js'

type DeclaredSingular<
  S extends IdbSchema,
  ParentNS extends string | null,
  Key extends string,
> = ParentNS extends null
  ? Key extends keyof S['$dux']['namespaces']
    ? S['$dux']['namespaces'][Key]['singular']
    : undefined
  : ParentNS extends keyof S['$dux']['linkSingulars']
    ? Key extends keyof S['$dux']['linkSingulars'][ParentNS]
      ? S['$dux']['linkSingulars'][ParentNS][Key]
      : undefined
    : undefined

/** The singular form of a scope key per the schema's `options.singularize`. */
export type SingularScopeKey<
  S extends IdbSchema,
  ParentNS extends string | null,
  Key extends string,
> = S['$dux']['options']['singularize'] extends 'off'
  ? Key
  : DeclaredSingular<S, ParentNS, Key> extends infer Declared
    ? Declared extends string
      ? Declared
      : S['$dux']['options']['singularize'] extends 'explicit'
        ? Key
        : Singularize<Key>
    : never

/** Whether a scope node coerces its array to a single entity. */
export type HasPick<Node> = Node extends { $: infer Dollar }
  ? Dollar extends { $only: true } | { $at: number }
    ? true
    : false
  : false

/**
 * The top-level keys a `/vue` client hook result owns. A query whose resolved
 * scope key — or top-level `$m` label — lands on one of these would clash with
 * the hook's own ref (`{ isLoading } = useQuery(...)`), so query validation
 * rejects it ([validation.ts], `QERR_RESULT_KEY_RESERVED`). The set is the
 * union across `useQuery`, `useInfiniteQuery`, and the result wrapper
 * (`.refs`/`.state`); the `/vue` result shapes are locked against it by a type
 * test so the two never drift.
 *
 * Nested keys never appear here: they live inside entity objects, where no
 * result field exists to collide with.
 */
export type ReservedResultKey
  = | 'isLoading'
    | 'error'
    | 'pageInfo'
    | 'refs'
    | 'state'
    | 'canLoadNextPage'
    | 'loadNextPage'

/** The output key of a scope: `$as` wins, `$only`/`$at` singularize, else as-is. */
export type ResolvedScopeKey<
  S extends IdbSchema,
  ParentNS extends string | null,
  Key extends string,
  Node,
> = Node extends { $: infer Dollar }
  ? Dollar extends { $as: infer As extends string }
    ? As
    : Dollar extends { $only: true } | { $at: number }
      ? SingularScopeKey<S, ParentNS, Key>
      : Key
  : Key
