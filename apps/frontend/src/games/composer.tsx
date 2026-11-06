import { useEffect, useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { Lock, Mic, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CARD } from '@/components/surfaces'
import { useDictation } from './use_dictation'

/** Bounded by the backend: the text is forwarded to the model, and paid for. */
const MAX_INPUT = 1000
/** The counter only shows when the limit gets near. */
const COUNTER_FROM = 900
/** The field grows with the text up to about six lines, then scrolls. */
const MAX_HEIGHT_PX = 6 * 24 + 22

export function Composer({
  value,
  onChange,
  onSubmit,
  locked,
  ready,
  error,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  /** A turn is on its way. A convenience: the idempotency key is the real protection. */
  locked: boolean
  /** Subscribed to the game's channel: nothing is sent before someone is listening. */
  ready: boolean
  /** Why the last text was refused, already in words; the text itself stays. */
  error?: string
}) {
  const { t } = useTranslation('game')
  const field = useRef<HTMLTextAreaElement>(null)
  const sendable = ready && !locked && value.trim().length > 0
  const dictation = useDictation({ value, onChange, maxLength: MAX_INPUT })
  const { cancel: cancelDictation } = dictation

  // A turn on its way: nothing more goes into the field.
  useEffect(() => {
    if (locked) cancelDictation()
  }, [locked, cancelDictation])

  useLayoutEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [value])

  function send(event?: FormEvent) {
    event?.preventDefault()
    if (!sendable) return
    cancelDictation()
    onSubmit(value.trim())
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter breaks the line; an IME composing a character keeps its Enter.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    // The input slip, lying in the dice tray (front spec, section 8).
    <form onSubmit={send} className="flex flex-col gap-1.5">
      <div
        className={`${CARD} flex items-end gap-1 rounded-lg p-1.5 pl-3.5 transition-colors focus-within:border-accent`}
      >
        {locked && <Lock aria-hidden className="mb-[11px] size-[18px] shrink-0 text-subtle" />}
        <label htmlFor="player-input" className="sr-only">
          {t('composer.label')}
        </label>
        <textarea
          id="player-input"
          ref={field}
          rows={1}
          value={value}
          maxLength={MAX_INPUT}
          readOnly={locked}
          aria-disabled={locked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'player-input-error' : undefined}
          placeholder={locked ? t('composer.locked') : t('composer.placeholder')}
          onChange={(event) => {
            // Typing takes over: the next phrase heard would overwrite the correction.
            cancelDictation()
            onChange(event.target.value)
          }}
          onKeyDown={onKeyDown}
          className="min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-body text-text placeholder:text-subtle focus:outline-none read-only:text-muted read-only:placeholder:italic"
        />
        {dictation.supported && (
          <button
            type="button"
            onClick={dictation.listening ? dictation.stop : dictation.start}
            disabled={locked}
            aria-label={dictation.listening ? t('dictation.stop') : t('dictation.start')}
            aria-pressed={dictation.listening}
            className={`grid size-10 shrink-0 place-items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:text-subtle ${
              dictation.listening
                ? 'border-accent bg-accent-soft text-accent motion-safe:animate-pulse'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <Mic aria-hidden className="size-5" />
          </button>
        )}
        <button
          type="submit"
          disabled={!sendable}
          aria-label={t('composer.send')}
          className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-subtle"
        >
          <Send aria-hidden className="size-[18px]" />
        </button>
      </div>
      {error && (
        <p id="player-input-error" role="alert" className="px-1 text-label text-danger">
          {error}
        </p>
      )}
      {dictation.error && (
        <p role="alert" className="px-1 text-label text-danger">
          {t(`dictation.error.${dictation.error}`)}
        </p>
      )}
      {value.length > COUNTER_FROM && (
        <p
          className={`px-1 text-right text-meta ${value.length >= MAX_INPUT ? 'text-danger' : 'text-subtle'}`}
        >
          {t('composer.counter', { count: value.length, max: MAX_INPUT })}
        </p>
      )}
    </form>
  )
}
