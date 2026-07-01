/**
 * The Hono adapter — maps the `IdbDuxServerAdapter` port onto a Hono `Context`.
 * The request lifecycle itself lives in `/server`; this is the whole Hono
 * coupling.
 */
import type { Context } from 'hono'
import type { IdbDuxServerAdapter } from '../server/index.js'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'

/**
 * Per-request state, keyed on the underlying web `Request`. Hono has no
 * untyped per-request bag, so this `WeakMap` is the portable substrate for the
 * kit's one-verification-per-request caching.
 */
const states = new WeakMap<Request, Record<string, unknown>>()

export const honoAdapter: IdbDuxServerAdapter<Context> = {
  getCookie: (c, name) => getCookie(c, name),
  getHeader: (c, name) => c.req.header(name),
  readJsonBody: <T>(c: Context): Promise<T> => c.req.json() as Promise<T>,
  readRawText: c => c.req.text(),
  state: (c) => {
    const req = c.req.raw
    let bag = states.get(req)
    if (!bag)
      states.set(req, (bag = {}))
    return bag
  },
  setCookie: (c, name, value, opts) => setCookie(c, name, value, opts),
  deleteCookie: (c, name, opts) => {
    deleteCookie(c, name, opts)
  },
  setStatus: (c, code) => c.status(code as Parameters<Context['status']>[0]),
  httpError: (code, message) =>
    new HTTPException(code as ConstructorParameters<typeof HTTPException>[0], { message }),
}
