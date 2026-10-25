import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'
import type {
  Characteristic,
  ContextualEffect,
  Degree,
  Difficulty,
  GameStatus,
  ItemChange,
  Result,
  ScenarioStatus,
  TurnStatus,
} from '@/api/enums'
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
  /** What the character holds. What others hold is never sent. */
  inventory: InventoryItem[]
}

/**
 * An item the character holds. A stack has no handle; an improvised item
 * reads as its archetype. What an item is worth never leaves the backend.
 */
export type InventoryItem = {
  handle: string | null
  item: ContentLabel
  quantity: number
  equipped: boolean
}

/** A game as its own screen shows it: the full sheet and where the story stands. */
export type Game = GameHeader & {
  character: Character
  location: ContentLabel | null
  activeQuests: (ContentLabel & { summary: string | null })[]
  pendingTurn: { id: string } | null
}

/** A modifier of a roll: a circumstance by its label of effect, an item by its name. */
export type RollModifier =
  | { source: 'contextual'; effect: ContextualEffect; value: number }
  | { source: 'item'; item: ContentLabel; value: number }

/**
 * A roll in full, as at the table: what was rolled and at how much, the
 * difficulty, the modifiers, the chance, the d100 and the degree. Everything
 * comes computed from the backend.
 */
export type Roll = {
  /** The skill rolled, or null for a characteristic roll. */
  skill: ContentLabel | null
  characteristic: Characteristic | null
  /** The skill in percent, or the characteristic's score. */
  value: number
  baseChance: number
  difficulty: Difficulty
  modifiers: RollModifier[]
  chance: number
  /** The d100, 1 to 100. */
  roll: number
  result: Result
  degree: Degree
}

/** What happened to one of the character's items, with whom when someone was involved. */
export type ItemChangeEffect = {
  change: ItemChange
  item: ContentLabel
  quantity: number
  counterpart: ContentLabel | null
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
    items: ItemChangeEffect[]
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

/** A scenario a game can be started from, as the New game catalogue shows it. */
export type ScenarioSummary = {
  id: string
  title: string
  synopsis: string
  /** Always `published` for a player; a game master also sees drafts. */
  status: ScenarioStatus
  world: ContentLabel & { tone: string }
}

/** The scenarios this account may start a game from, sorted by the backend. */
export const scenariosQuery = queryOptions({
  queryKey: ['scenarios'],
  queryFn: async () => (await api<{ data: ScenarioSummary[] }>('/scenarios')).data,
})

/** Starts a game from a scenario; the answer is the new game, as its screen reads it. */
export async function startGame(scenarioId: string): Promise<Game> {
  const { data } = await api<{ data: Game }>('/sessions', {
    method: 'POST',
    body: { scenarioId },
  })
  return data
}
