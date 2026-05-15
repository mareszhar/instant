# demo-ssr-bug-preserve-symlinks

This is the linked-dependency `demo-ssr-bug` shape with one Vite config change:

```ts
const nuxtConfigPatch = {
  vite: {
    resolve: {
      preserveSymlinks: true,
    },
  },
}
```

In Codex's local page-load verification, this rendered HTTP 200 while the same
linked demo without `preserveSymlinks` rendered HTTP 500 with:

```text
(0 , __vite_ssr_import_0__.id) is not a function
```

Run:

```sh
bun install --force
bun run verify:dev
curl -sS -D - http://localhost:3000/
```
