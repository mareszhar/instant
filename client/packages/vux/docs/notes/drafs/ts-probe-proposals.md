i requested proposals for a library to compose intellisense tests in typescript to 3 different experts.

they all published an initial draft to a shared folder, and then had a chance to review each other's proposals before presenting their own final proposals.

beyond that initial "brainstorming" stage where ideas were open for review to all, the experts did not have a chance to respond to each other's final proposals, nor did they read anyone's final proposal before submitting theirs.

so what follows are those 3 final proposals as they were presented.

they all knew that the following criteria was going to be used to determine the ideal version of the envisioned lib:

1. feels pleasant to work with
2. is idiomatic/ergonomic/natural/intuitive/friendly
3. enables DRY code
4. enables self-documenting tests
5. offers the best possible DX
6. makes common patterns easy (eg: parity across multiple equivalent APIs, reusing snippets, passing multiple args to functions, etc)
7. is project-agnostic, and flexible (can be used in lots of different contexts and cater to many needs)
8. is simple to get started with, but it's also powerful and can handle complex scenarios
9. it looks beautiful/elegant/clean/concise/polished
10. it's extensible/modular (eg: could be augmented into a public for vitest to produce even more terse tests, or ship an optional ready-to-use plugin)

now, i'd like you to review the 3 final proposals and tell me:

where did they converge? (is there anything they all agreed was best or where their proposed ideal apis were essentially the same or very similar?)

what did they disagree on? (where did they propose different solutions to the same problems?)

when the proposals diverged, is there any case when there is one superior solution over the others based on objective facts (eg: performance) or goals/desirable traits (eg: our criteria)? (please justify your answer), and/or when is that simply a matter of preference? (in that case, what are the trade-offs of each solution?)

what were the most interesting or surprising ideas?

which proposal seems to best satisfy the criteria above?

what would be the ideal library that takes the best ideas from all 3 proposals? (and what is subjective and up to personal preference to decide)

lastly, which of the proposed libraries do you think would be the most fun to work with? (most lovable/delightful/ergonomic/DXful/joyful to use) (explain why, and then also rank each proposal from 1-10 on this final aggregate metric, where 10 is perfect and 1 is trash)

(find all 3 proposals attached)

---
---
---
---
---
---

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

---
---
---
---
---
---

# EXPERT 'G' PROPOSAL

By synthesizing the best design ideas from all prior discussions, we can define a cohesive and production-ready API specification. This consolidated library is named **`ts-probe`**.

This design focuses heavily on standard JavaScript primitives, avoiding custom DSLs where possible to ensure that tests are self-documenting and work natively with standard assertion utilities (like Vitest's `expect`).

---

## The Core Concept: `ts-probe`

`ts-probe` handles the complexities of managing an in-memory TypeScript Language Service. It uses a zero-config, template-driven model where cursors are represented by first-class JavaScript primitives instead of magic comment strings.

```typescript
import { cursor, defineProject, snippet } from 'ts-probe'
```

---

## 1. Project Lifecycle & Multi-File Environments

`ts-probe` resolves your project's workspace, handles real imports out-of-the-box, and easily supports virtual file overrides for testing complex edge cases.

```typescript
// 1. Zero-config (Strict, in-memory TS context)
const project = defineProject()

// 2. Real TS Configuration (Resolves real src/ paths and node_modules)
const project = defineProject({ tsconfig: './tsconfig.json' })

// 3. Advanced Workspace Isolation (Pre-mocking virtual or third-party files)
const project = defineProject({
  tsconfig: './tsconfig.json',
  files: {
    'node_modules/my-lib/index.d.ts': `
      export declare function registerFruit(fruit: Fruit): void
      export interface Fruit { name: string; price: number }
    `,
  },
})
```

---

## 2. Cursor Primitives & Code Queries

To query the TypeScript Language Service, you write a standard tagged template literal. Cursors are passed as direct variables, allowing `ts-probe` to calculate coordinates seamlessly behind the scenes.

```typescript
// Single Cursor (returns plain context directly)
const result = project.query`
  import { registerFruit } from './src'
  registerFruit({ ${cursor()} })
`

// Multiple Cursors (namespaced by key)
const result = project.query`
  import { registerFruit } from './src'
  registerFruit({ ${cursor('empty')} })
  registerFruit({ name: 'apple', ${cursor('partial')} })
`

// Access outputs cleanly via namespaced keys
result.at('empty').completions // string[]
result.at('partial').completions // string[]
```

---

## 3. Snippets: Composability and DRY Code

To keep tests DRY, you can define **Snippets** as independent tagged template literals. Snippets can contain their own cursors and are easily composed within larger queries. Cursors inside nested snippets are automatically namespaced.

```typescript
// Define a reusable configuration block with an internal cursor
const configSnippet = snippet`{
  where: {
    ${cursor('fields')}
  }
}`

test('reusing snippets without cursor collisions', () => {
  const result = project.query`
    import { db } from './src'
    
    // Alias the snippet to namespace its internal cursors
    db.queryOnce(${configSnippet.as('queryOnce')})
    db.useQuery(${configSnippet.as('useQuery')})
  `

  // Cursors are nested under their respective alias
  expect(result.at('queryOnce.fields').completions).toContain('id')
  expect(result.at('useQuery.fields').completions).toContain('id')
})
```

---

## 4. Pure Primitives: The "No-Memory" Assertion DX

A core friction point of custom testing libraries is memorizing a separate set of assertions. By returning structured, standard JavaScript objects, `ts-probe` integrates seamlessly with your test runner's native matchers (like Vitest's `expect`).

