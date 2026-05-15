# @mszr/idb-vux Nuxt Demo

This is a Nuxt 4 demo for validating `@mszr/idb-vux` v1 behavior.

## Setup

```bash
cd client
pnpm install
cp packages/vux/sandbox/demo-preclean/.env.example packages/vux/sandbox/demo-preclean/.env
pnpm --dir packages/vux/sandbox/demo-preclean lint
pnpm --dir packages/vux/sandbox/demo-preclean typecheck
pnpm --dir packages/vux/sandbox/demo-preclean dev
```

`@mszr/idb-vux` is linked as a local alias dependency in this demo. The demo
`postinstall` script rebuilds the Vue and Admin SDK packages so `dist` exports
are always present after a clean reinstall.

Then open the local Nuxt URL and verify:

- Auth (`useAuth`, `SignedIn`, `SignedOut`)
- Query + transact (`useQuery`, `db.transact`)
- Connection status + local id
- Presence + sync presence
- Topics publish/listen
- Typing indicator
- Cursors component
- Nuxt server routes using `@instantdb/admin`

Open `/patterns` to compare quest query ergonomics before changing the public
demo. That sandbox includes six patterns, including preloaded personal pools,
single-query `undefined` skip, and the Vue-only `keepPreviousData` option.

For SDK edit workflows and stale-runtime troubleshooting, use
`client/packages/vux/docs/workflow-demo-resolution.md`.

## Runtime env

`.env` values used by this demo:

- `NUXT_PUBLIC_INSTANT_APP_ID` (safe for client)
- `NUXT_INSTANT_APP_ADMIN_TOKEN` (server-only)

Do not expose admin tokens through `runtimeConfig.public`.

## Server routes in this demo

- `POST /api/instant` for auth cookie sync (`createInstantRouteHandler`)
- `GET /api/admin/overview` for server-side read diagnostics
- `POST /api/admin/purge-completed` for explicit demo admin mutation

## About `--host` directory artifacts

If you accidentally run Nuxt with `--host` interpreted as a positional path,
Nuxt can create a `--host` directory containing generated output.
Likewise, `pnpm dev -- --no-fork` can create a `--no-fork` folder.

Use one of these commands instead:

```bash
pnpm --dir packages/vux/sandbox/demo-preclean dev
pnpm --dir packages/vux/sandbox/demo-preclean dev -- --host 0.0.0.0
pnpm --dir packages/vux/sandbox/demo-preclean dev --no-fork
```

For plain Nuxt flags, prefer `pnpm ... dev --flag` (without the extra `--`).
Use `-- --host ...` only when passing arguments that pnpm itself would consume.

## IDE formatting

This demo ships with `demo/.vscode/settings.json` so save-time formatting uses
ESLint fixes instead of a conflicting default formatter.

The monorepo-level Prettier ignore also excludes `client/packages/vux/**`,
so Vue package formatting remains driven by ESLint + antfu style rules.

The formatter override is scoped to this demo workspace only
(`client/packages/vux/sandbox/demo-preclean/.vscode/settings.json`) so global IDE formatting behavior
outside this project is not modified.

## Notes

- SSR data support is not implemented in this demo. SDK hooks are resilient to SSR execution and return safe inert states server-side.
- Demo SFCs use `pug` templates and `stylus` styles.
- Demo state is organized in a Pinia setup store (`app/stores/demo.ts`) with VueUse helpers.
