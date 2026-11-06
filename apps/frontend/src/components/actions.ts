/**
 * The classes of the app's buttons and button-like links, so every page draws
 * them alike. Ink blue is for actions only (front spec, section 8).
 */
const BUTTON =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md border-[1.5px] px-4 text-label font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed'

export const PRIMARY_ACTION = `${BUTTON} border-transparent bg-accent text-on-accent shadow-[0_2px_0_rgb(0_0_0/0.12)] hover:bg-accent-hover disabled:bg-border disabled:text-subtle disabled:shadow-none`
export const SECONDARY_ACTION = `${BUTTON} border-accent bg-transparent text-accent hover:bg-accent-soft disabled:border-border disabled:text-subtle disabled:hover:bg-transparent`
export const DANGER_ACTION = `${BUTTON} border-transparent bg-hp text-on-hp hover:opacity-90 disabled:opacity-60`
/** A destructive action set in text, without the weight of a button. */
export const DANGER_TEXT_ACTION =
  'inline-flex items-center gap-1.5 rounded-sm text-label font-semibold text-hp transition-opacity hover:opacity-80 disabled:opacity-60'
/** Smaller, inside a card. */
export const SMALL = 'h-8 px-3 text-[0.8125rem]'

/** A round button holding an icon. `ICON_BUTTON_GHOST` without its border and fill. */
export const ICON_BUTTON =
  'grid size-9 shrink-0 place-items-center rounded-full border border-border-strong bg-card text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:text-subtle'
export const ICON_BUTTON_GHOST =
  'grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:text-subtle'
