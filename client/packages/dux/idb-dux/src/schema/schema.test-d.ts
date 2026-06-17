import type { DataAttrDef, InstantSchemaDef } from '@instantdb/core'
import type { AppSchema } from '@test'
import type {
  IdbEntity,
  IdbEntityWithLinks,
  IdbRegisteredSchema,
  IdbRoomName,
  IdbRoomPresence,
  IdbRoomTopics,
  IdbUnknownSchema,
} from './index.js'
import { describe, expectTypeOf, it } from 'vitest'

describe('schema type shapes', () => {
  it('IdbEntity is id + fields only — no links', () => {
    expectTypeOf<IdbEntity<'tasks', AppSchema>>().toEqualTypeOf<{
      id: string
      title: string
      isDone: boolean
      createdAt: string | number
      notes?: string
      meta?: { tags: string[] }
    }>()
  })

  it('runtime-enum + type-level-enum fields resolve to their value union', () => {
    type Fruit = IdbEntity<'fruits', AppSchema>
    // i.string([...]) — runtime enum; i.string<…>() — type-level enum
    expectTypeOf<Fruit['name']>().toEqualTypeOf<'apple' | 'banana' | 'orange'>()
    expectTypeOf<Fruit['kind']>().toEqualTypeOf<'sweet' | 'sour' | undefined>()
    expectTypeOf<Fruit['sku']>().toEqualTypeOf<number>()
  })

  it('IdbEntityWithLinks adds every link label, one hop, cardinality-aware', () => {
    type Report = IdbEntityWithLinks<'reports', AppSchema>
    expectTypeOf<Report['analyses']>().toEqualTypeOf<
      IdbEntity<'analyses', AppSchema>[]
    >()
    type Analysis = IdbEntityWithLinks<'analyses', AppSchema>
    expectTypeOf<Analysis['report']>().toEqualTypeOf<
      IdbEntity<'reports', AppSchema> | undefined
    >()
    // self-link, both directions
    type Task = IdbEntityWithLinks<'tasks', AppSchema>
    expectTypeOf<Task['subtasks']>().toEqualTypeOf<IdbEntity<'tasks', AppSchema>[]>()
    expectTypeOf<Task['parentTask']>().toEqualTypeOf<
      IdbEntity<'tasks', AppSchema> | undefined
    >()
  })

  it('captures namespace singulars and ruleParams as literal metadata', () => {
    expectTypeOf<AppSchema['$dux']['namespaces']['$users']['singular']>().toEqualTypeOf<'user'>()
    expectTypeOf<AppSchema['$dux']['namespaces']['tasks']['singular']>().toEqualTypeOf<undefined>()
    expectTypeOf<AppSchema['$dux']['namespaces']['workspaces']['ruleParams']>().toEqualTypeOf<{
      inviteCode: DataAttrDef<string, true, false>
    }>()
    expectTypeOf<AppSchema['$dux']['namespaces']['tasks']['ruleParams']>().toEqualTypeOf<undefined>()
  })

  it('captures link label singulars per namespace', () => {
    expectTypeOf<AppSchema['$dux']['linkSingulars']['reports']>().toEqualTypeOf<{
      readonly analyses: 'analysis'
    }>()
    expectTypeOf<AppSchema['$dux']['linkSingulars']['tasks']>().toEqualTypeOf<{}>()
  })

  it('resolves options literally, defaulting singularize to auto', () => {
    expectTypeOf<AppSchema['$dux']['options']['singularize']>().toEqualTypeOf<'auto'>()
  })

  it('stays assignable to the official schema type', () => {
    expectTypeOf<AppSchema>().toExtend<InstantSchemaDef<any, any, any>>()
  })

  it('falls back to the unknown schema when nothing is registered', () => {
    expectTypeOf<IdbRegisteredSchema>().toEqualTypeOf<IdbUnknownSchema>()
  })

  it('room extractors read room shapes straight off the schema', () => {
    expectTypeOf<IdbRoomName<AppSchema>>().toEqualTypeOf<'workspace'>()
    expectTypeOf<IdbRoomPresence<'workspace', AppSchema>['name']>().toEqualTypeOf<string>()
    expectTypeOf<IdbRoomPresence<'workspace', AppSchema>['typing']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<IdbRoomTopics<'workspace', AppSchema>['reaction']>().toExtend<{ emoji: string }>()
  })
})
