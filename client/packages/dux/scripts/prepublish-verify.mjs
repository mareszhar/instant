#!/usr/bin/env node

/**
 * `pnpm run prepublish:verify` — the shared gate, on its own.
 *
 * Runs the common verification (build · lint · typecheck · test · drift) every
 * publish path depends on. The publish scripts call this same gate internally;
 * exposing it standalone makes "everything is verified before it ships" legible
 * and gives the maintainer a fast "is the tree releasable?" check.
 */
import { verify } from './lib/verify.mjs'

verify()
