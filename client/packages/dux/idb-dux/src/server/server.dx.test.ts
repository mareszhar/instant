/**
 * Editor-DX plane for `/server` and the shipped server adapters. Runtime
 * conformance proves the request lifecycle; these snippets prove the call sites
 * feel typed: BYO-adapter keys complete, adapter configs context-type their
 * event, kit modes shape the result, and schema-aware admin/webhook authoring
 * survives the adapter subpaths.
 */
import { cursor } from '@mszr/selenita'
import { duxProject, registration } from '@test'
import { describe, expect, it } from 'vitest'

const project = duxProject()

const corePrelude = `
${registration}
import type { IdbDuxServerAdapter } from '@mszr/idb-dux/server'
import { createAuthSyncHandler, createServerKit } from '@mszr/idb-dux/server'

interface Ctx {
  request: Request
  state: Record<string, unknown>
}

const adapter: IdbDuxServerAdapter<Ctx> = {
  getCookie: () => undefined,
  getHeader: () => undefined,
  readJsonBody: async <T>() => ({}) as T,
  readRawText: async () => '',
  state: ctx => ctx.state,
  setCookie: () => {},
  deleteCookie: () => {},
  setStatus: () => {},
  httpError: (_code, message) => new Error(message),
}

declare const ctx: Ctx
`

const adapterCases = [
  {
    name: 'h3-v1',
    entrypoint: '@mszr/idb-dux/h3-v1',
    ctxImport: `import type { H3Event } from 'h3'`,
    ctxType: 'H3Event',
    ctxCompletions: ['context', 'node'],
  },
  {
    name: 'hono',
    entrypoint: '@mszr/idb-dux/hono',
    ctxImport: `import type { Context } from 'hono'`,
    ctxType: 'Context',
    ctxCompletions: ['req', 'json', 'status'],
  },
  {
    name: 'elysia',
    entrypoint: '@mszr/idb-dux/elysia',
    ctxImport: `import type { Context } from 'elysia'`,
    ctxType: 'Context',
    ctxCompletions: ['request', 'cookie', 'set'],
  },
] as const

function adapterPrelude(entrypoint: string, ctxImport: string, ctxType: string) {
  return `
${registration}
import {
  defineAuthSyncHandler,
  defineServerKit,
  defineWebhookHandler,
} from '${entrypoint}'
import { defineWebhookHandlers } from '@mszr/idb-dux/webhooks'
${ctxImport}

declare const ctx: ${ctxType}
const useKit = defineServerKit({
  schema,
  getAppId: () => 'app',
  getAdminToken: () => 'tok',
})
`
}

describe('/server core — editor DX for bring-your-own adapters', () => {
  it('completes the full adapter port when authoring an adapter object', () => {
    const { completions } = project.query`
      ${registration}
      import type { IdbDuxServerAdapter } from '@mszr/idb-dux/server'

      interface Ctx { request: Request }
      const adapter: IdbDuxServerAdapter<Ctx> = { ${cursor} }
    `
    expect(completions).toContainCompletions([
      'getCookie',
      'getHeader',
      'readJsonBody',
      'readRawText',
      'state',
      'setCookie',
      'deleteCookie',
      'setStatus',
      'httpError',
    ])
  })

  it('completes server-kit config and the custom token resolver reader', () => {
    const result = project.query`
      ${corePrelude}
      createServerKit(adapter, { ${cursor('config')} })
      createServerKit(adapter, {
        schema,
        getAppId: () => 'app',
        getAdminToken: () => 'tok',
        tokenFrom: req => req.${cursor('reader')}
      })
    `

    expect(result.at('config').completions).toContainCompletions([
      'schema',
      'getAppId',
      'getAdminToken',
      'tokenFrom',
      'apiURI',
    ])
    expect(result.at('reader').completions).toContainCompletions([
      'appId',
      'cookie',
      'header',
    ])
  })

  it('keeps the core kit schema-aware for admin queries', () => {
    const { completions } = project.query`
      ${corePrelude}
      const useKit = createServerKit(adapter, {
        schema,
        getAppId: () => 'app',
        getAdminToken: () => 'tok',
      })
      async function route() {
        const { adminDb } = await useKit(ctx)
        adminDb.query({ ${cursor} })
      }
    `
    expect(completions).toContainCompletions(['workspaces', 'tasks', '$users'])
  })

  it('contextual-types auth-sync persistence callbacks to the adapter context', () => {
    const { completions } = project.query`
      ${corePrelude}
      createAuthSyncHandler(adapter, {
        getAppId: () => 'app',
        persistToken: (_token, event) => { event.${cursor} },
      })
    `
    expect(completions).toContainCompletions(['request', 'state'])
  })
})

