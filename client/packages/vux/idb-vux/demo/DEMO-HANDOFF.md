# Demo Handoff

## Status

Demo styling pass is complete and approved.

## Current Focus

TypeScript architecture, composable ergonomics, and component surface simplification.

## TypeScript Polish Backlog

Legend: `todo` | `in-progress` | `done`

- [x] `done` Audit every `reactive(useX())` usage and decide a consistent pattern (remove wrapper where possible, keep only where technically justified).
- [x] `done` Refactor composable return shapes so components can consume them cleanly without extra wrappers.
- [x] `done` Remove manual imports from `shared/utils/idb` where Nuxt auto-imports are available and reliable; run prep/types validation.
- [x] `done` Reduce component-level orchestration noise by extracting reusable interaction patterns (context menu state/positioning, outside-click/escape handling).
- [x] `done` Consolidate ephemeral feedback handling into shared primitives (access panel included), with one consistent API.
- [x] `done` Evaluate VueUse-first replacements for handwritten logic where they improve clarity (`onClickOutside`, timer utilities, etc.).
- [ ] `todo` Reassess `useAccess` boundaries and split responsibilities into smaller composables where this improves readability and testability.
- [ ] `todo` Produce a fairness analysis of code size/complexity vs `demo-preclean`, identifying what is required scope vs accidental complexity.
- [ ] `todo` Identify API friction points in current SDK usage that force verbosity and propose concise `X`-API improvements.
- [ ] `todo` Apply approved refactors incrementally with typecheck/build after each slice.

## Notes for Next Iteration

- Prioritize readability of component scripts over micro-optimizations.
- Prefer composable APIs that are obvious at call sites.
- Keep no-cast policy in usage code (`as any`/unsafe casts forbidden).
