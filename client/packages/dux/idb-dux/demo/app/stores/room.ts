export const useRoom = defineStore('room', () => {
  const { db } = useIdb()
  const access = useAccess()
  const workspaces = useWorkspaces()
  const current = db.room('workspace', () => workspaces.current?.id)
  const reactions = ref<{ id: string, emoji: string, sender: string }[]>([])
  const { state: presence } = db.rooms.usePresence(current, { keys: ['name'] })
  // Publish our name reactively. `initialPresence` only applies on the first
  // join, so a tab that joins before auth resolves would broadcast a stale
  // name forever; `useSyncPresence` re-publishes whenever `userLabel` changes.
  db.rooms.useSyncPresence(current, () => ({ name: access.userLabel }))
  const peers = computed(() => Object.entries(presence.peers))
  const publishReaction = db.rooms.usePublishTopic(current, 'reaction')

  db.rooms.useTopicEffect(current, 'reaction', (event, peer) => {
    reactions.value.unshift({
      id: id(),
      emoji: event.emoji,
      sender: peer.name || 'Anonymous',
    })

    if (reactions.value.length > 10)
      reactions.value = reactions.value.slice(0, 10)
  })

  const typedText = ref('')
  const typing = db.rooms.useTypingIndicator(current, 'typing', {
    stopOnEnter: true,
  })
  const peersTyping = typing.active

  const handleTypingKeydown = (event: KeyboardEvent) => {
    typing.inputProps.onKeydown(event)

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      typedText.value = ''
    }
  }

  const handleTypingBlur = () => {
    typing.inputProps.onBlur()
  }

  return {
    current,
    reactions,
    presence,
    peers,
    publishReaction,
    typedText,
    peersTyping,
    handleTypingKeydown,
    handleTypingBlur,
  }
})
