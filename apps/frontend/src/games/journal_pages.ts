import type { JournalPages, Turn } from './queries'

/**
 * How a page or a turn joins the story already loaded. Pure: the cache is
 * written with what these return.
 */

/** A finished turn joins the end of the story — once, whichever way it arrives. */
export function withTurn(journal: JournalPages, turn: Turn): JournalPages {
  if (journal.turns.some((known) => known.id === turn.id)) return journal

  return { ...journal, turns: [...journal.turns, turn] }
}

/** An earlier page goes before the story loaded, without a turn twice. */
export function withEarlier(journal: JournalPages, page: JournalPages): JournalPages {
  const known = new Set(journal.turns.map(({ id }) => id))

  return {
    turns: [...page.turns.filter(({ id }) => !known.has(id)), ...journal.turns],
    hasEarlier: page.hasEarlier,
  }
}

/** The turn number the next earlier page ends before; none when nothing is loaded. */
export function earliestTurnNumber(journal: JournalPages): number | undefined {
  return journal.turns[0]?.turnNumber ?? undefined
}
