/** The cards of the character's sheet, in the order of their tabs. */
export const SHEET_TABS = ['character', 'inventory', 'quests'] as const

export type SheetTab = (typeof SHEET_TABS)[number]
