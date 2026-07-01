/**
 * The h3 v2 adapter — maps the `IdbDuxServerAdapter` port onto `H3Event`
 * using h3 v2's web-standard event shape. This is the whole framework coupling
 * for standalone h3, Nitro 3 / Nuxt 5, and h3-dux.
 */
import type { H3Event } from 'h3'
import type { IdbDuxServerAdapter } from '../server/index.js'
import { deleteCookie, getCookie, HTTPError, setCookie } from 'h3'

export const h3Adapter: IdbDuxServerAdapter<H3Event> = {
  getCookie: (event, name) => getCookie(event, name),
  getHeader: (event, name) => event.req.headers.get(name) ?? undefined,
  readJsonBody: <T>(event: H3Event): Promise<T> => event.req.json() as Promise<T>,
  readRawText: event => event.req.text(),
  state: event => event.context as Record<string, unknown>,
  setCookie: (event, name, value, opts) => setCookie(event, name, value, opts),
  deleteCookie: (event, name, opts) => deleteCookie(event, name, opts),
  setStatus: (event, code) => {
    event.res.status = code
  },
  httpError: (code, message) => HTTPError.status(code, message),
}
