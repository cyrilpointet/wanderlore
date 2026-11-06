import { useEffect, useId, useRef } from 'react'
import { CircleAlert } from 'lucide-react'

import { useAnimates } from '@/preferences'
import { DANGER_ACTION, SECONDARY_ACTION } from './actions'
import { LIFTED } from './surfaces'

/**
 * Asks before something that cannot be undone. A native modal `<dialog>`,
 * which brings focus trapping, Escape and an inert page behind it; focus
 * lands on the button that changes nothing, so a stray Enter does no harm.
 *
 * The request belongs to the page: the dialog only shows where it stands.
 * Every text comes worded by the caller.
 */
export function ConfirmDialog({
  open,
  pending,
  error,
  title,
  body,
  cancelLabel,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onClose,
}: {
  open: boolean
  /** The request is under way: the buttons and Escape wait for it. */
  pending: boolean
  /** Why the last attempt failed, already worded for the player. */
  error: string | null
  title: string
  body: string
  cancelLabel: string
  confirmLabel: string
  pendingLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const bodyId = useId()
  // Lifted above the table and put back down, unless the player or the system turned it off.
  const moves = useAnimates('transitions')

  useEffect(() => {
    const element = dialog.current
    if (!element) return

    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      aria-describedby={bodyId}
      onClose={onClose}
      // Escape waits, like the buttons, for the request under way to answer.
      onCancel={(event) => pending && event.preventDefault()}
      // A click on the backdrop lands on the dialog itself, never on its content.
      onClick={(event) => event.target === dialog.current && !pending && onClose()}
      // A card lifted above the dimmed table (front spec, section 8).
      className={`${LIFTED} fixed inset-0 m-auto h-fit w-[min(440px,calc(100%-2rem))] max-w-none p-0 text-text backdrop:bg-dim ${moves ? 'dialog-lift' : ''}`}
    >
      <div className="flex flex-col gap-3 px-[22px] pt-[22px] pb-5">
        <h2
          id={headingId}
          className="font-serif text-xl leading-tight font-semibold text-balance text-text"
        >
          {title}
        </h2>
        <p id={bodyId} className="text-[0.90625rem] leading-[1.55] text-muted">
          {body}
        </p>
        {error && (
          <p role="alert" className="flex items-center gap-2 text-body text-text">
            <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
            {error}
          </p>
        )}
        <div className="mt-2 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={pending}
            className={SECONDARY_ACTION}
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className={DANGER_ACTION}>
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
