/**
 * The h3 **v1** adapter — maps the `IdbDuxServerAdapter` port onto `H3Event`
 * using h3 v1's utilities. This is the whole framework coupling for Nuxt 4 /
 * Nitro 2; the request lifecycle itself lives in `/server`.
 */
import type { H3Event } from 'h3'
import type { IdbDuxServerAdapter } from '../server/index.js'
import {
  createError,
  deleteCookie,
  getCookie,
  getHeader,
  readBody,
  readRawBody,
  setCookie,
  setResponseStatus,
} from 'h3'

export const h3v1Adapter: IdbDuxServerAdapter<H3Event> = {
  getCookie: (event, name) => getCookie(event, name),
  getHeader: (event, name) => getHeader(event, name),
  readJsonBody: <T>(event: H3Event): Promise<T> => readBody<T>(event),
  readRawText: async event => (await readRawBody(event, 'utf8')) ?? '',
  state: event => event.context as Record<string, unknown>,
  setCookie: (event, name, value, opts) => setCookie(event, name, value, opts),
  deleteCookie: (event, name, opts) => deleteCookie(event, name, opts),
  setStatus: (event, code) => setResponseStatus(event, code),
  httpError: (code, message) => createError({ statusCode: code, statusMessage: message }),
}
