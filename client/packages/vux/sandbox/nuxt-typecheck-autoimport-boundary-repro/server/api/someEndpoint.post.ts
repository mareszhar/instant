export default defineEventHandler(() => {
  // no linter warnings here
  // linter correctly infers `doSomething` in the shape of the server util, not the app util with the same name
  const result = doSomething(10)
  return { quantity: result.quantity }
})
