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
          tasksByStatus: { groupBy: 'isDone' },
          latestTask: { at: -1 },
        },
      },
    })
    type Data = IdbQueryData<typeof query, AppSchema>
    expectTypeOf<Data>().toEqualTypeOf<{
      tasks: Task[]
      tasksById: Record<string, Task>
      tasksByStatus: Record<string, Task[]>
      latestTask: Task | undefined
    }>()
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