describe.each(adapterCases)('$name adapter — editor DX', (adapterCase) => {
  it('contextual-types lazy config callbacks to the framework request object', () => {
    const { completions } = project.query`
      ${adapterPrelude(adapterCase.entrypoint, adapterCase.ctxImport, adapterCase.ctxType)}
      defineServerKit({
        schema,
        getAppId: event => {
          event.${cursor}
          return 'app'
        },
        getAdminToken: () => 'tok',
      })
    `
    expect(completions).toContainCompletions([...adapterCase.ctxCompletions])
  })

  it('shapes kit modes', () => {
    const result = project.query`
      ${adapterPrelude(adapterCase.entrypoint, adapterCase.ctxImport, adapterCase.ctxType)}
      async function route() {
        const required = await useKit(ctx, 'userDb')
        required.${cursor('required')}

        const anonymous = await useKit(ctx)
        anonymous.${cursor('anonymous')}
      }
    `
    expect(result.at('required').completions).toContainCompletions([
      'adminDb',
      'user',
      'userDb',
    ])
    expect(result.at('anonymous').completions).toContainCompletion('adminDb')
    expect(result.at('anonymous').completions).not.toContainCompletion('user')
  })

  it('carries schema-aware admin query completions', () => {
    const { completions } = project.query`
      ${adapterPrelude(adapterCase.entrypoint, adapterCase.ctxImport, adapterCase.ctxType)}
      async function route() {
        const { adminDb } = await useKit(ctx)
        adminDb.query({ ${cursor} })
      }
    `
    expect(completions).toContainCompletions([
      'workspaces',
      'tasks',
      '$users',
    ])
  })

  it('flags user access when the route did not ask for a user mode', () => {
    const { errors } = project.check`
      ${adapterPrelude(adapterCase.entrypoint, adapterCase.ctxImport, adapterCase.ctxType)}
      async function route() {
        const kit = await useKit(ctx)
        kit.user
      }
    `
    expect(errors).toHaveError(/Property 'user' does not exist/)
  })

  it('completes auth-sync config and cookie options', () => {
    const result = project.query`
      ${adapterPrelude(adapterCase.entrypoint, adapterCase.ctxImport, adapterCase.ctxType)}
      defineAuthSyncHandler({ ${cursor('config')} })
      defineAuthSyncHandler({
        getAppId: () => 'app',
        cookie: { ${cursor('cookie')} },
      })
    `
    expect(result.at('config').completions).toContainCompletions([
      'getAppId',
      'cookieName',
      'cookie',
      'persistToken',
    ])
    expect(result.at('cookie').completions).toContainCompletions([
      'path',
      'httpOnly',
      'secure',
      'sameSite',
      'maxAge',
      'domain',
    ])
  })

  it('keeps webhook handlers schema-narrowed through the adapter route helper', () => {
    const { completions } = project.query`
      ${adapterPrelude(adapterCase.entrypoint, adapterCase.ctxImport, adapterCase.ctxType)}
      defineWebhookHandler(defineWebhookHandlers({
        tasks: {
          create: ({ after }) => { after.${cursor} },
        },
      }))
    `
    expect(completions).toContainCompletions([
      'id',
      'title',
      'isDone',
      'createdAt',
      'notes',
      'meta',
    ])
  })
})
