# demo-ssr-bug-tarballs

This is a tarball-install control for `../demo-ssr-bug`.

The app code intentionally mirrors the linked-dependency repro:

- `shared/utils/idb.ts` imports/re-exports `id` and calls `id()` at module scope.
- `instant.schema.ts` imports `i` and creates a schema at module scope.
- `app/app.vue` imports `init`, imports the schema, and calls `init({ schema })`.

To refresh local tarballs from this repo:

```sh
pnpm --dir ../.. run pack:all
```

Then install and run:

```sh
bun install
bun run dev
```

Open the local Nuxt URL in a browser. The control passes only if the page renders
under `ssr: true` without the linked-dependency entrypoint-call error.
