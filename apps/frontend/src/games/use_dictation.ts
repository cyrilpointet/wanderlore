import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** The slice of the Web Speech API used here: TypeScript's DOM library does not declare it. */
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

const RecognitionClass: (new () => Recognition) | undefined =
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as Record<string, new () => Recognition>).SpeechRecognition ??
      (window as unknown as Record<string, new () => Recognition>).webkitSpeechRecognition)

/** The failures worth telling apart; any other one reads as a generic failure. */
export const DICTATION_ERRORS = ['not-allowed', 'no-speech', 'audio-capture', 'network'] as const
export type DictationError = (typeof DICTATION_ERRORS)[number] | 'generic'

/**
 * Dictates the player's action with the browser's own speech recognition.
 * What is heard is appended to the text already in the field, live, then
 * stays there to be read over and sent like any typed action: dictation
 * never sends anything by itself.
 *
 * One phrase at a time (`continuous: false`): Chrome on Android repeats its
 * results in continuous mode. The player taps again to go on.
 */
export function useDictation({
  value,
  onChange,
  maxLength,
}: {
  value: string
  onChange: (value: string) => void
  maxLength: number
}) {
  const { i18n } = useTranslation()
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<DictationError | null>(null)
  const recognition = useRef<Recognition | null>(null)

  // Read when a result arrives, not captured when dictation started.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  /** Stops listening, keeping what was said up to now. */
  const stop = useCallback(() => {
    recognition.current?.stop()
  }, [])

  /**
   * Stops listening and drops anything not yet heard: once the text is sent
   * or typed over, a late result must not write into the field again.
   */
  const cancel = useCallback(() => {
    const instance = recognition.current
    if (!instance) return
    instance.onresult = null
    instance.abort()
  }, [])

  const start = useCallback(() => {
    if (!RecognitionClass || recognition.current) return
    // The microphone would hear the narration being read aloud.
    if ('speechSynthesis' in window) speechSynthesis.cancel()

    const instance = new RecognitionClass()
    // The player speaks the game's language; until the front knows it, the interface's.
    instance.lang = i18n.language
    instance.continuous = false
    instance.interimResults = true

    // What was there before stays; what is heard goes after it.
    const before = value.trimEnd()
    instance.onresult = (event) => {
      const heard = Array.from(event.results, (result) => result[0]?.transcript ?? '')
        .join('')
        .trim()
      const text = before && heard ? `${before} ${heard}` : before || heard
      onChangeRef.current(text.slice(0, maxLength))
    }
    instance.onerror = (event) => {
      // Stopped on purpose, by the player or by leaving the screen.
      if (event.error === 'aborted') return
      setError(
        (DICTATION_ERRORS as readonly string[]).includes(event.error)
          ? (event.error as DictationError)
          : 'generic'
      )
    }
    instance.onend = () => {
      recognition.current = null
      setListening(false)
    }

    recognition.current = instance
    setError(null)
    setListening(true)
    try {
      instance.start()
    } catch {
      recognition.current = null
      setListening(false)
      setError('generic')
    }
  }, [i18n.language, value, maxLength])

  useEffect(() => cancel, [cancel])

  return { supported: RecognitionClass !== undefined, listening, error, start, stop, cancel }
}
