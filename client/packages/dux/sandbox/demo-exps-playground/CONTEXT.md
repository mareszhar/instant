# demo-exps-playground

a minimal Nuxt 4 project for drafting and trying dux/idb ideas without affecting the main idb-dux demo. Like the main demo, its server routes use the bring-your-own-adapter recipe — a small local h3 v1 adapter over `@mszr/idb-dux/server` in `server/utils/idb.ts` (Nuxt 4 / Nitro 2 rides h3 v1; the shipped `@mszr/idb-dux/h3` adapter targets h3 v2 / Nitro 3, which is unreleased).
