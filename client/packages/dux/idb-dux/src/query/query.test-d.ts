import type { AppSchema } from '@test'
import type {
  IdbQueryData,
  IdbQueryEntity,
  IdbSchemaRuleParams,
} from './index.js'
import { describe, expectTypeOf, it } from 'vitest'
import { defineQuery } from './index.js'

const qa = defineQuery<AppSchema>()

type Task = IdbQueryEntity<'tasks', {}, AppSchema>
type Workspace = IdbQueryEntity<'workspaces', {}, AppSchema>
type Analysis = IdbQueryEntity<'analyses', {}, AppSchema>
type Fruit = IdbQueryEntity<'fruits', {}, AppSchema>

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never

/**
 * A canonical entity with one field narrowed to a single value of its group —
 * the shape `$m` groupBy gives each bucket (a grouped optional field is present).
 */
type Narrow<E, K extends keyof E, V> = Expand<Omit<E, K> & { [P in K]: V }>

describe('idbQueryData — the shaping mirror', () => {
  it('normalizes top-level scopes to entity arrays', () => {
    const query = qa({ tasks: {} })
    expectTypeOf<IdbQueryData<typeof query, AppSchema>>().toEqualTypeOf<{
      tasks: Task[]
    }>()
  })

  it('$only coerces and singularizes via the algorithm', () => {
    const query = qa({ workspaces: { $: { where: { inviteCode: 'x' }, $only: true } } })
    expectTypeOf<IdbQueryData<typeof query, AppSchema>>().toEqualTypeOf<{
      workspace: Workspace | undefined
    }>()
  })

  it('$at coerces and respects declared namespace singulars', () => {
    const query = qa({ $users: { $: { $at: -1 } } })
    expectTypeOf<IdbQueryData<typeof query, AppSchema>>().toEqualTypeOf<{
      user: IdbQueryEntity<'$users', {}, AppSchema> | undefined
    }>()
  })

  it('$as renames explicitly and always wins', () => {
    const query = qa({ workspaces: { $: { $only: true, $as: 'current' } } })
    expectTypeOf<IdbQueryData<typeof query, AppSchema>>().toEqualTypeOf<{
      current: Workspace | undefined
    }>()
  })

  it('nested picks rename via the link label singular', () => {
    const query = qa({
      reports: { $: { $only: true }, analyses: { $: { $at: 0 } } },
    })
    type Data = IdbQueryData<typeof query, AppSchema>
    expectTypeOf<Data['report']>().toEqualTypeOf<
      | {
        id: string
        title: string
        analysis: Analysis | undefined
      }
      | undefined
    >()
  })

  it('keeps nested has-one links singular and has-many plural', () => {
    const query = qa({ tasks: { assignee: {}, subtasks: {} } })
    type Data = IdbQueryData<typeof query, AppSchema>
    expectTypeOf<Data['tasks'][number]['assignee']>().toEqualTypeOf<
      IdbQueryEntity<'$users', {}, AppSchema> | undefined
    >()
    expectTypeOf<Data['tasks'][number]['subtasks']>().toEqualTypeOf<Task[]>()
  })

  it('$m projects sibling keys without touching the scope key', () => {
    const query = qa({
      tasks: {
        $m: {
          tasksById: { indexBy: 'id' },
          latestTask: { at: -1 },
        },
      },
    })
    type Data = IdbQueryData<typeof query, AppSchema>
    expectTypeOf<Data['tasks']>().toEqualTypeOf<Task[]>()
    expectTypeOf<Data['tasksById']>().toEqualTypeOf<Record<string, Task>>()
    expectTypeOf<Data['latestTask']>().toEqualTypeOf<Task | undefined>()
  })

  it('$m groupBy on a runtime enum keys by the union, narrows, never undefined', () => {
    const query = qa({ fruits: { $m: { byName: { groupBy: 'name' } } } })
    type Data = IdbQueryData<typeof query, AppSchema>
    expectTypeOf<Data['byName']>().toEqualTypeOf<{
      apple: Narrow<Fruit, 'name', 'apple'>[]
      banana: Narrow<Fruit, 'name', 'banana'>[]
      orange: Narrow<Fruit, 'name', 'orange'>[]
    }>()
    // a valid key yields an array, never undefined
    expectTypeOf<Data['byName']['apple']>().toEqualTypeOf<Narrow<Fruit, 'name', 'apple'>[]>()
  })

  it('$m groupBy on a boolean field guarantees both buckets, narrowed', () => {
    const query = qa({ tasks: { $m: { byStatus: { groupBy: 'isDone' } } } })
    type Data = IdbQueryData<typeof query, AppSchema>
    expectTypeOf<Data['byStatus']['true']>().toEqualTypeOf<Narrow<Task, 'isDone', true>[]>()
    expectTypeOf<Data['byStatus']['false']>().toEqualTypeOf<Narrow<Task, 'isDone', false>[]>()
  })

  it('$m groupBy on a type-level enum narrows but keeps buckets optional', () => {
    const query = qa({ fruits: { $m: { byKind: { groupBy: 'kind' } } } })
    type Data = IdbQueryData<typeof query, AppSchema>
    expectTypeOf<Data['byKind']>().toEqualTypeOf<{
      sweet?: Narrow<Fruit, 'kind', 'sweet'>[]
      sour?: Narrow<Fruit, 'kind', 'sour'>[]
    }>()
  })

  it('$m indexBy keeps the field value type as the key', () => {
    const query = qa({ fruits: { $m: { bySku: { indexBy: 'sku' } } } })
    type Data = IdbQueryData<typeof query, AppSchema>
    expectTypeOf<Data['bySku']>().toEqualTypeOf<Record<number, Fruit>>()
  })

  it('projects nested $m siblings inside the parent entity', () => {
    const query = qa({
      reports: { analyses: { $m: { analysesById: { indexBy: 'id' } } } },
    })
    type Report = IdbQueryData<typeof query, AppSchema>['reports'][number]
    expectTypeOf<Report['analyses']>().toEqualTypeOf<Analysis[]>()
    expectTypeOf<Report['analysesById']>().toEqualTypeOf<Record<string, Analysis>>()
  })

  it('honors $: { fields } projections', () => {
    const query = qa({ tasks: { $: { fields: ['title'] } } })
    expectTypeOf<IdbQueryData<typeof query, AppSchema>>().toEqualTypeOf<{
      tasks: { id: string, title: string }[]
    }>()
  })
})

describe('idbQueryEntity', () => {
  it('shapes an entity by query syntax', () => {
    type Card = IdbQueryEntity<'tasks', { assignee: {} }, AppSchema>
    expectTypeOf<Card['assignee']>().toEqualTypeOf<
      IdbQueryEntity<'$users', {}, AppSchema> | undefined
    >()
    expectTypeOf<Card['title']>().toEqualTypeOf<string>()
  })
})

describe('idbSchemaRuleParams', () => {
  it('merges every declared rule param, optional and value-typed', () => {
    expectTypeOf<IdbSchemaRuleParams<AppSchema>>().toEqualTypeOf<{
      inviteCode?: string
    }>()
  })
})
