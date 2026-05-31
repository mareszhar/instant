# EXPERT 'C' PROPOSAL

Here's my final, definitive proposal. I'm going to be explicit about every design decision, including what I'm rejecting from each proposal and why.

---

## Design decisions before the API

**Dropping from G:** the fluent assertion chain (`.shouldContain().entry().shouldHaveType()`) — it's a parallel assertion API that competes with vitest's `expect` rather than extending it. Custom matchers do this job better and more consistently.

**Dropping from X:** `s.expect.*` as the primary assertion surface — that namespacing adds friction. Results should be plain values you pass straight to `expect()`.

**Keeping from X:** `group`, `snippet`, `forModes`, and the curried `queryGroup` template.

**Keeping from G:** per-item detail access, virtual file management, zero-config auto-detection.

**Keeping from mine:** tagged template primary API, interpolated cursor primitive, plain-value results, `project.check` as the diagnostic-only path.

**New:** `cursor` is both a bare value (unnamed) and a callable (named) — the distinction is visually immediate in code. The `snippet` primitive tracks its own cursors and namespaces them when instantiated with `.for()`. The `group.at()` result exposes `.hasParity` and `.divergence` as plain values, not assertions.

**Name:** `ts-probe` — short, evocative, clearly scoped.

---

## 1. Install

```bash
// peer deps: typescript, vitest (or jest)
npm i -D ts-probe
```

```ts
// vitest.setup.ts — one line to unlock custom matchers globally
import 'ts-probe/vitest'
```

```ts
// vitest.config.ts
export default defineConfig({
  test: { setupFiles: ['./vitest.setup.ts'] }
})
```

---

## 2. Core primitives

```ts
import { createProject, cursor, group, snippet } from 'ts-probe'
```

### `cursor`

```ts
cursor // bare value — unnamed cursor, for single-cursor queries
cursor('name') // named cursor — for multi-cursor queries
```

The visual asymmetry is intentional: bare = "simple case", called = "I'm naming this".

### `snippet`

Reusable, composable code fragments that carry their own cursors:

```ts
const whereClause = snippet`{ status: 'open', ${cursor('where')} }`
const queryCall = snippet`db.queryOnce(${whereClause})`
```

When a snippet appears in multiple positions in the same query, scope it with `.for('alias')` so its cursor names don't collide:

```TS
// Scoped: cursor names become 'alias.where'
db.queryOnce(${whereClause.for('once')})
db.useQuery(${whereClause.for('hook')})
// result.at('once.where'), result.at('hook.where')
```

### `group`

```ts
const queryApis = group([
  'db.queryOnce',
  'db.queryOnceX',
  'db.useQuery',
  'db.useQueryX',
  'db.useInfiniteQuery',
  'db.useInfiniteQueryX',
])
```

---

## 3. Project setup

```ts
// Zero-config — auto-detects nearest tsconfig.json, strict mode, in-memory
const project = createProject()

// Real tsconfig — resolves actual imports, node_modules, path aliases
const project = createProject({ tsconfig: './tsconfig.json' })

// With injected virtual files — simulate installed packages, custom .d.ts, etc.
const project = createProject({
  tsconfig: './tsconfig.json',
  files: {
    'node_modules/my-lib/index.d.ts': `
      export declare function registerFruit(fruit: Fruit): void
      export interface Fruit { name: string; price: number; availableQuantity: number }
    `,
  },
})
```

---

## 4. Core query API

### `project.query` — cursor present, full language service

```ts
// Single unnamed cursor → access completions/hover/etc. directly on result
const result = project.query`
  import { registerFruit } from './src'
  registerFruit({ ${cursor} })
`

result.completions // string[]
result.completionItems // CompletionItem[]
result.hover // string | null
result.signatureHelp // SignatureHelp | null
result.diagnostics // Diagnostic[] — whole file, always present
result.errors // Diagnostic[] — errors only
result.warnings // Diagnostic[] — warnings only
result.inlayHints // InlayHint[]
```

### `project.check` — no cursor, diagnostics only

