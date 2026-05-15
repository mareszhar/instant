# Docs Maintenance Workflow

Audience: maintainers updating docs and notes.

## Ownership model

- `client/packages/vux/README.md`: short workspace orientation only.
- `client/packages/vux/docs/README.md`: canonical maintainer index and notes recency table.
- `client/packages/vux/docs/notes/*`: archive-first references, not primary onboarding docs.
- `client/packages/vux/idb-vux/docs/*`: user-facing SDK documentation.

## Docs vs notes decision

Write to **docs** when the content is needed to actively operate or evolve the project.

Write to **notes** when the content is historical research, experiment logs, or closed investigations that are still useful as trace memory.

## Updating notes metadata and recency

Each note must start with this metadata at the top:

- `updated: YYYY-MM-DD`
- `status: completed|open` (optional)

When a note changes:

1. update that note's `updated` value
2. refresh the "Recently updated notes" table in `../README.md`
3. keep sort order descending by `updated`

## DRY enforcement checklist

Before merging doc changes:

1. confirm no duplicate full doc indexes across `vux/README.md` and `vux/docs/README.md`
2. confirm `idb-vux` docs do not use relative links to files outside `idb-vux`
3. confirm maintainer-only workflows are absent from `idb-vux/README.md` and `idb-vux/demo/README.md`
