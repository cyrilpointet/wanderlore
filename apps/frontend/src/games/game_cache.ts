import type { ContentLabel } from '@/api/types'
import type { Character, Game } from './queries'

/**
 * The game as `turn_completed` leaves it: the sheet — inventory included — as
 * the backend sent it, the place badge when the event carried it, and no turn
 * pending any more. Nothing is computed: the front only puts it in place.
 */
export function withCompletedTurn(
  game: Game,
  character: Character,
  location: ContentLabel | null | undefined
): Game {
  return {
    ...game,
    character,
    location: location === undefined ? game.location : location,
    pendingTurn: null,
  }
}
