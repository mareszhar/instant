import type { Placement } from '@floating-ui/vue'
import { autoUpdate, flip, offset as floatingOffset, shift, useFloating } from '@floating-ui/vue'

interface ContextMenuOptions { offset?: number, padding?: number, placement?: Placement }

export function useContextMenu<Key = string>(options: ContextMenuOptions = {}) {
  const { offset = 6, padding = 8, placement = 'bottom-end' } = options

  const activeAnchorId = ref<Key | null>(null)
  const activeAnchorElement = shallowRef<HTMLElement | null>(null)
  const activeFloatingElement = shallowRef<HTMLElement | null>(null)
  const anchorElementsById = new Map<Key, HTMLElement>()

  const { floatingStyles } = useFloating(activeAnchorElement, activeFloatingElement, {
    open: computed(() => activeAnchorId.value !== null && !!activeAnchorElement.value && !!activeFloatingElement.value),
    placement,
    strategy: 'fixed',
    middleware: [floatingOffset(offset), flip({ padding }), shift({ padding })],
    whileElementsMounted: autoUpdate,
  })

  const setAnchorElement = (anchorId: Key, element: unknown) => {
    if (element instanceof HTMLElement)
      anchorElementsById.set(anchorId, element)
    else
      anchorElementsById.delete(anchorId)
  }

  const setFloatingElement = (element: unknown) => {
    activeFloatingElement.value = element instanceof HTMLElement ? element : null
  }

  const close = () => {
    activeAnchorId.value = null
    activeAnchorElement.value = null
  }

  const toggle = (anchorId: Key) => {
    if (activeAnchorId.value === anchorId)
      return close()

    activeAnchorElement.value = anchorElementsById.get(anchorId) ?? null
    activeAnchorId.value = activeAnchorElement.value ? anchorId : null
  }

  const run = async <Result>(action: () => Result | Promise<Result>) => {
    const [, result] = await go(action)
    close()
    return result
  }

  onClickOutside(activeFloatingElement, close, { ignore: [activeAnchorElement] })
  onKeyStroke('Escape', close)

  return reactive({
    activeAnchorId,
    floatingStyles,
    setAnchorElement,
    setFloatingElement,
    close,
    toggle,
    run,
  })
}