```ts
const result = project.check`
  import { registerFruit } from './src'
  registerFruit({ neim: 'apple' })
`

result.diagnostics // Diagnostic[]
result.errors // Diagnostic[]
result.warnings // Diagnostic[]
result.inlayHints // InlayHint[]
```

---

## 5. Result shape (plain values throughout)

```ts
interface CompletionItem {
  name: string
  kind: 'property' | 'method' | 'variable' | 'keyword' | 'class' | 'interface' | 'type' | 'enum' | 'module'
  type: string // full display type e.g. "(property) Fruit.name: string"
  documentation: string // JSDoc, empty string if none
  isDeprecated: boolean
  isOptional: boolean
  isRecommended: boolean
}

interface Diagnostic {
  message: string
  code: number // TS error code e.g. 2339
  severity: 'error' | 'warning' | 'suggestion'
  line: number
  column: number
}

interface SignatureHelp {
  signatures: Array<{
    label: string // "registerFruit(fruit: Fruit): void"
    documentation: string
    parameters: Array<{ label: string, documentation: string }>
  }>
  activeSignature: number // which overload
  activeParameter: number // which param (zero-indexed)
}

interface InlayHint {
  text: string // "fruit:", ": Fruit"
  kind: 'parameter' | 'type' | 'enum'
  line: number
  column: number
}
```

Per-item lookup (returns `undefined` gracefully if not found):

```ts
result.item('name') // CompletionItem | undefined
result.itemsOfKind('property') // CompletionItem[]
```

---

## 6. Multi-cursor queries

Named cursors are accessed via `.at()`:

```ts
const result = project.query`
  import { registerFruit } from './src'
  registerFruit({ ${cursor('empty')} })
  registerFruit({ name: 'apple', ${cursor('remaining')} })
`

result.at('empty').completions // string[]
result.at('remaining').completions // string[]
result.at('empty').item('name') // CompletionItem | undefined
result.diagnostics // still on the root (file-wide)
```

---

## 7. Snippets in practice

```ts
const whereClause = snippet`{ status: 'open', ${cursor('where')} }`

// Single use — no scoping needed
const result = project.query`
  import { db } from './src'
  db.queryOnce(${whereClause})
`
result.at('where').completions

// Multi-use — scope to avoid cursor name collisions
const result = project.query`
  import { db } from './src'
  db.queryOnce(${whereClause.for('once')})
  db.useQuery(${whereClause.for('hook')})
`
result.at('once.where').completions
result.at('hook.where').completions

// Snippets compose
const taskQuery = snippet`
  { tasks: { where: ${whereClause} } }
`
const result = project.query`
  import { db } from './src'
  db.queryOnce(${taskQuery})
`
result.at('where').completions
```

---

## 8. Groups + parity

The killer feature for library authors. `queryGroup` is a curried tagged template: the first call configures which APIs to test and how; the tagged template provides shared setup (typically imports):

```ts
const queryApis = group([
  'db.queryOnce',
  'db.queryOnceX',
  'db.useQuery',
  'db.useQueryX',
  'db.useInfiniteQuery',
])

const rootArg = snippet`{ workspaces: {}, ${cursor('root')} }`

const result = project.queryGroup(queryApis, api => snippet`${api}(${rootArg})`)`
  import { db } from './src'
`
```

The library instantiates the factory for each group member, scoping cursors automatically (`db.queryOnce.root`, `db.useQuery.root`, …). You never see the scoped names directly — you use the group result API:

```ts
// Individual API access
result.for('db.queryOnce').at('root').completions // string[]
result.for('db.queryOnce').at('root').hover // string | null
result.for('db.queryOnce').diagnostics // Diagnostic[]

// Group-level access
result.group.at('root').completions
// → { 'db.queryOnce': string[], 'db.queryOnceX': string[], ... }

result.group.at('root').hasParity
// → boolean — true if all members have identical completion sets

result.group.at('root').divergence
// → null | { baseline: string; members: Record<string, { added: string[]; removed: string[] }> }
// baseline = the majority set; added/removed = what each outlier differs by

result.diagnostics // whole-file diagnostics across all generated code
```

