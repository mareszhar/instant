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

  it('where completes fields, id, link labels, and one-hop dot-paths', () => {
    const { completions } = project.query`
      ${prelude}
      q({ tasks: { $: { where: { ${cursor} } } } })
    `
    expect(completions).toContainCompletions([
      'title',
      'isDone',
      'id',
      'and',
      'or',
      'workspace',
      'workspace.inviteCode',
      'assignee.email',
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
    // …and the only extra entry is the QERR hint the validation arm carries
    // for the in-progress (still-invalid) value — intended: message > silence.
    expect(
      completions.filter(name => !name.startsWith('QERR_M_INDEXBY_NOT_UNIQUE')),
    ).toEqualCompletions(['inviteCode', 'id'])
  })
})

describe('query authoring — diagnostics at the cursor', () => {
  it('flags an unknown top-level namespace', () => {
    const { errors } = project.check`
      ${prelude}
      q({ foos: {} })
    `
    expect(errors).toHaveError(/QERR_QUERY_ROOT_KEY_UNKNOWN: foos is not a valid top-level namespace/)
  })

  it('flags an unknown nested key with its namespace', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { assignees: {} } })
    `
    expect(errors).toHaveError(/QERR_QUERY_NESTED_KEY_UNKNOWN: assignees is not a valid nested key on tasks/)
  })

  it('flags an unknown where key with its namespace', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $: { where: { tagName: 'x' } } } })
    `
    expect(errors).toHaveError(/QERR_WHERE_KEY_UNKNOWN: tagName is not a valid where key on tasks/)
  })

  it('flags a mistyped where value with both types named', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $: { where: { title: false } } } })
    `
    expect(errors).toHaveError(/QERR_WHERE_VALUE_TYPE: Type 'boolean' is not assignable to field 'title' of type string/)
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
    expect(errors).toHaveError(/QERR_ORDER_KEY_INVALID: notes is not orderable/)
  })

  it('flags an unknown query option', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $: { limt: 5 } } })
    `
    expect(errors).toHaveError(/QERR_QUERY_OPTION_UNKNOWN: limt is not a valid query option/)
  })

  it('flags pagination keys on nested scopes', () => {
    const { errors } = project.check`
      ${prelude}
      q({ workspaces: { tasks: { $: { offset: 5 } } } })
    `
    expect(errors).toHaveError(/QERR_QUERY_OPTION_TOP_LEVEL_ONLY: offset is only available on top-level scopes/)
  })

  it('flags indexBy on a non-unique field', () => {
    const { errors } = project.check`
      ${prelude}
      q({ tasks: { $m: { byTitle: { indexBy: 'title' } } } })
    `
    expect(errors).toHaveError(/QERR_M_INDEXBY_NOT_UNIQUE: indexBy requires a unique field on tasks/)
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
      e.message.includes('QERR_WHERE_KEY_UNKNOWN'),
    )?.line
    expect(errorLines).toContain(cursorLine)
    expect(result.errors).toHaveError(/QERR_WHERE_KEY_UNKNOWN: tagName is not a valid where key on tasks/)
  })
})
