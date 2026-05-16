import type { InstantVuxDatabase } from '../InstantVuxDatabase.js'
import { i } from '@instantdb/core'
import { ref } from 'vue'

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

const localIdX = db.useLocalIdX('device')

const localIdFromRef: string | null = localIdX.localId.value
const localIdFromRefs: string | null = localIdX.refs.localId.value
const localIdFromState: string | null = localIdX.state.localId

const nameRef = ref('session')
const localIdFromReactiveName = db.useLocalIdX(nameRef).state.localId

void localIdFromRef
void localIdFromRefs
void localIdFromState
void localIdFromReactiveName
