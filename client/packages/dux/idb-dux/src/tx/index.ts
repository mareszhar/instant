export { typedTx } from './typedTx.js'
export type {
  IdbTx,
  IdbTxChunk,
  IdbTxCreate,
  IdbTxLink,
  IdbTxNamespace,
  IdbTxRuleParams,
  IdbTxUpdate,
  IdbTxUpdateOpts,
} from './types.js'
// `id` and `lookup` keep their official names — values are unprefixed at the
// boundary; `lookup` remains available for direct use beside dot-path links.
export { id, lookup } from '@instantdb/core'