Cross-cursor parity without a group (just two positions):

```ts
expect(result.at('once.where').completions)
  .toEqualCompletions(result.at('hook.where').completions)
```

---

## 9. Mode matrix

First-class for library authors shipping source + CJS + ESM:

```ts
project.forModes(
  {
    'source': './src/index.ts',
    'dist-esm': { entry: './dist/esm/index.js', dts: './dist/index.d.ts' },
    'dist-cjs': { entry: './dist/cjs/index.js', dts: './dist/index.d.ts' },
  },
  (project, mode) => {
    // Everything inside runs once per mode.
    // `project` here is a scoped clone configured for that mode.
    // `mode` is the key string for labeling.

    it(`[${mode}] suggests Fruit keys`, () => {
      const { completions } = project.query`
        import { registerFruit } from '${project.entry}'
        registerFruit({ ${cursor} })
      `
      expect(completions).toContainCompletions(['name', 'price', 'availableQuantity'])
    })

    it(`[${mode}] no errors on valid input`, () => {
      const { errors } = project.check`
        import { registerFruit } from '${project.entry}'
        registerFruit({ name: 'apple', price: 5, availableQuantity: 100 })
      `
      expect(errors).toBeClean()
    })
  }
)
```

---

## 10. Virtual file scoping

Inject extra files for a single test or describe block without affecting the base project:

```ts
const scoped = project.withFiles({
  'extra.d.ts': `export type Color = 'red' | 'green' | 'blue'`,
})

const result = scoped.query`
  import type { Color } from './extra'
  const c: Color = ${cursor}
`
result.completions // ['red', 'green', 'blue']
```

---

## 11. Custom matchers (opt-in addon)

Activated by `import 'ts-probe/vitest'` in setup. Augments vitest's `expect` globally.

### Completions

```ts
expect(result.completions).toContainCompletion('name')
expect(result.completions).toContainCompletions(['name', 'price', 'availableQuantity'])
expect(result.completions).not.toContainCompletion('neim')
expect(result.completions).toEqualCompletions(['name', 'price', 'availableQuantity']) // exact, order-insensitive

// On a CompletionItem
expect(result.item('name')).toHaveKind('property')
expect(result.item('name')).toHaveType('string')
expect(result.item('name')).toHaveDocumentation(/display name/)
expect(result.item('name')).not.toBeDeprecated()
```

### Diagnostics

```ts
expect(result.errors).toBeClean() // no errors
expect(result.errors).toHaveError(2339) // by TS error code
expect(result.errors).toHaveError(/known properties/) // by message pattern
expect(result.errors).toHaveErrorCount(1)
```

### Parity

```ts
// On a GroupCursorResult
expect(result.group.at('root')).toHaveCompletionParity()

// On two plain string[] (cross-position)
expect(result.at('a').completions).toEqualCompletions(result.at('b').completions)
```

### Signature help

```ts
expect(result.signatureHelp).toBeActiveOnParameter(0) // zero-indexed
expect(result.signatureHelp).toHaveParameterCount(2)
```

### Hover / type snapshots

```ts
// Separate snapshot bucket from runtime snapshots — updates independently
expect(result.hover).toMatchTypeSnapshot()
expect(result.completionItems).toMatchTypeSnapshot()
```

---

## 12. The complete picture (real-world example)

