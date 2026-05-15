interface FloatingTaskMenuState {
  openMenuId: Ref<string | null>
  floatingMenuElement: Ref<HTMLElement | null>
  floatingMenuStyle: Ref<Record<string, string>>
  setTriggerRef: (taskId: string, element: unknown) => void
  toggleMenu: (taskId: string) => Promise<void>
  closeMenu: () => void
  runTaskAction: (taskId: string, handler: () => Promise<void>) => Promise<void>
}

const VIEWPORT_PADDING = 8
const TRIGGER_GAP = 6
const DEFAULT_MENU_WIDTH = 180
const DEFAULT_MENU_HEIGHT = 96

export function useFloatingTaskMenu(): FloatingTaskMenuState {
  const openMenuId = ref<string | null>(null)
  const floatingMenuElement = ref<HTMLElement | null>(null)
  const floatingMenuStyle = ref<Record<string, string>>({})
  const triggerByTaskId = new Map<string, HTMLElement>()

  function setTriggerRef(taskId: string, element: unknown): void {
    if (element instanceof HTMLElement)
      triggerByTaskId.set(taskId, element)
    else
      triggerByTaskId.delete(taskId)
  }

  function clampPosition(value: number, min: number, max: number): number {
    if (max < min)
      return min

    return Math.min(Math.max(value, min), max)
  }

  function positionFloatingMenu(taskId: string): void {
    const trigger = triggerByTaskId.get(taskId)
    if (!trigger)
      return

    const triggerBounds = trigger.getBoundingClientRect()
    const menuWidth = floatingMenuElement.value?.offsetWidth ?? DEFAULT_MENU_WIDTH
    const menuHeight = floatingMenuElement.value?.offsetHeight ?? DEFAULT_MENU_HEIGHT
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const preferredLeft = triggerBounds.right - menuWidth
    const preferredTop = triggerBounds.bottom + TRIGGER_GAP

    const left = clampPosition(
      preferredLeft,
      VIEWPORT_PADDING,
      viewportWidth - menuWidth - VIEWPORT_PADDING,
    )

    const shouldOpenAbove = preferredTop + menuHeight > viewportHeight - VIEWPORT_PADDING
    const preferredTopAbove = triggerBounds.top - menuHeight - TRIGGER_GAP
    const top = shouldOpenAbove
      ? Math.max(VIEWPORT_PADDING, preferredTopAbove)
      : Math.min(preferredTop, viewportHeight - menuHeight - VIEWPORT_PADDING)

    floatingMenuStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
    }
  }

  async function toggleMenu(taskId: string): Promise<void> {
    if (openMenuId.value === taskId) {
      closeMenu()
      return
    }

    openMenuId.value = taskId
    await nextTick()
    positionFloatingMenu(taskId)
  }

  function closeMenu(): void {
    openMenuId.value = null
    floatingMenuStyle.value = {}
  }

  async function runTaskAction(
    taskId: string,
    handler: () => Promise<void>,
  ): Promise<void> {
    openMenuId.value = taskId
    await handler()
    closeMenu()
  }

  function onDocumentPointerDown(event: PointerEvent): void {
    if (!(event.target instanceof Element))
      return

    if (event.target.closest('.menu') || event.target.closest('.context-menu'))
      return

    closeMenu()
  }

  function onDocumentKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape')
      closeMenu()
  }

  function onWindowResize(): void {
    if (!openMenuId.value)
      return

    positionFloatingMenu(openMenuId.value)
  }

  useEventListener(document, 'pointerdown', onDocumentPointerDown)
  useEventListener(document, 'keydown', onDocumentKeyDown)
  useEventListener(document, 'scroll', closeMenu, { capture: true })
  useEventListener(window, 'resize', onWindowResize)

  return {
    openMenuId,
    floatingMenuElement,
    floatingMenuStyle,
    setTriggerRef,
    toggleMenu,
    closeMenu,
    runTaskAction,
  }
}
