/**
 * The error family — the one branded value-name exception ([conventions §2]):
 * `e instanceof IdbError` must read branded next to other libraries' errors.
 *
 * These are core's error *classes*, re-exported under dux names. Keeping the
 * official class (not a re-thrown wrapper) is what makes `instanceof` work:
 * every error dux surfaces — client reactor and admin fetch alike — is one of
 * these, since admin's `InstantAPIError extends` core's `InstantError`. Renamed
 * at the boundary, behavior untouched ([dux-vision.md §1.2]).
 */
export {
  // The API-level error (status + issue body); thrown by the admin fetch path.
  InstantAPIError as IdbApiError,
  // The base error every dux error extends — `e instanceof IdbError` catches all.
  InstantError as IdbError,
} from '@instantdb/core'
export type { InstantIssue as IdbIssue } from '@instantdb/core'