### Plain Completions & Hover Snapshotting

Because the outputs are plain strings and arrays, you can use built-in Vitest assertions and snapshots without configuring custom matchers.

```typescript
test('autocomplete & hover assertions', () => {
  const result = project.query`
    import { registerFruit } from './src'
    registerFruit({ ${cursor()} })
  `

  // Plain string[] works natively with .toContain
  expect(result.completions).toContain('name')
  expect(result.completions).not.toContain('invalidKey')

  // Hover returns a plain string, making it perfect for native inline snapshots
  expect(result.hover).toMatchInlineSnapshot(`
    "(property) Fruit.name: string
    The primary name of the fruit."
  `)
})
```

### Complex Completion Item Matching

For detailed property checks (documentation, JSDoc, deprecations), `ts-probe` returns a structured dictionary, enabling natural object matches.

```typescript
test('completion metadata', () => {
  const result = project.query`
    import { registerFruit } from './src'
    registerFruit({ ${cursor()} })
  `

  // Query structured metadata cleanly using standard object matching
  expect(result.completionItem('name')).toMatchObject({
    kind: 'property',
    type: 'string',
    isDeprecated: false,
    documentation: expect.stringContaining('display name'),
  })
})
```

### Type Diagnostics & Error Checks

Testing validation errors is accomplished by checking the code directly.

```typescript
test('diagnostic validation errors', () => {
  const result = project.check`
    import { registerFruit } from './src'
    registerFruit({ neim: 'apple' })
  `

  expect(result.errors).toContainEqual(
    expect.objectContaining({
      code: 2353, // TS error code for unknown properties
      message: expect.stringContaining('Object literal may only specify known properties'),
    })
  )
})
```

---

## 5. API Groups & Parity Engine

For library designers, verifying that multiple parallel APIs (such as hooks, helper wrappers, or method variants) offer identical IntelliSense behaves as a critical check.

By utilizing standard JavaScript arrays inside template literals, you can write concise, multi-entrypoint assertions.

```typescript
test('parity across the query surface area', () => {
  const queryApis = ['db.query', 'db.useQuery', 'db.useInfiniteQuery']
  const args = snippet`{ where: { ${cursor('where')} } }`

  // Map array into template to automatically unroll and register nested cursors
  const result = project.query`
    import { db } from './src'
    ${queryApis.map(api => `${api}(${args.as(api)})`)}
  `

  // Collect the cursors into a unified group
  const group = result.group(queryApis.map(api => `${api}.where`))

  // Assert that all entrypoints have identical autocomplete suggestions
  expect(group.hasParity).toBe(true)

  // If parity fails, group.diff provides structured details pointing out the mismatch
  if (!group.hasParity) {
    console.log(group.diff)
  }
})
```

