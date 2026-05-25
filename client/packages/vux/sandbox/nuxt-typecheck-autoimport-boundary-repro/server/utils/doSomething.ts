export function doSomething(secret: number) {
  return {
    quantity: secret.toFixed(2),
    scope: 'server-only' as const,
  }
}
