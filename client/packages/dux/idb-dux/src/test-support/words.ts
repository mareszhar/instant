/**
 * The singularization word list — one fixture, two planes. The runtime suite
 * maps it through `singularize()`; the type suite maps it through
 * `Singularize<>`. Both must produce column two, which is what locks the two
 * implementations to the shared rule set.
 *
 * Covers every rule: irregulars, `ies` (long and 1-char-stem words), the
 * `es`-stripping suffixes, the `ss` no-op, the plain `s` strip, words that
 * are already singular, and the documented best-effort cases where the
 * algorithm's answer is only deterministic, not perfect English (`analyses`)
 * — declared `singular` exists for those.
 */
export const singularizations = [
  // irregulars
  ['people', 'person'],
  ['children', 'child'],
  ['statuses', 'status'],
  ['movies', 'movie'],
  ['caches', 'cache'],
  ['quizzes', 'quiz'],
  ['heroes', 'hero'],
  // …ies → …y
  ['companies', 'company'],
  ['categories', 'category'],
  // …ies with a 1-char stem falls through to the s-strip
  ['ties', 'tie'],
  ['pies', 'pie'],
  // …sses / …zzes / …ches / …shes / …xes → strip es
  ['classes', 'class'],
  ['addresses', 'address'],
  ['buzzes', 'buzz'],
  ['matches', 'match'],
  ['branches', 'branch'],
  ['dishes', 'dish'],
  ['boxes', 'box'],
  // …ss → already singular
  ['progress', 'progress'],
  // plain s strip
  ['tasks', 'task'],
  ['workspaces', 'workspace'],
  ['memberships', 'membership'],
  ['todos', 'todo'],
  ['$users', '$user'],
  // already singular, no trailing s
  ['data', 'data'],
  ['info', 'info'],
  // deterministic best-effort — schema `singular` is the override for these
  ['analyses', 'analyse'],
] as const