---

## 6. Build Mode Matrix Testing

Types can easily break when built to target distributions (like CJS and ESM). `ts-probe` allows testing your identical suite of code scenarios against multiple built endpoints.

```typescript
const project = defineProject({
  tsconfig: './tsconfig.json',

  // Register the file targets to test against
  modes: {
    'source': './src/index.ts',
    'dist-esm': './dist/esm/index.js',
    'dist-cjs': './dist/cjs/index.js',
  },
})

// Automatically runs the nested tests once for each target
project.forModes((runner, mode) => {
  it(`[${mode}] suggests correct autocompletes`, () => {
    const result = runner.query`
      import { registerFruit } from '${runner.entrypoint}'
      registerFruit({ ${cursor()} })
    `

    expect(result.completions).toContain('name')
  })
})
```

---

## 7. Optional Custom Matcher Plug-In (Extensibility)

For developers who prefer high-level, semantic custom assertions, `ts-probe` offers an optional, lightweight custom matcher plugin for Vitest or Jest.

```typescript
// vitest.setup.ts
import { matchers } from 'ts-probe/matchers'
import { expect } from 'vitest'

expect.extend(matchers)
```

```typescript
// Enabled semantic sugar
expect(result.completions).toContainCompletions(['name', 'price'])
expect(result.errors).toBeEmpty()
expect(result.group(myGroup)).toHaveCompletionParity()
```

---

## Summary of Evaluated Criteria

This design aligns with the specified goals:
- **DX and Idiomatic Design (1, 2, 5, 9):** Tagged template literals with `cursor()` interpolations completely eliminate magic comment strings, while plain-value returns integrate directly with your test runner's standard assertions.
- **DRY & Multi-pattern Support (3, 6):** Composability using modular `snippet` objects allows complex layouts to be written once, and mapped arrays handle testing parallel APIs seamlessly.
- **Project Agnostic (7, 8):** Can be used with simple in-memory scripts or loaded up to verify real projects with deep build matrices.
- **Modular (10):** The base library stays lightweight and dependency-free, while the custom matchers and matrix tools are optional helpers that can be loaded when needed.

---
---
---
---
---
---

# EXPERT 'X' PROPOSAL

**Ultimate Dream API Spec (DX-First, Synthesized)**

## 1) Core philosophy

1. `sync-first`, plain values by default.
2. cursor-in-code, never line/column math.
3. dead-simple quick start, deep power when needed.
4. DRY as a first-class feature (groups, snippets, matrices).
5. optional runner plugins, not required for core use.
6. project-agnostic: real repo, virtual repo, fixture modules, dist targets.

---

## 2) Package layout

1. `ts-probe` (core, runner-agnostic).
2. `ts-probe/vitest` (optional matchers + helpers).
3. `ts-probe/jest` (optional parity with Vitest integration).
4. `ts-probe/plugins/*` (future: snapshots, custom renderers, domain packs).

---

## 3) Minimal public API (starter path)

```ts
import { cursor, defineProject } from 'ts-probe'

const project = defineProject({ tsconfig: './tsconfig.json' })

const r = project.query`
  import { registerFruit } from './src'
  registerFruit({ ${cursor()} })
`

expect(r.completions).toContain('name')
expect(r.errors).toHaveLength(0)
```

`query` = language-service probe with one or many cursors.  
`check` = diagnostics-only (no cursor required).

---

## 4) Authoring primitives (power path)

1. `cursor(name?)`
- `cursor()` for single-position tests.
- `cursor('where')` for named multi-cursor tests.

2. `snippet` (reusable code fragments with scoped cursors)

```ts
import { cursor, snippet } from 'ts-probe'

const where = snippet`{ status: 'open', ${cursor('where')} }`
```

3. `apiGroup(name, members)` (equivalent API families)

```ts
const queryApis = apiGroup('queryApis', [
  'db.queryOnce',
  'db.queryOnceX',
  'db.useQuery',
  'db.useQueryX',
  'db.useInfiniteQuery',
  'db.useInfiniteQueryX',
  'q',
])
```

