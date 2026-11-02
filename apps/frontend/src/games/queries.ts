import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'
import type {
  AttackOutcome,
  Characteristic,
  ContextualEffect,
  Defense,
  DefenseOutcome,
  Degree,
  Difficulty,
  GameStatus,
  ItemChange,
  Period,
  Result,
  ScenarioStatus,
  SkillCategory,
  SpecialEffect,
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
  /** The seven of BRP, always in the same order; the front labels them. */
  characteristics: { reference: Characteristic; value: number }[]
  /** The skills the character trained, in percent, each with its BRP category. */
  skills: (LabelledValue & { category: SkillCategory })[]
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
  /** The period of the day, never the hour. */
  period: Period
  activeQuests: (ContentLabel & { summary: string | null })[]
  pendingTurn: { id: string } | null
}

/** A modifier of a roll: a circumstance by its label of effect, an item by its name. */
export type RollModifier =
  | { source: 'contextual'; effect: ContextualEffect; value: number }
  | { source: 'item'; item: ContentLabel; value: number }

/**
 * The damage the character's blow dealt, in full: the weapon's dice, the
 * damage modifier, what the armour stopped, the total and the special effect.
 * Computed by the backend. The damage the character takes is never detailed:
 * it comes from a roll of the people, which the player does not see.
 */
export type Damage = {
  weapon: number
  modifier: number
  armor: number
  total: number
  effect: SpecialEffect | null
}

/**
 * What a roll of the character did in its round: an attack, how it ended and
 * what it dealt — only when it hit; or a defence against the riposte, which
 * one and whether it held.
 */
export type RollCombat =
  | { role: 'attack'; outcome: AttackOutcome; damage: Damage | null }
  | { role: 'defense'; defense: Defense; outcome: DefenseOutcome }

/**
 * A roll in full, as at the table: what was rolled and at how much, the
 * difficulty, the modifiers, the chance, the d100 and the degree — and, in
 * combat, what it did in the round. Everything comes computed from the backend.
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
  /** Null outside combat. */
  combat: RollCombat | null
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
  /** The character's rolls, in the order they were made: the action or attack, then the defence. */
  rolls: Roll[]
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

/**
 * Takes a game off the player's list. The backend keeps it, but answers for it
 * as for a game that does not exist from then on.
 */
export async function deleteGame(gameId: string): Promise<void> {
  await api<undefined>(`/sessions/${gameId}`, { method: 'DELETE' })
}

/**
 * The story as far as it is loaded: completed turns only, oldest first, and
 * whether earlier ones remain to be loaded.
 */
export type JournalPages = {
  turns: Turn[]
  hasEarlier: boolean
}

type TurnsPage = { data: Turn[]; metadata: { hasEarlier: boolean } }

/** A page of the story: the last turns, or those before a turn number. */
export async function turnsPage(gameId: string, before?: number): Promise<JournalPages> {
  const query = before === undefined ? '' : `?before=${before}`
  const page = await api<TurnsPage>(`/sessions/${gameId}/turns${query}`)

  return { turns: page.data, hasEarlier: page.metadata.hasEarlier }
}

/** The story so far, its last page first; earlier pages join it on demand. */
export const turnsQuery = (gameId: string) =>
  queryOptions({
    queryKey: ['games', gameId, 'turns'],
    queryFn: () => turnsPage(gameId),
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
