# Fork Rebase Workflow

Audience: maintainers keeping `vux` aligned with `upstream/main`.

Last updated: `2026-05-23`

## Stable fork policies

1. Keep fork workspace structure and `idb-vux` layout intact.
2. Keep lockfile and manifests consistent after rebase.
3. Keep fork CI focused on code health; gate upstream-only release/deploy behavior by repository.

## Rebase checklist (`vux` branch)

1. `git fetch upstream`
2. `git checkout vux`
3. `git rebase upstream/main`
4. Resolve conflicts while preserving fork policies.
5. Validate:
   - `pnpm --dir client/packages/vux run sdk:typecheck`
   - `pnpm --dir client/packages/vux run sdk:test`
   - `pnpm --dir client run check-format`
6. Push: `git push --force-with-lease origin vux`

## Rebase checklist (`main` branch)

Use when fork `main` should match `upstream/main`:

1. `git checkout main`
2. `git fetch upstream`
3. `git rebase upstream/main`
4. `git push origin main`
5. Cleanup failed deployments:
   - From `client/packages/vux/scripts`, run `./cleanup-preview-deployments.sh`
   - Use your `idb-fork-deployments-reset` token when prompted.
   - **Rationale**: Since `main` is a 1:1 copy of upstream, it triggers CI jobs that rely on upstream-only secrets. Running this script clears the resulting failed deployments from the fork UI.

## Quick parity triage

During each rebase window, inspect upstream changes in:

- `client/packages/core`
- `client/packages/webhooks`
- `client/packages/react`
- `client/packages/react-common`
- `client/packages/react-native`
- `client/packages/svelte`
- `client/packages/admin`
- `client/packages/vue` (official Vue SDK)

Use the explicit upstream range from before and after the fetch/rebase, not a
plain working-tree `git diff` after the rebase. Once the rebase is clean, plain
`git diff` should be empty and will not show what changed upstream.

Example:

1. Before fetching, note the current upstream base:
   `OLD_UPSTREAM_MAIN=$(git rev-parse upstream/main)`
2. After `git fetch upstream`, note the new base:
   `NEW_UPSTREAM_MAIN=$(git rev-parse upstream/main)`
3. Inspect watched surfaces with:
   `git diff --name-status "$OLD_UPSTREAM_MAIN..$NEW_UPSTREAM_MAIN" -- client/packages/core client/packages/webhooks client/packages/react client/packages/react-common client/packages/react-native client/packages/svelte client/packages/admin client/packages/vue`
4. Summarize the upstream commits with:
   `git log --oneline "$OLD_UPSTREAM_MAIN..$NEW_UPSTREAM_MAIN"`

If none changed in parity-relevant surfaces, skip parity porting for that cycle.
