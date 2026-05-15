interface ReactionEvent {
  id: string
  emoji: string
  sender: string
}

function createEventId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function useWorkspaceRealtime(
  workspaceId: string,
  userLabel: Readonly<Ref<string>>,
) {
  const db = useDb()

  const room = db
    ? db.room('workspace', workspaceId)
    : null

  const reactions = ref<ReactionEvent[]>([])
  const typingDraft = ref('')

  const presencePayload = reactive({
    name: 'Anonymous',
  })

  watchEffect(() => {
    presencePayload.name = userLabel.value || 'Anonymous'
  })

  if (db && room) {
    db.rooms.useSyncPresence(room, presencePayload)
  }

  const presence = room
    ? db?.rooms.usePresence(room, {
        keys: ['name'],
      })
    : null

  const publishReaction = room ? db?.rooms.usePublishTopic(room, 'reaction') : null

  if (db && room) {
    db.rooms.useTopicEffect(room, 'reaction', (event, peer) => {
      reactions.value.unshift({
        id: createEventId(),
        emoji: event.emoji,
        sender: peer?.name ?? 'Anonymous',
      })

      if (reactions.value.length > 10)
        reactions.value = reactions.value.slice(0, 10)
    })
  }

  const typing = room
    ? db?.rooms.useTypingIndicator(room, 'typing', {
        stopOnEnter: true,
      })
    : null

  const presencePeers = computed(() => {
    return Object.entries(presence?.peers ?? {})
  })

  const typingIndicatorText = computed(() => {
    const activePeers = (typing?.active ?? []).filter((peer) => {
      return (peer?.name ?? '') !== (userLabel.value ?? '')
    })
    if (activePeers.length === 0)
      return ''

    if (activePeers.length === 1)
      return `${activePeers[0]?.name ?? 'Someone'} is typing...`

    if (activePeers.length === 2) {
      return `${activePeers[0]?.name ?? 'Someone'} and ${activePeers[1]?.name ?? 'someone'} are typing...`
    }

    return `${activePeers[0]?.name ?? 'Someone'} and ${activePeers.length - 1} others are typing...`
  })

  function sendReaction(emoji: string) {
    publishReaction?.({ emoji })
  }

  function handleTypingKeydown(event: KeyboardEvent) {
    typing?.inputProps.onKeyDown(event)

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      typingDraft.value = ''
    }
  }

  function handleTypingBlur() {
    typing?.inputProps.onBlur()
  }

  return reactive({
    room,
    presencePeers,
    reactions,
    typingDraft,
    typingIndicatorText,

    sendReaction,
    handleTypingKeydown,
    handleTypingBlur,
  })
}
