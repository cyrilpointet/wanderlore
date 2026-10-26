import type { Period } from '@/api/enums'
import type { ContentLabel } from '@/api/types'
import type { Character, Game } from './queries'

/**
 * The game as `turn_completed` leaves it: the sheet — inventory included — as
 * the backend sent it, the place badge and the period of the day when the
 * event carried them, and no turn pending any more. Nothing is computed: the
 * front only puts it in place.
 */
export function withCompletedTurn(
  game: Game,
  character: Character,
  location: ContentLabel | null | undefined,
  period?: Period
): Game {
  return {
    ...game,
    character,
    location: location === undefined ? game.location : location,
    period: period ?? game.period,
    pendingTurn: null,
  }
}
