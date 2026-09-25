import { useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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

  useLayoutEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [value])

  function send(event?: FormEvent) {
    event?.preventDefault()
    if (sendable) onSubmit(value.trim())
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter breaks the line; an IME composing a character keeps its Enter.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <form onSubmit={send} className="shrink-0 border-t border-border bg-bg px-3 py-3 sm:px-6">
      <div className="mx-auto flex w-full max-w-reading items-end gap-2 rounded-lg border border-border-strong bg-surface-1 p-2 transition-colors focus-within:border-accent">
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
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-body text-text placeholder:text-subtle focus:outline-none read-only:text-muted read-only:placeholder:italic"
        />
        <button
          type="submit"
          disabled={!sendable}
          aria-label={t('composer.send')}
          className="grid size-10 shrink-0 place-items-center rounded-md border border-transparent bg-accent text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-transparent disabled:text-subtle"
        >
          <ArrowUp aria-hidden className="size-5" />
        </button>
      </div>
      {error && (
        <p
          id="player-input-error"
          role="alert"
          className="mx-auto mt-1.5 max-w-reading text-label text-danger"
        >
          {error}
        </p>
      )}
      {value.length > COUNTER_FROM && (
        <p
          className={`mx-auto mt-1.5 max-w-reading text-right text-meta ${value.length >= MAX_INPUT ? 'text-danger' : 'text-subtle'}`}
        >
          {t('composer.counter', { count: value.length, max: MAX_INPUT })}
        </p>
      )}
    </form>
  )
}
