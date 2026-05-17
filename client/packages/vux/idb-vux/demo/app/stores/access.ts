export const useAccessStore = defineStore('access', () => {
  const db = useDb()
  const proxySafeDb = markRaw(db)

  const { state: auth } = db.useAuthX()
  const connectionStatus = db.useConnectionStatus()
  const localId = db.useLocalId('idb-vux-demo-device')
  const appId = useRuntimeConfig().public.instantAppId ?? ''

  const userLabel = computed(() => {
    return auth.user
      ? (auth.user.email ?? `Guest-${auth.user.id.slice(-6)}`)
      : ''
  })

  const form = reactive({
    email: '',
    magicCode: '',
    isMagicCodeRequested: false,
    isProcessing: false,
    feedback: null as Feedback | null,
  })

  async function authenticate({ shouldNotRun, action }: { shouldNotRun?: () => boolean, action: () => Promise<unknown> }) {
    if (form.isProcessing || shouldNotRun?.())
      return
    form.isProcessing = true
    form.feedback = null
    const [error] = await go(action())
    if (error)
      form.feedback = { tone: 'danger', text: formatError(error) }
    form.isProcessing = false
  }

  const signInAsGuest = async () => await authenticate({ action: db.auth.signInAsGuest })

  const requestMagicCode = async () => await authenticate({
    shouldNotRun: () => form.isProcessing || !form.email,
    action: async () => {
      form.isMagicCodeRequested = true
      await db.auth.sendMagicCode({ email: form.email })
    },
  })

  const confirmMagicCode = async () => await authenticate({
    shouldNotRun: () => form.isProcessing || !form.email || !form.magicCode,
    action: () => db.auth.signInWithMagicCode({ email: form.email, code: form.magicCode }),
  })

  function resetMagicCodeFlow() {
    form.magicCode = ''
    form.isMagicCodeRequested = false
    form.feedback = { tone: 'info', text: '' }
  }

  const signOut = async () => await db.auth.signOut()

  return {
    proxySafeDb,
    auth,
    connectionStatus,
    localId,
    appId,
    userLabel,
    form,
    signInAsGuest,
    requestMagicCode,
    confirmMagicCode,
    resetMagicCodeFlow,
    signOut,
  }
})