4. fixture resolution (import funcs/vals/types from reusable files)

```ts
const project = defineProject({
  tsconfig: './tsconfig.json',
  fixtureDir: './src/tests/intellisense/fixtures',
})
```

---

## 5) Results model (plain by default)

For a single cursor:
- `r.completions: string[]`
- `r.completionItems: CompletionItem[]`
- `r.hover: string | null`
- `r.signatureHelp: SignatureHelp | null`
- `r.diagnostics / r.errors / r.warnings`
- `r.inlayHints`

For multiple cursors:
- `r.at('name').completions`
- `r.at('name').completionItems`
- etc.

Rich item access:
- `r.completionItem('name')`
- `r.completionItemsOfKind('property')`

Group result shape:
- `g.for(api).at('root').completions`
- `g.at('root').byApi` -> `Record<ApiName, string[]>`
- `g.at('root').parity()` -> boolean
- `g.at('root').diff()` -> structured divergence report

---

## 6) DRY-first group execution API (the key ergonomic feature)

```ts
const arg = snippet`{
  workspaces: {},
  ${cursor('root')}
}`

const g = project.queryGroup({
  apis: queryApis,
  prelude: `
    import { db, q } from '#fixtures/query-surface'
  `,
  call: (api, args) => `${api}(${args[0]})`,
  args: [arg],
})

expect(g.at('root').parity()).toBe(true)
expect(g.at('root').shared()).toEqual(expect.arrayContaining(['users', 'memberships']))
```

This is the “one test, many equivalent APIs” path you asked for.

---

## 7) Mode matrix (source/dist parity)

```ts
project.forModes(
  {
    'source': { entrypoint: './src/index.ts' },
    'dist-esm': { entrypoint: './dist/esm/index.js', dts: './dist/esm/index.d.ts' },
    'dist-cjs': { entrypoint: './dist/commonjs/index.js', dts: './dist/commonjs/index.d.ts' },
  },
  (p, mode) => {
    const r = p.query`
      import { registerFruit } from '${p.entrypoint}'
      registerFruit({ ${cursor()} })
    `
    expect(r.completions).toContain('name')
  },
)
```

---

## 8) Optional fluent assertions (addon, not mandatory)

Core stays plain. Optional facade gives terseness:

```ts
r.expect.at('root').contains(['users', 'memberships']).excludes('__error_message__')
g.expect.at('root').hasParity()
r.expect.diagnostics().isEmpty()
```

Vitest plugin can add:
- `toContainCompletions`
- `toHaveCompletionParity`
- `toHaveTsError`
- `toMatchTypeSnapshot`

---

## 9) Self-documenting test style (recommended convention)

```ts
const schemaQueryArg = snippet`{ workspaces: {}, ${cursor('root')} }`

it('query-like APIs keep root completion parity', () => {
  const g = project.queryGroup({
    apis: queryApis,
    prelude: `import { db, q } from '#fixtures/query-surface'`,
    call: (api, [arg]) => `${api}(${arg})`,
    args: [schemaQueryArg],
  })

  expect(g.at('root').parity()).toBe(true)
  expect(g.at('root').shared()).toEqual(expect.arrayContaining(['users', 'memberships']))
})
```

Readable intent, minimal duplication, easy diff when regressions happen.

---

## 10) Extensibility contract

1. plugin hooks:
- `onProgramCreate`
- `onProbeResolved`
- `formatDiff`
- `augmentResult`

2. stable internal adapters:
- completion source adapter
- diagnostics normalizer
- snapshot serializer

3. domain packs:
- `ts-probe-plugin-vue`
- `ts-probe-plugin-react`
- `ts-probe-plugin-zod`  
These should only add helpers, never change core semantics.

---

## Final recommendation

If we freeze one “ultimate” design, this should be it:
- **Core = plain, synchronous, tagged-template probes**
- **Power = snippets + api groups + mode matrices**
- **Ergonomics = optional assertion/matcher layer**
- **Scale = fixtures + virtual files + plugin hooks**

This gives the best blend of pleasant day-to-day DX and serious regression-catching power.

---
---
---
---
---
---
