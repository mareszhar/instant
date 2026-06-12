import type {
  CardinalityKind,
  EntitiesWithLinks,
  InstantSchemaDef as InstantSchemaDefType,
  LinksDef,
  RoomsDef,
} from '@instantdb/core'
import type { IdbNamespaceDef, IdbNamespaceMeta, IdbNamespacesDef } from './namespace.js'
import type { Expand } from './util.js'
import { i as officialI } from '@instantdb/core'

// ==========
// links

interface IdbLinkSide<On extends string> {
  on: On
  label: string
  has: CardinalityKind
  /**
   * The singular form of this label — governs the output key when `$only`/
   * `$at` is applied to the nested link. Defaults to the built-in English
   * algorithm when omitted. Stripped from the wire projection.
   */
  singular?: string
  onDelete?: 'cascade'
}

export interface IdbLinkDef<On extends string> {
  forward: IdbLinkSide<On> & { required?: boolean }
  reverse: IdbLinkSide<On>
}

export type IdbLinksDef<Namespaces> = Record<
  string,
  IdbLinkDef<keyof Namespaces & string>
>

// ==========
// options

export interface IdbSchemaOptions {
  /**
   * How `$only`/`$at` result keys are singularized, inherited by every dux
   * init from the schema:
   *
   * - `'auto'` (default) — the schema's `singular` if declared, otherwise the
   *   built-in English algorithm
   * - `'explicit'` — the schema's `singular` if declared, otherwise the key
   *   stays as-is (`$as` required for unregistered plurals)
   * - `'off'` — never singularize; keys keep their names (`$as` to rename)
   */
  singularize?: 'auto' | 'off' | 'explicit'
}

interface ResolveOptions<Options extends IdbSchemaOptions> {
  singularize: Options['singularize'] extends 'off' | 'explicit'
    ? Options['singularize']
    : 'auto'
}

// ==========
// schema meta

/** The loose shape of a schema's `$dux` meta — the constraint side. */
export interface IdbSchemaMetaShape {
  readonly namespaces: Record<string, IdbNamespaceMeta>
  /** namespace → link label → declared singular (declared labels only). */
  readonly linkSingulars: Record<string, Record<string, string>>
  readonly options: { readonly singularize: 'auto' | 'off' | 'explicit' }
}

type SideSingulars<Links, NS, Dir extends 'forward' | 'reverse'> = {
  [K in keyof Links as Links[K] extends Record<Dir, { on: NS, label: infer L extends string, singular: string }>
    ? L
    : never]: Links[K] extends Record<Dir, { singular: infer Sg extends string }>
    ? Sg
    : never
}

type LinkSingularsOf<Namespaces, Links> = {
  [NS in keyof Namespaces]: Expand<
    SideSingulars<Links, NS, 'forward'> & SideSingulars<Links, NS, 'reverse'>
  >
}

type MetaOfNamespace<Def> = Def extends { readonly $dux: infer Meta extends IdbNamespaceMeta }
  ? Meta
  : IdbNamespaceMeta<undefined, undefined>

/** The computed `$dux` meta of a schema, as `defineSchema` derives it. */
export interface IdbSchemaMeta<
  Namespaces extends IdbNamespacesDef,
  Links,
  Options extends IdbSchemaOptions,
> {
  readonly namespaces: { [K in keyof Namespaces]: MetaOfNamespace<Namespaces[K]> }
  readonly linkSingulars: LinkSingularsOf<Namespaces, Links>
  readonly options: ResolveOptions<Options>
}

// ==========
// the schema type

/**
 * Every dux schema: a real official `InstantSchemaDef` instance whose
 * enumerable projection is exactly what Instant's tooling consumes, with dux
 * metadata riding along non-enumerably under `$dux`. The official rename is
 * `IdbSchema` — this is the parameterized form behind it.
 */
export type IdbSchemaDef<
  Entities extends Record<string, any>,
  Rooms extends RoomsDef,
  Meta extends IdbSchemaMetaShape,
> = InstantSchemaDefType<Entities, LinksDef<any>, Rooms> & {
  readonly $dux: Meta
}

/** The schema type — what `defineSchema` returns, loosely. */
export type IdbSchema = IdbSchemaDef<any, any, IdbSchemaMetaShape>

export interface IdbSchemaConfig<
  Namespaces extends IdbNamespacesDef,
  Links extends IdbLinksDef<Namespaces>,
  Rooms extends RoomsDef,
  Options extends IdbSchemaOptions,
> {
  namespaces: Namespaces
  links?: Links
  rooms?: Rooms
  options?: Options
}

// ==========
// defineSchema

/**
 * The schema authority: namespaces, fields, links, rooms, ruleParams,
 * options — the single home for everything that describes your data.
 *
 * Returns an actual official `InstantSchemaDef` instance (CLI push and the
 * platform API consume it as-is); dux metadata rides along non-enumerably.
 *
 * @example
 *   export const schema = defineSchema({
 *     namespaces: {
 *       tasks: i.namespace({
 *         fields: { title: i.string().indexed() },
 *       }),
 *     },
 *   })
 *
 *   declare module '@mszr/idb-dux' {
 *     interface IdbRegister { schema: typeof schema }
 *   }
 */
export function defineSchema<
  Namespaces extends IdbNamespacesDef,
  const Links extends IdbLinksDef<Namespaces> = {},
  Rooms extends RoomsDef = {},
  const Options extends IdbSchemaOptions = {},
>(
  config: IdbSchemaConfig<Namespaces, Links, Rooms, Options>,
): IdbSchemaDef<
  EntitiesWithLinks<Namespaces, Links>,
  Rooms,
  IdbSchemaMeta<Namespaces, Links, Options>
> {
  const links = config.links ?? ({} as Links)

  // The official schema constructor builds the enriched entity defs and the
  // canonical instance; dux only prepares official-dialect inputs for it, so
  // the projection matches `i.schema` output by construction.
  const schema = officialI.schema({
    entities: config.namespaces,
    links: stripDialect(links) as LinksDef<any>,
    rooms: config.rooms ?? {},
  })

  Object.defineProperty(schema, '$dux', {
    value: {
      namespaces: Object.fromEntries(
        Object.entries(config.namespaces).map(([name, def]) => [
          name,
          (def as Partial<IdbNamespaceDef>).$dux
          ?? { singular: undefined, ruleParams: undefined },
        ]),
      ),
      linkSingulars: collectLinkSingulars(links),
      options: { singularize: config.options?.singularize ?? 'auto' },
    },
    enumerable: false,
  })

  return schema as unknown as IdbSchemaDef<
    EntitiesWithLinks<Namespaces, Links>,
    Rooms,
    IdbSchemaMeta<Namespaces, Links, Options>
  >
}

/** Remove dux-only keys so `schema.links` is wire-clean official dialect. */
function stripDialect(links: IdbLinksDef<any>): IdbLinksDef<any> {
  return Object.fromEntries(
    Object.entries(links).map(([name, { forward, reverse }]) => {
      const { singular: _f, ...forwardRest } = forward
      const { singular: _r, ...reverseRest } = reverse
      return [name, { forward: forwardRest, reverse: reverseRest }]
    }),
  )
}

/** Hoist declared label singulars into `$dux.linkSingulars[namespace][label]`. */
function collectLinkSingulars(
  links: IdbLinksDef<any>,
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {}
  for (const { forward, reverse } of Object.values(links)) {
    for (const side of [forward, reverse]) {
      if (side.singular === undefined)
        continue
      const labels = (result[side.on] ??= {})
      labels[side.label] = side.singular
    }
  }
  return result
}
