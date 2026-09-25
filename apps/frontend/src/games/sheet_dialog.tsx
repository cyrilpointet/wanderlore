import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CharacterSheet } from './character_sheet'
import type { Game } from './queries'

/** From here on, the sheet is a column of its own and the panel has no reason to be. */
const WIDE = '(min-width: 64rem)'

/**
 * The sheet on phones and tablets: a panel rising over two thirds of the
 * screen. A native modal `<dialog>`, which brings focus trapping, Escape and
 * an inert page behind it.
 */
export function SheetDialog({
  game,
  open,
  onClose,
}: {
  game: Game
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('game')
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()

  useEffect(() => {
    const element = dialog.current
    if (!element) return

    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  useEffect(() => {
    if (!open) return

    const wide = matchMedia(WIDE)
    const closeWhenWide = () => wide.matches && onClose()
    wide.addEventListener('change', closeWhenWide)
    return () => wide.removeEventListener('change', closeWhenWide)
  }, [open, onClose])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself, never on its content.
      onClick={(event) => event.target === dialog.current && onClose()}
      className="fixed inset-x-0 top-auto bottom-0 m-0 h-[67dvh] max-h-none w-full max-w-none rounded-t-xl border-t border-border-strong bg-surface-3 p-0 text-text shadow-[0_-12px_40px_rgb(0_0_0/0.35)] backdrop:bg-black/60 lg:hidden"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 justify-end px-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeSheet')}
            className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:text-text"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
          <CharacterSheet game={game} headingId={headingId} />
        </div>
      </div>
    </dialog>
  )
}
