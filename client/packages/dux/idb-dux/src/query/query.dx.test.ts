import { cursor } from '@mszr/selenita'
import { duxProject, registration } from '@test'
import { describe, expect, it } from 'vitest'

const project = duxProject()

/** `q` ready-made via registration — every snippet starts like userland. */
const prelude = `
${registration}
import { $only, $skip, q } from '@mszr/idb-dux'
`

describe('query authoring — completions', () => {
  it('q({ ⌶ }) completes the namespace names', () => {
    const { completions } = project.query`
      ${prelude}
      q({ ${cursor} })
    `
    expect(completions).toContainCompletions([
      '$users',
      'workspaces',
      'memberships',
      'tasks',
      'reports',
      'analyses',
    ])
  })

  it('scope nodes complete $, $m, and the link labels', () => {
    const { completions } = project.query`
      ${prelude}
      q({ tasks: { ${cursor} } })
    `
    expect(completions).toContainCompletions([
      '$',
      '$m',
      'workspace',
      'assignee',
      'subtasks',
      'parentTask',
    ])
  })

  it('$ completes native keys, the dux keys, and pagination at top level', () => {
    const { completions } = project.query`
      ${prelude}
      q({ tasks: { $: { ${cursor} } } })
    `
    expect(completions).toContainCompletions([
      'where',
      'order',
      'fields',
      'limit',
      'offset',
      '$only',
      '$at',
      '$as',
    ])
  })

  it('where completes fields, id, link labels, and linked dot-paths up to 3 hops', () => {
    const { completions } = project.query`
      ${prelude}
      q({ tasks: { $: { where: { ${cursor} } } } })
    `
    expect(completions).toContainCompletions([
      // fields, id, and/or, and the hop-1 link labels
      'title',
      'isDone',
      'id',
      'and',
      'or',
      'workspace',
      'assignee',
      // hop-2 dot-paths: a linked field AND a linked relationship
      'workspace.inviteCode',
      'assignee.email',
      'workspace.memberships',
      'assignee.memberships',
      // hop-3 dot-paths: through a relationship to a field or another relationship
      'workspace.memberships.createdAt',
      'workspace.memberships.user',
    ])
  })

  it('where dot-paths can stop on a relationship — the demo`s memberships.user', () => {
    const { completions } = project.query`
      ${prelude}
      q({ workspaces: { $: { where: { ${cursor} } } } })
    `
    // exactly the path the workspaces store filters on, plus a third hop —
    // links are first-class completions, not just fields
    expect(completions).toContainCompletions([
      'memberships',
      'memberships.user',
      'memberships.user.email',
    ])
  })

  it('where operator objects complete the operators', () => {
    const { completions } = project.query`
      ${prelude}
      q({ tasks: { $: { where: { title: { ${cursor} } } } } })
    `
    expect(completions).toContainCompletions(['$in', '$ne', '$gt', '$like', '$ilike', '$isNull'])
  })

  it('order completes indexed fields and serverCreatedAt only', () => {
    const { completions } = project.query`
      ${prelude}
      q({ tasks: { $: { order: { ${cursor} } } } })
    `
    expect(completions).toEqualCompletions(['title', 'isDone', 'createdAt', 'serverCreatedAt'])
  })

  it('$m transforms complete indexBy, groupBy, and at', () => {
    const { completions } = project.query`
      ${prelude}
      q({ tasks: { $m: { latest: { ${cursor} } } } })
    `
    expect(completions).toContainCompletions(['indexBy', 'groupBy', 'at'])
  })

  it('indexBy completes only unique fields and id', () => {
    const { completions } = project.query`
      ${prelude}
      q({ workspaces: { $m: { byCode: { indexBy: '${cursor}' } } } })
    `
    expect(completions).toContainCompletions(['inviteCode', 'id'])
    // non-unique fields never complete…
    expect(completions).not.toContainCompletion('name')
    expect(completions).not.toContainCompletion('createdAt')
    // …and the only extra entry is the DUXERR hint the validation arm carries
    // for the in-progress (still-invalid) value — intended: message > silence.
    expect(
      completions.filter(name => !name.startsWith('DUXERR_M_INDEXBY_NOT_UNIQUE')),
    ).toEqualCompletions(['inviteCode', 'id'])
  })

  it('groupBy completes primitive fields', () => {
    const { completions } = project.query`
      ${prelude}
      q({ fruits: { $m: { byName: { groupBy: '${cursor}' } } } })
    `
    expect(completions).toContainCompletions(['name', 'kind', 'sku'])
  })

  it('a runtime-enum groupBy bucket keys by the declared values', () => {
    const { completions } = project.query`
      ${prelude}
      import type { IdbQueryData } from '@mszr/idb-dux'
      declare const data: IdbQueryData<{ fruits: { $m: { byName: { groupBy: 'name' } } } }>
      data.byName.${cursor}
    `
    expect(completions).toContainCompletions(['apple', 'banana', 'orange'])
  })
})

