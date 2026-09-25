import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'
import type { GameStatus } from '@/api/enums'
import type { ContentLabel } from '@/api/types'

/**
 * A game as the list shows it. The API calls a game a session (the
 * `sessions` table); the interface never does.
 */
export type GameSummary = {
  id: string
  status: GameStatus
  lastActivityAt: string
  world: ContentLabel
  chapter: ContentLabel | null
  character: {
    name: string
    hitPoints: number
    hitPointsMax: number
  }
}

/** The player's games, most recently played first — the backend sorts them. */
export const gamesQuery = queryOptions({
  queryKey: ['games'],
  queryFn: async () => (await api<{ data: GameSummary[] }>('/sessions')).data,
})
