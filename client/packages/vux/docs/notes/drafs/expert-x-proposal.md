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
