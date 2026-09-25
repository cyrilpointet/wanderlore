import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'
import type { GameStatus, Margin, Result, TurnStatus } from '@/api/enums'
import type { ContentLabel } from '@/api/types'

/**
 * The API calls a game a session (the `sessions` table); the interface never
 * does. Shapes mirror the backend transformers.
 */
type GameHeader = {
  id: string
  status: GameStatus
  lastActivityAt: string
  world: ContentLabel
  chapter: ContentLabel | null
}

/** A game as the list shows it. */
export type GameSummary = GameHeader & {
  character: {
    name: string
    hitPoints: number
    hitPointsMax: number
  }
}

export type LabelledValue = ContentLabel & { value: number }

export type Character = {
  name: string
  hitPoints: number
  hitPointsMax: number
  attributes: LabelledValue[]
  /** Each skill names the reference of its attribute. */
  skills: (LabelledValue & { attribute: string })[]
  resources: LabelledValue[]
}

/** A game as its own screen shows it: the full sheet and where the story stands. */
export type Game = GameHeader & {
  character: Character
  location: ContentLabel | null
  activeQuests: (ContentLabel & { summary: string | null })[]
  pendingTurn: { id: string } | null
}

/** Only what the player may see of a roll: never the dice, the threshold or the total. */
export type Roll = {
  skill: ContentLabel
  result: Result
  margin: Margin
}

export type Turn = {
  id: string
  /** Not always known while the turn is pending. */
  turnNumber: number | null
  status: TurnStatus
  playerInput: string
  roll: Roll | null
  narration: string | null
  effects: {
    hitPointsDelta: number
    movement: ContentLabel | null
  } | null
  failure: { code: string; message: string } | null
}

/** The player's games, most recently played first — the backend sorts them. */
export const gamesQuery = queryOptions({
  queryKey: ['games'],
  queryFn: async () => (await api<{ data: GameSummary[] }>('/sessions')).data,
})

export const gameQuery = (gameId: string) =>
  queryOptions({
    queryKey: ['games', gameId],
    queryFn: async () => (await api<{ data: Game }>(`/sessions/${gameId}`)).data,
  })

/** The story so far: completed turns only, oldest first. */
export const turnsQuery = (gameId: string) =>
  queryOptions({
    queryKey: ['games', gameId, 'turns'],
    queryFn: async () => (await api<{ data: Turn[] }>(`/sessions/${gameId}/turns`)).data,
  })
