import type { ConnectionStatus } from '@instantdb/core'
import type { InstantVuxDatabase } from '../InstantVuxDatabase.js'
import { i } from '@instantdb/core'

const schema = i.schema({
  entities: {
    users: i.entity({
      email: i.string().indexed(),
    }),
  },
  links: {},
})

type Schema = typeof schema

declare const db: InstantVuxDatabase<Schema, false>

const connectionX = db.useConnectionStatusX()

const statusFromRef: ConnectionStatus = connectionX.status.value
const statusFromRefs: ConnectionStatus = connectionX.refs.status.value
const statusFromState: ConnectionStatus = connectionX.state.status

void statusFromRef
void statusFromRefs
void statusFromState
