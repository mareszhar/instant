/**
 * Seed data for the canonical app, in the shape instaql delivers it: raw
 * query-result objects (top-level entity arrays, nested links resolved).
 * Stable ids so assertions can reference entities by name.
 */

export const ids = {
  workspaceAlpha: 'ws-alpha',
  workspaceBeta: 'ws-beta',
  userAda: 'user-ada',
  userGrace: 'user-grace',
  taskOne: 'task-1',
  taskTwo: 'task-2',
  taskThree: 'task-3',
  reportQ1: 'report-q1',
  analysisA: 'analysis-a',
  analysisB: 'analysis-b',
} as const

export const rawUsers = [
  { id: ids.userAda, email: 'ada@example.com', name: 'Ada' },
  { id: ids.userGrace, email: 'grace@example.com', name: 'Grace' },
]

export const rawWorkspaces = [
  {
    id: ids.workspaceAlpha,
    name: 'Alpha',
    inviteCode: 'alpha-invite',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: ids.workspaceBeta,
    name: 'Beta',
    inviteCode: 'beta-invite',
    createdAt: '2026-02-01T00:00:00Z',
  },
]

export const rawTasks = [
  {
    id: ids.taskOne,
    title: 'Write the spec',
    isDone: true,
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: ids.taskTwo,
    title: 'Implement the spec',
    isDone: false,
    createdAt: '2026-03-02T00:00:00Z',
  },
  {
    id: ids.taskThree,
    title: 'Verify the spec',
    isDone: false,
    createdAt: '2026-03-03T00:00:00Z',
  },
]

/** `{ tasks: { assignee: {} } }` — tasks with their has-one assignee resolved. */
export const rawTasksWithAssignee = [
  { ...rawTasks[0]!, assignee: rawUsers[0]! },
  { ...rawTasks[1]!, assignee: rawUsers[1]! },
  { ...rawTasks[2]!, assignee: undefined },
]

/** `{ reports: { analyses: {} } }` — a report with its has-many analyses. */
export const rawReportsWithAnalyses = [
  {
    id: ids.reportQ1,
    title: 'Q1 report',
    analyses: [
      { id: ids.analysisA, score: 1 },
      { id: ids.analysisB, score: 2 },
    ],
  },
]
