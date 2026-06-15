import { InstantAPIError, InstantError } from '@instantdb/core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { IdbApiError, IdbError } from './errors.js'

describe('the IdbError family', () => {
  it('is the official error class, renamed — so instanceof reads branded', () => {
    expect(IdbError).toBe(InstantError)
    expect(IdbApiError).toBe(InstantAPIError)

    const err = new IdbError('boom')
    expect(err).toBeInstanceOf(IdbError)
    expect(err).toBeInstanceOf(Error)
  })

  it('treats the api error as an IdbError — one catch covers every dux error', () => {
    const apiErr = new IdbApiError({
      status: 404,
      body: { type: 'record-not-found', message: 'gone', hint: { 'record-type': 'tasks' } },
    })
    expect(apiErr).toBeInstanceOf(IdbApiError)
    expect(apiErr).toBeInstanceOf(IdbError)
  })

  it('extends the native Error at the type level', () => {
    expectTypeOf<IdbError>().toExtend<Error>()
  })
})
