import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Close enough to the end to count as reading the latest entry. */
const THRESHOLD = 48

/**
 * Keeps a scrolling journal on its latest entry — unless the player scrolled
 * up to read the history, in which case it flags that something new arrived
 * instead of pulling them down (front spec, section 5.3.2).
 *
 * `contentKey` changes whenever an entry is added or grows.
 */
export function useStickToBottom<T extends HTMLElement>(contentKey: unknown) {
  const ref = useRef<T>(null)
  const atBottom = useRef(true)
  const [hasNew, setHasNew] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const onScroll = () => {
      atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < THRESHOLD
      if (atBottom.current) setHasNew(false)
    }

    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [])

  // Before paint, so opening a game shows its last entry without a visible jump.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    if (atBottom.current) element.scrollTop = element.scrollHeight
    else setHasNew(true)
  }, [contentKey])

  const scrollToBottom = useCallback(() => {
    const element = ref.current
    if (!element) return

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollTo({ top: element.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
    setHasNew(false)
  }, [])

  return { ref, hasNew, scrollToBottom }
}