describe('query authoring — diagnostics at the cursor', () => {
  it('flags an unknown top-level namespace', () => {
    const { errors } = project.check`
      ${prelude}
      q({ foos: {} })
    `
    expect(errors).toHaveError(/DUXERR_QUERY_ROOT_KEY_UNKNOWN: foos is not a valid top-level namespace/)
  })

  it('flags an unknown nested key with its namespace', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { assignees: {} } })
    `
    expect(errors).toHaveError(/DUXERR_QUERY_NESTED_KEY_UNKNOWN: assignees is not a valid nested key on tasks/)
  })

  it('flags an unknown where key with its namespace', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $: { where: { tagName: 'x' } } } })
    `
    expect(errors).toHaveError(/DUXERR_WHERE_KEY_UNKNOWN: tagName is not a valid where key on tasks/)
  })

  it('flags a mistyped where value with both types named', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $: { where: { title: false } } } })
    `
    expect(errors).toHaveError(/DUXERR_WHERE_VALUE_TYPE: Type 'boolean' is not assignable to field 'title' of type string/)
  })

  it('flags $ilike on a non-string field', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $: { where: { isDone: { $ilike: '%true%' } } } } })
    `
    expect(errors).toHaveError(/Operator \$ilike is only available for indexed string fields/)
  })

  it('flags $like on a non-indexed string field', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $: { where: { notes: { $like: '%x%' } } } } })
    `
    expect(errors).toHaveError(/Operator \$like is only available for indexed string fields/)
  })

  it('flags comparison operators on non-indexed fields', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $: { where: { notes: { $gt: 'a' } } } } })
    `
    expect(errors).toHaveError(/Operator \$gt is only available for indexed fields with a checked type/)
  })

  it('flags an unorderable key', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $: { order: { notes: 'asc' } } } })
    `
    expect(errors).toHaveError(/DUXERR_ORDER_KEY_INVALID: notes is not orderable/)
  })

  it('flags an unknown query option', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $: { limt: 5 } } })
    `
    expect(errors).toHaveError(/DUXERR_QUERY_OPTION_UNKNOWN: limt is not a valid query option/)
  })

  it('flags pagination keys on nested scopes', () => {
    const { errors } = project.check`
      ${prelude}
      q({ workspaces: { tasks: { $: { offset: 5 } } } })
    `
    expect(errors).toHaveError(/DUXERR_QUERY_OPTION_TOP_LEVEL_ONLY: offset is only available on top-level scopes/)
  })

  it('flags $as renaming a scope onto a reserved result key', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $: { $as: 'isLoading' } } })
    `
    expect(errors).toHaveError(/DUXERR_RESULT_KEY_RESERVED: result key 'isLoading' is reserved/)
  })

  it('flags singularization that lands on a reserved result key', () => {
    // `states` singularizes to `state`; a $only read would collide with the
    // result wrapper`s own key, so the guard fires at the query, not silently.
    const { errors } = project.check`
      ${prelude}
      q({ states: { $: { $only } } })
    `
    expect(errors).toHaveError(/DUXERR_RESULT_KEY_RESERVED: result key 'state' is reserved/)
  })

  it('flags a $m label that is a reserved result key', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $m: { error: { at: 0 } } } })
    `
    expect(errors).toHaveError(/DUXERR_RESULT_KEY_RESERVED: \$m label 'error' is reserved/)
  })

  it('flags indexBy on a non-unique field', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $m: { byTitle: { indexBy: 'title' } } } })
    `
    expect(errors).toHaveError(/DUXERR_M_INDEXBY_NOT_UNIQUE: indexBy requires a unique field on tasks/)
  })

  it('flags a runtime-enum groupBy bucket keyed outside its declared values', () => {
    const { errors } = project.check`
      ${prelude}
      import type { IdbQueryData } from '@mszr/idb-dux'
      declare const data: IdbQueryData<{ fruits: { $m: { byName: { groupBy: 'name' } } } }>
      data.byName.mango
    `
    expect(errors).toHaveError(/Property 'mango' does not exist/)
  })

  it('flags valid queries clean — the canonical good query', () => {
    const { errors } = project.check`
      ${prelude}
      declare const current: { id: string } | undefined
      const query = q({
        workspaces: { $: { where: { inviteCode: 'x' }, $only } },
        tasks: {
          $: { where: { isDone: false, workspace: current?.id ?? $skip }, order: { createdAt: 'desc' } },
          $m: { tasksById: { indexBy: 'id' } },
          assignee: {},
        },
      })
    `
    expect(errors).toBeClean()
  })
})

describe('query authoring — localization boundary', () => {
  it('q() restores field-localized errors inside a factory body', () => {
    const result = project.query`
      ${prelude}
      function taskQuery() {
        return q({ tasks: { $: { where: { tagName${cursor} : 'x' } } } })
      }
    `
    const errorLines = result.errors.map(e => e.line)
    expect(result.errors.length).toBeGreaterThan(0)
    // the diagnostic lands on the offending key's line, not the call site
    const cursorLine = result.errors.find(e =>
      e.message.includes('DUXERR_WHERE_KEY_UNKNOWN'),
    )?.line
    expect(errorLines).toContain(cursorLine)
    expect(result.errors).toHaveError(/DUXERR_WHERE_KEY_UNKNOWN: tagName is not a valid where key on tasks/)
  })
})
