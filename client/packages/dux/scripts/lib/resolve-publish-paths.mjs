/**
 * Resolve workspace filesystem anchors for the publishing scripts. One source of truth so
 * a moved directory is a one-line fix, not a hunt across scripts.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url))

/** `client/packages/dux` — the orchestrator workspace. */
export const WORKSPACE_ROOT = path.resolve(LIB_DIR, '..', '..')
/** `client/packages/dux/idb-dux` — the published package. */
export const PKG_DIR = path.resolve(WORKSPACE_ROOT, 'idb-dux')
export const PKG_JSON = path.resolve(PKG_DIR, 'package.json')
/** The one public demo (the dux starter). */
export const DEMO_DIR = path.resolve(PKG_DIR, 'demo')
export const DEMO_PKG = path.resolve(DEMO_DIR, 'package.json')
/** The fork's shared Instant version (`vX.Y.Z`). */
export const SHARED_VERSION_SRC = path.resolve(WORKSPACE_ROOT, '../version/src/version.ts')
/** Local npm cache, kept out of the user's global cache. */
export const NPM_CACHE = path.resolve(WORKSPACE_ROOT, '.npm-cache')
/** Gitignored scratch dir for release machinery (verify stamp, release state). */
export const STATE_DIR = path.resolve(WORKSPACE_ROOT, '.dux')
/** The published package's npm name. */
export const PKG_NAME = '@mszr/idb-dux'
