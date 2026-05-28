export const useRoom = defineStore('room', () => {
  const { db } = useIdb()
  const access = useAccess()
  const workspaces = useWorkspaces()
  const current = db.room('workspace', () => workspaces.current?.id)
  const reactions = ref<{ id: string, emoji: string, sender: string }[]>([])
  const { state: presence } = db.rooms.usePresenceX(current, {
    initialPresence: { name: access.userLabel },
    keys: ['name'],
  })
  const peers = computed(() => Object.entries(presence.peers))
  const publishReaction = db.rooms.usePublishTopic(current, 'reaction')

  db.rooms.useTopicEffect(current, 'reaction', (event, peer) => {
    reactions.value.unshift({
      id: id(),
      emoji: event.emoji,
      sender: peer.name,
    })

    if (reactions.value.length > 10)
      reactions.value = reactions.value.slice(0, 10)
  })

  const typedText = ref('')
  const { active: peersTyping, state: typingIndicator } = db.rooms.useTypingIndicatorX(current, 'typing', {
    stopOnEnter: true,
  })

  const handleTypingKeydown = (event: KeyboardEvent) => {
    typingIndicator.inputProps.onKeydown(event)

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      typedText.value = ''
    }
  }

  const handleTypingBlur = () => {
    typingIndicator.inputProps.onBlur()
  }

  return {
    current,
    reactions,
    presence,
    peers,
    publishReaction,
    typedText,
    peersTyping,
    typingIndicator,
    handleTypingKeydown,
    handleTypingBlur,
  }
})
