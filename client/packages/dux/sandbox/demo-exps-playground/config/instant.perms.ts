// Typed permissions, authored against the schema and compiled to the plain
// rules object Instant accepts.
// Docs: https://github.com/mareszhar/instant/blob/dux/client/packages/dux/docs/dux-spec-perms.md
import { definePerms } from '@mszr/idb-dux/perms'
import { schema } from './instant.schema'

export default definePerms(schema)
  .attrs(a => a.allow({ create: false }))
  .defaults(d => d
    .bind(({ auth }) => ({
      isSignedIn: auth.id.neq(null),
    }))
    .allow({ $default: false }))
  .compile()
