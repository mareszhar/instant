export const useInstantStore = defineStore('instant', () => {
  const db = useDb()

  const { error: authError, isLoading: authIsLoading, user: authUser } = db.useAuth()
  const authUserEmail = computed(() => authUser.value?.email)
  const authUserId = computed(() => authUser.value?.id)
  const authUserImageURL = computed(() => authUser.value?.imageURL)
  const authUserIsGuest = computed(() => authUser.value?.isGuest)
  const authUserRefreshToken = computed(() => authUser.value?.refresh_token)
  const authUserType = computed(() => authUser.value?.type)

  const connectionStatus = db.useConnectionStatus()

  const localId = db.useLocalId('device-checking-idb-vux-demo')

  const appId = useRuntimeConfig().public.instantAppId ?? ''

  return {
    authError,
    authIsLoading,
    authUser,
    authUserEmail,
    authUserId,
    authUserImageURL,
    authUserIsGuest,
    authUserRefreshToken,
    authUserType,
    connectionStatus,
    localId,
    appId,
  }
})
