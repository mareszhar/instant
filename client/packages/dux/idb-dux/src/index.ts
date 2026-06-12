/**
 * `@mszr/idb-dux` — the framework-agnostic foundation.
 *
 * Schema authoring (`defineSchema`, `i`), query authoring (`q`, `defineQuery`),
 * the typed-tx machinery, the `Idb*` type utilities, and `id`/`lookup`.
 *
 * Spec: `../../docs/dux-spec-root.md`.
 */

export * from './query/index.js'
export * from './schema/index.js'
export * from './tx/index.js'
