import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { preferences, usePreferences } from '@/preferences'
import { paragraphs } from './presentation'
import { chooseVoice } from './voice_choice'

/** Whether this browser can read aloud at all: no voice setting where it cannot. */
export const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

/**
 * Reads each new narration aloud with the browser's own speech synthesis —
 * nothing is sent anywhere. The player can mute it, from the game header or
 * the preferences: one preference, two ways to it.
 *
 * `narration` changes only when a new turn is recorded: the story already in
 * the journal is never read on opening the screen.
 */
export function useNarrationVoice(narration: string | null) {
  const { i18n } = useTranslation()
  const enabled = usePreferences().narrationVoice

  const setEnabled = useCallback((value: boolean) => preferences.setNarrationVoice(value), [])

  // Muted from wherever: what is being read stops at once.
  useEffect(() => {
    if (!enabled && voiceSupported) speechSynthesis.cancel()
  }, [enabled])

  // The narration is written in the game's language; until the front knows it, the interface's.
  const language = i18n.language

  useEffect(() => {
    // Read, not watched: turning the voice back on does not replay the last narration.
    if (!voiceSupported || !preferences.get().narrationVoice || !narration) return

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
  useEffect(() => () => void (voiceSupported && speechSynthesis.cancel()), [])

  return { supported: voiceSupported, enabled, setEnabled }
}
