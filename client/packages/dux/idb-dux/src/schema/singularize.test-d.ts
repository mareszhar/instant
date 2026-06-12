import type { singularizations } from '@test'
import type { Singularize } from './singularize.js'
import { describe, expectTypeOf, it } from 'vitest'

/**
 * Maps every fixture pair through the type plane. A wrong entry resolves to a
 * readable failure string instead of `true`, so the assertion below names the
 * exact word that diverged from the runtime plane.
 */
type Equivalence<List extends readonly (readonly [string, string])[]> = {
  [K in keyof List]: Singularize<List[K][0]> extends List[K][1]
    ? List[K][1] extends Singularize<List[K][0]>
      ? true
      : `MISMATCH: Singularize<'${List[K][0]}'> = '${Singularize<List[K][0]>}', runtime says '${List[K][1]}'`
    : `MISMATCH: Singularize<'${List[K][0]}'> = '${Singularize<List[K][0]>}', runtime says '${List[K][1]}'`
}

describe('singularize (type plane)', () => {
  it('matches the runtime plane across the shared word list', () => {
    expectTypeOf<Equivalence<typeof singularizations>[number]>().toEqualTypeOf<true>()
  })
})