```ts
import { createProject, cursor, group, snippet } from 'ts-probe'
import { describe, expect, it } from 'vitest'

const project = createProject({ tsconfig: './tsconfig.json' })

// ─── reusable building blocks ──────────────────────────────────────────────

const queryApis = group([
  'db.queryOnce',
  'db.queryOnceX',
  'db.useQuery',
  'db.useQueryX',
  'db.useInfiniteQuery',
])

const rootArg = snippet`{ workspaces: {}, ${cursor('root')} }`
const whereArg = snippet`{ status: 'open', ${cursor('where')} }`
const taskQuery = snippet`{ tasks: { where: ${whereArg} } }`

// ─── tests ─────────────────────────────────────────────────────────────────

describe('registerFruit', () => {
  it('suggests all Fruit keys on empty object', () => {
    const { completions } = project.query`
      import { registerFruit } from './src'
      registerFruit({ ${cursor} })
    `
    expect(completions).toContainCompletions(['name', 'price', 'availableQuantity'])
    expect(completions).not.toContainCompletion('neim')
  })

  it('name is a non-deprecated string property with docs', () => {
    const result = project.query`
      import { registerFruit } from './src'
      registerFruit({ ${cursor} })
    `
    expect(result.item('name')).toHaveKind('property')
    expect(result.item('name')).toHaveType('string')
    expect(result.item('name')).toHaveDocumentation(/display name/)
    expect(result.item('name')).not.toBeDeprecated()
  })

  it('hover on registerFruit shows full signature', () => {
    const { hover } = project.query`
      import { registerFruit } from './src'
      registerFruit${cursor}
    `
    expect(hover).toMatchTypeSnapshot()
  })

  it('no errors on valid input', () => {
    const { errors } = project.check`
      import { registerFruit } from './src'
      registerFruit({ name: 'apple', price: 5, availableQuantity: 100 })
    `
    expect(errors).toBeClean()
  })

  it('type error on unknown key', () => {
    const { errors } = project.check`
      import { registerFruit } from './src'
      registerFruit({ neim: 'apple' })
    `
    expect(errors).toHaveError(/known properties/)
    expect(errors).toHaveErrorCount(1)
  })
})

describe('db query API surface', () => {
  it('all query APIs expose identical root completions', () => {
    const result = project.queryGroup(queryApis, api => snippet`${api}(${rootArg})`)`
      import { db } from './src'
    `
    expect(result.group.at('root').completions['db.queryOnce'])
      .toContainCompletions(['workspaces', 'users', 'memberships'])

    expect(result.group.at('root')).toHaveCompletionParity()
  })

  it('where clause completions are consistent across APIs', () => {
    const result = project.queryGroup(queryApis, api => snippet`${api}(${taskQuery})`)`
      import { db } from './src'
    `
    expect(result.group.at('where')).toHaveCompletionParity()
  })

  it('reusing same snippet at two call sites produces matching completions', () => {
    const result = project.query`
      import { db } from './src'
      db.queryOnce(${whereArg.for('once')})
      db.useQuery(${whereArg.for('hook')})
    `
    expect(result.at('once.where').completions)
      .toEqualCompletions(result.at('hook.where').completions)
  })
})

describe('dist output parity', () => {
  project.forModes(
    {
      'source': './src/index.ts',
      'dist-esm': { entry: './dist/esm/index.js', dts: './dist/index.d.ts' },
      'dist-cjs': { entry: './dist/cjs/index.js', dts: './dist/index.d.ts' },
    },
    (project, mode) => {
      it(`[${mode}] registerFruit completions survive compilation`, () => {
        const { completions } = project.query`
          import { registerFruit } from '${project.entry}'
          registerFruit({ ${cursor} })
        `
        expect(completions).toContainCompletions(['name', 'price', 'availableQuantity'])
      })
    }
  )
})
```

---

## 13. Extension points and what's intentionally out of scope

The library ships three entry points:

```ts
import { createProject, cursor, group, snippet } from 'ts-probe' // core
import 'ts-probe/vitest' // auto-extends expect, TypeScript-aware type augmentation
import 'ts-probe/jest' // same for jest
```

**Deliberately out of scope in v1:**
- Go-to-definition, find-references, rename — niche, zero regression value for the target use case
- Code actions / quick fixes — same argument
- Formatting — entirely out of scope
- Async API surface — the TS language service is synchronous; forced `await` would be pure noise

**Natural extension points for third parties:**
- Plugin authors can call `project.languageService` to access the raw TS language service for anything not covered
- The custom matchers addon pattern is openly documented so teams can ship their own domain-specific matcher sets on top of `ts-probe/matchers`
- `project.withFiles()` and `project.forModes()` give enough surface area that framework-specific wrappers (e.g. a `ts-probe-angular` that pre-configures the Angular compiler) are straightforward to build without forking
