import { createInstantRouteHandler } from '@mszr/idb-vux'
import {
  createError,
  getRequestHeaders,
  getRequestURL,
  readRawBody,
} from 'h3'

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const appId = runtimeConfig.public.instantAppId

  if (!appId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing public runtime config: instantAppId',
    })
  }

  const routeHandler = createInstantRouteHandler({ appId })
  const body = await readRawBody(event)
  const headers = new Headers()

  for (const [key, value] of Object.entries(getRequestHeaders(event))) {
    if (typeof value === 'string') {
      headers.set(key, value)
    }
  }

  const request = new Request(getRequestURL(event), {
    method: 'POST',
    headers,
    body: body ?? undefined,
  })

  return routeHandler.POST(request)
})
