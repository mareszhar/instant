# Vux Maintainer Docs

Canonical maintainer docs index for the Vux workspace.

Last refreshed: `2026-05-27`

## Docs vs notes

- **Docs**: active references needed to operate, maintain, or evolve this workspace.
- **Notes**: research drafts, investigations, and historical snapshots.
- Keep docs DRY: each concept has one canonical home; cross-link instead of duplicating.
- Notes keep stable filenames. Recency is managed in this index table, not via filename changes.

## Official docs

### Core

- [Architecture](./architecture.md)
- [Testing strategy](./testing-strategy.md)
- [Roadmap](./roadmap.md)

### Workflows

- [Demo resolution workflow](./workflow-demo-resolution.md)
- [Publish to `idb-vux`](./workflow-publish-idb-vux.md)
- [Fork rebase workflow](./workflow-fork-rebase.md)
- [Docs maintenance workflow](./workflow-docs-maintenance.md)

## Recently updated notes

| Note | Updated | Scope |
| --- | --- | --- |
| [Upstream follow-ups](./notes/upstream-follow-ups.md) | 2026-05-27 | Tracked upstream PRs and candidate fixes that could remove Vux compatibility layers. |
| [Feature parity audit](./notes/feature-parity-audit.md) | 2026-05-25 | Cross-SDK parity matrix including intentional divergence choices. |
| [SSR feasibility](./notes/ssr-feasibility.md) | 2026-05-25 | SSR architecture feasibility with current Nuxt auth/server-db helper status. |
| [Raw getter state projection pattern](./notes/raw-getter-state-projection.md) | 2026-05-19 | Maintainer rationale for X `state` as a Pinia-friendly `markRaw` getter projection over refs. |
| [Vue SDK recon audit](./notes/vue-sdk-recon-audit.md) | 2026-05-15 | Deep official Vue vs Vux parity and divergence assessment with superset recommendations. |
| [Misc DX/UX proposals feasibility](./notes/misc-dx-ux-proposals-feasibility.md) | 2026-05-13 | Additive ergonomics proposals for setup/auth/query workflows and boilerplate reduction. |
| [Permissions DX feasibility](./notes/permissions-dx-feasibility.md) | 2026-05-10 | Typed permission authoring helpers that compile to CEL with schema-aware validation. |
| [Misc feature feasibility](./notes/misc-feature-feasibility.md) | 2026-05-10 | Historical feasibility notes for smaller parity features. |
| [Nuxt SSR entrypoint investigation](./notes/nuxt-ssr-entrypoint-investigation.md) | 2026-05-04 | Detailed linked-dependency SSR failure investigation and mitigations. |
| [SSR demo workspace guidance](./notes/ssr-demo-workspace-guidance.md) | 2026-05-04 | Practical setup guidance for SSR repro demos. |
| [Handoff status snapshot](./notes/handoff-status.md) | 2026-04-29 | Point-in-time delivery status snapshot. |
| [Demo ergonomics experiments](./notes/demo-ergonomics.md) | 2026-04-24 | Query UX experiment log and findings. |
