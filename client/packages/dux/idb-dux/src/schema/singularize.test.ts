import { singularizations } from '@test'
import { describe, expect, it } from 'vitest'
import { singularize } from './singularize.js'

describe('singularize (runtime plane)', () => {
  it.each([...singularizations])('%s → %s', (plural, singular) => {
    expect(singularize(plural)).toBe(singular)
  })
})
