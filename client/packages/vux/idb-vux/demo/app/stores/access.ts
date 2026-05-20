export const useAccess = defineStore('access', () => {
  const { db, auth } = useIdb()

  const userLabel = computed(() => userToLabel(auth.user))

  const form = reactive({
    email: '',
    magicCode: '',
    isMagicCodeRequested: false,
    isProcessing: false,
    feedback: useEphemeralFeedback(),
  })

  const signInAsGuest = () => executeFormAction(form, !!auth.user, db.auth.signInAsGuest)

  const requestMagicCode = () => executeFormAction(form, !form.email, async () => {
    form.isMagicCodeRequested = true
    await db.auth.sendMagicCode({ email: form.email })
  })

  const signInWithMagicCode = () => executeFormAction(form, !form.email || !form.magicCode, () =>
    db.auth.signInWithMagicCode({ email: form.email, code: form.magicCode }))

  const resetMagicCodeFlow = () => {
    form.magicCode = ''
    form.isMagicCodeRequested = false
    form.feedback = null
  }

  const signOut = async () => await db.auth.signOut()

  return {
    connectionStatus: db.useConnectionStatus(),
    localId: db.useLocalId('idb-vux-demo-device'),
    userLabel,
    form,
    signInAsGuest,
    requestMagicCode,
    signInWithMagicCode,
    resetMagicCodeFlow,
    signOut,
  }
})
