interface PreloadedQueryScopeSource<TItem> {
  items: () => TItem[] | undefined
  isLoading?: () => boolean
  errorMessage?: () => string
}

export function usePreloadedQueryScopes<TScope extends string, TItem>(
  sources: Record<TScope, PreloadedQueryScopeSource<TItem>>,
  activeScope: () => TScope,
) {
  const cachedByScope = ref<Partial<Record<TScope, TItem[]>>>({})
  const hasResolvedByScope = ref<Partial<Record<TScope, boolean>>>({})
  const scopes = Object.keys(sources) as TScope[]

  for (const scope of scopes) {
    watchEffect(() => {
      const source = sources[scope]
      const latestItems = source.items()
      if (latestItems && cachedByScope.value[scope] !== latestItems) {
        cachedByScope.value[scope] = latestItems
      }

      if (!source.isLoading?.() && !source.errorMessage?.() && !hasResolvedByScope.value[scope]) {
        hasResolvedByScope.value[scope] = true
      }
    })
  }

  function itemsFor(scope: TScope): TItem[] {
    return sources[scope].items() ?? cachedByScope.value[scope] ?? []
  }

  function isLoadingFor(scope: TScope): boolean {
    return sources[scope].isLoading?.() ?? false
  }

  function hasResolvedFor(scope: TScope): boolean {
    return hasResolvedByScope.value[scope] ?? false
  }

  function errorMessageFor(scope: TScope): string {
    return sources[scope].errorMessage?.() ?? ''
  }

  const scope = computed(() => activeScope())

  return {
    scope,
    items: computed(() => itemsFor(scope.value)),
    isLoading: computed(() => isLoadingFor(scope.value)),
    hasResolved: computed(() => hasResolvedFor(scope.value)),
    errorMessage: computed(() => errorMessageFor(scope.value)),
    itemsFor,
    isLoadingFor,
    hasResolvedFor,
    errorMessageFor,
  }
}
