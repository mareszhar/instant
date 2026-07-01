/**
 * The Elysia adapter — maps the `IdbDuxServerAdapter` port onto an Elysia
 * `Context`. The request lifecycle itself lives in `/server`; this is the whole
 * Elysia coupling.
 *
 * One Elysia specific: it parses the body eagerly, so the webhook route must
 * opt into raw text (`{ parse: 'text' }`) for `readRawText` to see the exact
 * signature bytes ([dux-spec-server.md §6]).
 */
import type { Context } from 'elysia'
import type { IdbDuxServerAdapter } from '../server/index.js'
import { status } from 'elysia'

/**
 * Per-request state, keyed on the underlying web `Request`. Elysia's `store` is
 * process-global, so this `WeakMap` is the per-request substrate for the kit's
 * one-verification-per-request caching.
 */
const states = new WeakMap<Request, Record<string, unknown>>()

export const elysiaAdapter: IdbDuxServerAdapter<Context> = {
  getCookie: (ctx, name) => {
    const value = ctx.cookie[name]?.value
    return typeof value === 'string' ? value : undefined
  },
  getHeader: (ctx, name) => ctx.request.headers.get(name) ?? undefined,
  // Elysia has already parsed the body into `ctx.body` by the time a handler runs.
  readJsonBody: <T>(ctx: Context): Promise<T> => Promise.resolve(ctx.body as T),
  readRawText: ctx => Promise.resolve(typeof ctx.body === 'string' ? ctx.body : ''),
  state: (ctx) => {
    let bag = states.get(ctx.request)
    if (!bag)
      states.set(ctx.request, (bag = {}))
    return bag
  },
  setCookie: (ctx, name, value, opts) => {
    ctx.cookie[name]?.set({
      value,
      path: opts.path,
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      maxAge: opts.maxAge,
      ...(opts.domain ? { domain: opts.domain } : {}),
    })
  },
  deleteCookie: (ctx, name, opts) => {
    // Elysia's `.remove()` is a no-op when the cookie isn't already on the
    // request, so set an expired cookie explicitly — that always emits a
    // clearing `Set-Cookie`, matching the other adapters.
    ctx.cookie[name]?.set({
      value: '',
      path: opts.path,
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      maxAge: 0,
      expires: new Date(0),
      ...(opts.domain ? { domain: opts.domain } : {}),
    })
  },
  setStatus: (ctx, code) => {
    ctx.set.status = code
  },
  httpError: (code, message) => status(code, message),
}
