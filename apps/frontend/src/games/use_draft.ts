import { useCallback, useState } from 'react'

const keyOf = (gameId: string) => `wanderlore.draft.${gameId}`

/**
 * The action being typed, kept per game in the browser: a reload, an expired
 * session or leaving the screen never loses it (front spec, principle 5). The
 * only thing the front keeps in storage — never a token.
 */
export function useDraft(gameId: string) {
  const [draft, setDraftState] = useState(() => {
    try {
      return localStorage.getItem(keyOf(gameId)) ?? ''
    } catch {
      return ''
    }
  })

  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value)
      try {
        if (value) localStorage.setItem(keyOf(gameId), value)
        else localStorage.removeItem(keyOf(gameId))
      } catch {
        // Blocked storage: the draft then lasts as long as the screen.
      }
    },
    [gameId]
  )

  return [draft, setDraft] as const
}
