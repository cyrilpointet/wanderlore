import { useEffect, useId, useRef } from 'react'
import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Asks before a game leaves the list. A native modal `<dialog>`, which brings
 * focus trapping, Escape and an inert page behind it; focus lands on the
 * button that keeps the game, so a stray Enter deletes nothing.
 *
 * The request belongs to the list: the dialog only shows where it stands.
 */
export function DeleteGameDialog({
  characterName,
  open,
  deleting,
  error,
  onConfirm,
  onClose,
}: {
  /** The character the game is played with: what the player knows it by. */
  characterName: string
  open: boolean
  deleting: boolean
  /** Why the last attempt failed, already worded for the player. */
  error: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('games')
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const bodyId = useId()

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
      onCancel={(event) => deleting && event.preventDefault()}
      // A click on the backdrop lands on the dialog itself, never on its content.
      onClick={(event) => event.target === dialog.current && !deleting && onClose()}
      className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-sm rounded-lg border border-border-strong bg-surface-3 p-0 text-text shadow-[0_12px_40px_rgb(0_0_0/0.35)] backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id={headingId} className="font-serif text-xl font-medium text-text">
          {t('deleteDialog.title')}
        </h2>
        <p id={bodyId} className="text-body text-muted">
          {t('deleteDialog.body', { name: characterName })}
        </p>
        {error && (
          <p role="alert" className="flex items-center gap-2 text-body text-text">
            <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
            {error}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={deleting}
            className="h-10 rounded-lg border border-border-strong px-4 text-body text-text transition-colors hover:bg-surface-2 disabled:opacity-70"
          >
            {t('deleteDialog.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="h-10 rounded-lg border border-danger/60 bg-danger/10 px-4 text-body font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-70"
          >
            {deleting ? t('deleteDialog.deleting') : t('deleteDialog.confirm')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
