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
* **DX and Idiomatic Design (1, 2, 5, 9):** Tagged template literals with `cursor()` interpolations completely eliminate magic comment strings, while plain-value returns integrate directly with your test runner's standard assertions.
* **DRY & Multi-pattern Support (3, 6):** Composability using modular `snippet` objects allows complex layouts to be written once, and mapped arrays handle testing parallel APIs seamlessly.
* **Project Agnostic (7, 8):** Can be used with simple in-memory scripts or loaded up to verify real projects with deep build matrices.
* **Modular (10):** The base library stays lightweight and dependency-free, while the custom matchers and matrix tools are optional helpers that can be loaded when needed.
