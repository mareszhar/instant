import type { LinkAttrDef, ResolveAttrs } from '@instantdb/core'
import type { IdbSchema } from './defineSchema.js'
import type { IdbRegisteredSchema } from './register.js'
import type { Expand } from './util.js'

/** A namespace name in the schema. */
export type IdbNamespaceName<S extends IdbSchema = IdbRegisteredSchema>
  = keyof S['entities'] & string

/**
 * The bare entity: `id` + fields only. Links live *between* entities, so the
 * plain entity has none — `IdbEntityWithLinks` adds them, queries shape them.
 */
export type IdbEntity<
  NS extends IdbNamespaceName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = Expand<{ id: string } & ResolveAttrs<S['entities'], NS, false>>

/**
 * The entity plus every link label, one hop, cardinality-aware
 * (`Entity[]` or `Entity | undefined`), fields-only inside — deeper shapes
 * are what queries are for.
 */
export type IdbEntityWithLinks<
  NS extends IdbNamespaceName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = Expand<
  { id: string } & ResolveAttrs<S['entities'], NS, false> & {
    [L in keyof S['entities'][NS]['links']]: S['entities'][NS]['links'][L] extends LinkAttrDef<
      infer Cardinality,
      infer Target
    >
      ? Target extends IdbNamespaceName<S>
        ? Cardinality extends 'one'
          ? IdbEntity<Target, S> | undefined
          : IdbEntity<Target, S>[]
        : never
      : never
  }
>
