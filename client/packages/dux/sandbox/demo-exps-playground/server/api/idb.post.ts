export default defineAuthSyncHandler({
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
})
