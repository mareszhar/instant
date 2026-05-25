export function doSomething(secret: string) {
  return {
    length: secret.length,
    scope: 'app-only' as const,
  }
}
