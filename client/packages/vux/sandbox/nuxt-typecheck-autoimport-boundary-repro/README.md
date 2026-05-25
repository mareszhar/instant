# Nuxt Typecheck Autoimport Boundary Repro

Minimal Nuxt 4 repro for app/server autoimport scope leaking during typecheck.

## Repro

```sh
bun install
bun run typecheck
```

## Observed

`nuxt typecheck` reports errors in `server/api/someEndpoint.post.ts`.

The endpoint calls `doSomething(10)`, which is valid in a server file because `server/utils/doSomething.ts` accepts a number. During typecheck, though, the call is checked against `app/utils/doSomething.ts`, which expects a string and returns an object without a `length` property instead of a `quantity` one.

```txt
server/api/someEndpoint.post.ts:4:30 - error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.

4   const result = doSomething(10)

server/api/someEndpoint.post.ts:5:29 - error TS2339: Property 'quantity' does not exist on type '{ length: number; scope: "app-only"; }'.

5   return { quantity: result.quantity }
```

## Expected

Server files should resolve bare autoimports from the server environment. App-only autoimports should not be considered available in `/server`, just as server-only autoimports are not app globals.

This should match env-scoped tooling behavior: ESLint can distinguish app/server boundaries, but typecheck currently conflates them.

## Why It Happens

`.nuxt/tsconfig.app.json` includes `.nuxt/nuxt.d.ts`, which references `.nuxt/types/nitro.d.ts`. Nitro route typing then imports server handlers:

```ts
ReturnType<typeof import('../../server/api/someEndpoint.post').default>
```

That pulls server route modules into the app type graph, where app autoimports are in scope.

## Attempted Workaround

Running app/server typechecks separately does not fix the issue:

```sh
bun run typecheck:split
```

The app pass still fails because `.nuxt/tsconfig.app.json` itself imports Nitro route types.
The server pass alone succeeds with `bun run typecheck:server`.

## Possible Direction

Avoid evaluating server route modules inside the app project type graph. Nitro route response types could be generated without importing handlers from the app tsconfig, or those handler imports could belong only to the server project.
