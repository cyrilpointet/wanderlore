import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { paragraphs } from './presentation'
import { chooseVoice } from './voice_choice'

const STORAGE_KEY = 'wanderlore.narrationVoice'

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

/**
 * Reads each new narration aloud with the browser's own speech synthesis —
 * nothing is sent anywhere. The player can mute it; the choice is kept in the
 * browser.
 *
 * `narration` changes only when a new turn is recorded: the story already in
 * the journal is never read on opening the screen.
 */
export function useNarrationVoice(narration: string | null) {
  const { i18n } = useTranslation()
  const [enabled, setEnabledState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off'
    } catch {
      return true
    }
  })

  // Read, not watched: turning the voice back on does not replay the last narration.
  const enabledRef = useRef(enabled)

  const setEnabled = useCallback((value: boolean) => {
    enabledRef.current = value
    setEnabledState(value)
    if (!value && supported) speechSynthesis.cancel()
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off')
    } catch {
      // Blocked storage: the choice then lasts as long as the screen.
    }
  }, [])

  // The narration is written in the game's language; until the front knows it, the interface's.
  const language = i18n.language

  useEffect(() => {
    if (!supported || !enabledRef.current || !narration) return

    speechSynthesis.cancel()
    // Chosen at each narration: the browser loads its voices lazily.
    const voice = chooseVoice(speechSynthesis.getVoices(), language)
    // One utterance per paragraph: Chrome cuts a long utterance off after about fifteen seconds.
    for (const paragraph of paragraphs(narration)) {
      const utterance = new SpeechSynthesisUtterance(paragraph)
      utterance.lang = voice?.lang ?? language
      utterance.voice = voice
      speechSynthesis.speak(utterance)
    }
  }, [narration, language])

  // Leaving the screen silences it.
  useEffect(() => () => void (supported && speechSynthesis.cancel()), [])

  return { supported, enabled, setEnabled }
}
