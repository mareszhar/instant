export const useSandbox = defineStore('sandbox', () => {
  const { db } = useIdb()

  function createFruit() {
    db.tx.fruits[id()]!.create({
      name: 'banana', // only allows strings that match our schema generic!
    })
  }

  async function getFruits(fruitName: 'apple' | 'banana' | 'orange') {
    const { fruitsByName } = await db.queryOnce({
      fruits: {
        $m: {
          fruitsByName: { groupBy: 'name' },
        },
      },
    })

    // The record is keyed by the runtime-enum union, each bucket narrowed to its
    // key and guaranteed to be an array (empty if no rows) — never undefined.
    const fruits = fruitsByName[fruitName] // ✅ Fruit[] (fruitName ∈ the union)
    const apples = fruitsByName.apple // ✅ { id; name: 'apple' }[]
    const bananas = fruitsByName.banana // ✅ { id; name: 'banana' }[]
    const oranges = fruitsByName.orange // ✅ { id; name: 'orange' }[]
    // @ts-expect-error 'mango' is not one of the enum's declared values
    const mangos = fruitsByName.mango // ✅ flagged at the key

    // no `?.` needed — a runtime-enum bucket is never undefined
    apples.forEach(() => console.warn('doctor shoooo'))

    return { fruits, apples, bananas, oranges, mangos }
  }

  return { createFruit, getFruits }
})
