/**
 * The objects lying on the game table (front spec, section 8), as classes, so
 * every page draws them alike. Paper on paper: each object casts a soft
 * shadow, the sheet the most, the cards less; the dice tray is recessed.
 */

/** The sheet of paper the story, a creation step or a page's content is written on. */
export const SHEET = 'rounded-[3px] border border-border-strong bg-paper shadow-sheet'

/** An index card: a character, a roll, a scenario, a dialog's body. */
export const CARD = 'rounded-[4px] border border-border-strong bg-card shadow-card'

/** A card lifted above the table: dialogs, menus, the sheet risen on a phone. */
export const LIFTED = 'rounded-md border border-border-strong bg-card shadow-lift'

/** A frame drawn on a sheet, without depth: hit points on the sheet, a game on a card. */
export const INSET = 'rounded-[4px] border border-border bg-paper'

/** The recessed tray the dice rest in. */
export const TRAY = 'rounded-xl bg-tray shadow-tray'

/** A folder tab sticking out of a card's top edge; `FOLDER_TAB_ON` for the card on top. */
export const FOLDER_TAB =
  'inline-flex items-center gap-1.5 rounded-t-[7px] border border-b-0 border-border-strong bg-card-under px-3.5 pt-[7px] pb-1.5 text-[0.6875rem] leading-none font-semibold tracking-[0.08em] text-subtle uppercase'
export const FOLDER_TAB_ON = 'relative z-10 -mb-px bg-card pb-2 text-text'

/** A small label in spaced capitals. */
export const LABEL = 'text-meta font-semibold text-subtle uppercase'
