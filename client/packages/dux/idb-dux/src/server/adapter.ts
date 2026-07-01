/**
 * `IdbDuxServerAdapter` — the port the framework-agnostic cores ([serverKit],
 * [authSync], [webhook]) operate through. A framework adapter (`/h3`, `/hono`,
 * `/elysia`) is the thin translation between one framework's per-request
 * object and these ~9 operations.
 *
 * The cores touch the request object **only** through this port — never its
 * fields — which is what keeps them generic over `Ctx` and what lets any other
 * framework (express, Fastify, …) gain the full server plane by supplying an
 * adapter ([dux-spec-server.md §3]).
 */
import type { IdbServerCookieOptions } from './cookies.js'

/**
 * The per-request operations an adapter maps onto its framework's request object.
 *
 * @typeParam Ctx - the framework's per-request object (`H3Event`, a Hono
 * `Context`, an Elysia `Context`, …). Opaque to the cores.
 */
export interface IdbDuxServerAdapter<Ctx> {
  /** Read a request cookie by name (`undefined` if absent). */
  getCookie: (ctx: Ctx, name: string) => string | undefined
  /** Read a request header by name, case-insensitive (`undefined` if absent). */
  getHeader: (ctx: Ctx, name: string) => string | undefined
  /** Parse the request body as JSON. Rejects on malformed input — the core maps that to 400. */
  readJsonBody: <T>(ctx: Ctx) => Promise<T>
  /** Read the request body as raw text — the exact bytes a webhook signature is computed over. */
  readRawText: (ctx: Ctx) => Promise<string>
  /**
   * A mutable per-request bag for memoization (one verification per request, a
   * cached `userDb`). Native where the framework has one (`event.context`),
   * a `WeakMap` keyed on the underlying web `Request` otherwise.
   */
  state: (ctx: Ctx) => Record<string, unknown>
  /** Write a response cookie. */
  setCookie: (ctx: Ctx, name: string, value: string, opts: IdbServerCookieOptions) => void
  /** Clear a response cookie (emits `Max-Age=0`). */
  deleteCookie: (ctx: Ctx, name: string, opts: IdbServerCookieOptions) => void
  /** Set the response status code. */
  setStatus: (ctx: Ctx, code: number) => void
  /** Build the framework's HTTP error (thrown by the core for a 401). */
  httpError: (code: number, message: string) => unknown
}
