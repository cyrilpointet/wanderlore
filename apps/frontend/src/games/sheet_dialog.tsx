import { useEffect, useId, useRef } from 'react'

import { useAnimates } from '@/preferences'
import { CharacterSheet } from './character_sheet'
import type { SheetTab } from './sheet_tabs'
import type { Game } from './queries'

/** From here on, the sheet is a column of its own and the panel has no reason to be. */
const WIDE = '(min-width: 64rem)'

/**
 * The sheet on phones and tablets: the stack of cards lifted above the
 * darkened table, almost to the top of the screen (front spec, section 8). A
 * native modal `<dialog>`, which brings focus trapping, Escape and an inert
 * page behind it.
 */
export function SheetDialog({
  game,
  open,
  tab,
  opening,
  onClose,
}: {
  game: Game
  open: boolean
  /** The card the sheet opens on — still shown while it is put back down. */
  tab: SheetTab
  /** Counts the openings: each one starts afresh on the card asked for. */
  opening: number
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  // Rising from the bottom and sliding back down, unless the player or the system turned it off.
  const moves = useAnimates('transitions')

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
      className={`fixed inset-x-2 top-16 bottom-0 m-0 h-auto max-h-none w-auto max-w-none bg-transparent p-0 text-text backdrop:bg-dim lg:hidden ${moves ? 'dialog-rise' : ''}`}
    >
      <CharacterSheet
        key={opening}
        game={game}
        headingId={headingId}
        initialTab={tab}
        onClose={onClose}
      />
    </dialog>
  )
}
