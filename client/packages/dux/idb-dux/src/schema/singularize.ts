/**
 * The default English singularization algorithm, shipped twice from one rule
 * set: `singularize` (runtime) and `Singularize<>` (type space). The two must
 * never disagree — their equivalence is locked by a word-list test that runs
 * both planes over the same fixtures.
 *
 * The algorithm is deliberately small and predictable: a short irregulars
 * table plus ordered suffix rules. Anything it gets wrong is declared
 * explicitly in the schema (`singular` on a namespace or link label), which
 * always wins over the algorithm.
 */

/** Words the suffix rules would mangle. One source for both planes. */
const IRREGULARS = {
  people: 'person',
  children: 'child',
  men: 'man',
  women: 'woman',
  feet: 'foot',
  teeth: 'tooth',
  geese: 'goose',
  mice: 'mouse',
  movies: 'movie',
  cookies: 'cookie',
  caches: 'cache',
  statuses: 'status',
  buses: 'bus',
  quizzes: 'quiz',
  heroes: 'hero',
} as const satisfies Record<string, string>

type Irregulars = typeof IRREGULARS

/**
 * The ordered rules, in type space. Mirrors `singularize` exactly:
 *
 * 1. irregulars table
 * 2. `…ies` → `…y` (stems of 2+ chars only, so `ties` → `tie`, not `ty`)
 * 3. `…sses` / `…zzes` / `…ches` / `…shes` / `…xes` → strip `es`
 * 4. `…ss` → unchanged (`class` is already singular)
 * 5. `…s` → strip `s`
 * 6. anything else → unchanged
 */
export type Singularize<Word extends string> = Word extends keyof Irregulars
  ? Irregulars[Word]
  : Word extends `${infer C1}${infer C2}${infer Rest}ies`
    ? `${C1}${C2}${Rest}y`
    : Word extends `${infer Stem}sses` ? `${Stem}ss`
      : Word extends `${infer Stem}zzes` ? `${Stem}zz`
        : Word extends `${infer Stem}ches` ? `${Stem}ch`
          : Word extends `${infer Stem}shes` ? `${Stem}sh`
            : Word extends `${infer Stem}xes` ? `${Stem}x`
              : Word extends `${string}ss` ? Word
                : Word extends `${infer Stem}s` ? Stem
                  : Word

/** The same ordered rules, at runtime. Mirrors `Singularize<>` exactly. */
export function singularize(word: string): string {
  if (word in IRREGULARS)
    return IRREGULARS[word as keyof Irregulars]
  if (word.endsWith('ies') && word.length >= 5)
    return `${word.slice(0, -3)}y`
  if (/(?:ss|zz|ch|sh|x)es$/.test(word))
    return word.slice(0, -2)
  if (word.endsWith('ss'))
    return word
  if (word.endsWith('s'))
    return word.slice(0, -1)
  return word
}
