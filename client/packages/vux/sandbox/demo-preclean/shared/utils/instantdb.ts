import type { ConnectionStatus, InstaQLEntity } from '@mszr/idb-vux'
import type { AppSchema } from '../../instant.schema'

import { defineQuery, id } from '@mszr/idb-vux'

export type { AppSchema }
export type {
  ConnectionStatus,
  InstaQLEntity,
}

export { id }
export const q = defineQuery<AppSchema>()
