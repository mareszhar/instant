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

    // EXPECTED BEHAVIOR:
    const fruits = fruitsByName[fruitName] // ✅ CORRECT! (fruitName matches the generic)
    const apples = fruitsByName.apple // ✅ CORRECT!
    const bananas = fruitsByName.banana // ✅ CORRECT!
    const oranges = fruitsByName.orange // ✅ CORRECT!
    const mangos = fruitsByName.mango // ❌ error - 'mango' is not in the generic! ✅ CORRECT!

    apples?.forEach(() => { console.warn('doctor shoooo') })

    return { fruits, apples, bananas, oranges, mangos }
  }

  return { createFruit, getFruits }
})
