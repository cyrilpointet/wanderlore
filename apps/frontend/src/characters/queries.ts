import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'
import type {
  Characteristic,
  EndReason,
  GameStatus,
  Gender,
  ScenarioStatus,
  SkillCategory,
} from '@/api/enums'
import type { ContentLabel } from '@/api/types'
import type { Game, LabelledValue } from '@/games/queries'

/**
 * A character belongs to a world for good and plays one game at a time.
 * Shapes mirror the backend; every value is computed there.
 */

/** Who the character is, the same on every screen. */
export type CharacterIdentity = {
  id: string
  name: string
  gender: Gender
  world: ContentLabel
  profession: ContentLabel
  createdAt: string
}

/** The game a character plays, as a card shows it. */
export type CharacterGame = {
  id: string
  status: GameStatus
  lastActivityAt: string
  scenario: { id: string; title: string }
  chapter: ContentLabel | null
  /** Null only for a game whose state is not there yet. */
  hitPoints: number | null
  hitPointsMax: number | null
}

/** A character as the home lists it. */
export type CharacterSummary = CharacterIdentity & {
  lastActivityAt: string
  /** The game they play, or null when they play none. */
  game: CharacterGame | null
}

/** A scenario of the character's world they may start; those they completed are left out. */
export type ScenarioChoice = {
  id: string
  title: string
  synopsis: string
  /** Always `published` for a player; a game master also sees drafts. */
  status: ScenarioStatus
  /** They failed it before: they may try again. */
  failed: boolean
}

/** A game over, which can still be read. */
export type PastGame = {
  id: string
  status: Extract<GameStatus, 'failed' | 'completed'>
  endedAt: string | null
  /** Won (`victory`), or failed by defeat, death or abandon. */
  endReason: EndReason | null
  scenario: { id: string; title: string }
}

/** A character's page: their sheet, their game, what they may play, what they played. */
export type CharacterDetail = CharacterIdentity & {
  characteristics: { reference: Characteristic; value: number }[]
  skills: (LabelledValue & { category: SkillCategory })[]
  /** In a game under way or paused: then no other can start, and the character stays. */
  engaged: boolean
  game: CharacterGame | null
  scenarios: ScenarioChoice[]
  pastGames: PastGame[]
}

/** A world a character can be created in. */
export type WorldSummary = ContentLabel & { id: string; tone: string }

/** Everything a character's page and the home read starts with this key. */
export const CHARACTERS_KEY = ['characters'] as const

/** The player's characters, those in a game first, then by last activity — the backend sorts them. */
export const charactersQuery = queryOptions({
  queryKey: CHARACTERS_KEY,
  queryFn: async () => (await api<{ data: CharacterSummary[] }>('/characters')).data,
})

export const characterQuery = (characterId: string) =>
  queryOptions({
    queryKey: [...CHARACTERS_KEY, characterId],
    queryFn: async () => (await api<{ data: CharacterDetail }>(`/characters/${characterId}`)).data,
  })

/** The worlds where the player can create a character: those with a scenario to play. */
export const worldsQuery = queryOptions({
  queryKey: ['worlds'],
  queryFn: async () => (await api<{ data: WorldSummary[] }>('/worlds')).data,
})

/** Starts a game of a scenario; the answer is the game, as its screen reads it. */
export async function startGame(characterId: string, scenarioId: string): Promise<Game> {
  const { data } = await api<{ data: Game }>(`/characters/${characterId}/sessions`, {
    method: 'POST',
    body: { scenarioId },
  })
  return data
}

/** Takes the character off the player's list; refused while they are in a game. */
export async function deleteCharacter(characterId: string): Promise<void> {
  await api<undefined>(`/characters/${characterId}`, { method: 'DELETE' })
}

/* ---------- Creation ---------- */

/** What a skill is worth untrained: a figure, or a characteristic times a multiplier. Shown only. */
export type BaseChance = number | { characteristic: Characteristic; multiplier: number }

export type Profession = ContentLabel & {
  /** One line, in English. */
  description: string
  /** The skills the professional points go to. */
  skills: ContentLabel[]
  startingItems: { item: ContentLabel; quantity: number; equipped: boolean }[]
  startingResources: LabelledValue[]
}

/** What creating a character in a world takes, every reference with its label. */
export type CreationWorld = {
  world: WorldSummary
  /** The world's level of power: the backend draws the pools and the cap from it. */
  powerLevel: string
  professionalPoints: number
  /** The most a skill may be worth at creation; null: no cap. */
  skillCap: number | null
  personalPointsPerInt: number
  /** SIZ and INT are raised to it. */
  characteristicFloor: number
  nameMaxLength: number
  professions: Profession[]
  /** Every skill of the world, in its order. */
  skills: (ContentLabel & { category: SkillCategory; baseChance: BaseChance })[]
}

export const creationQuery = (worldId: string) =>
  queryOptions({
    queryKey: ['worlds', worldId, 'creation'],
    queryFn: async () => (await api<{ data: CreationWorld }>(`/worlds/${worldId}/creation`)).data,
    staleTime: Infinity,
  })

/**
 * Seven times four d6, the best three kept, drawn by the backend; each series
 * replaces the last. The dice of each result are only in the answer to the
 * draw, to show them: the preview and the creation work on the totals, by
 * their position.
 */
export type CharacteristicRoll = {
  id: string
  values: number[]
  /** `dice[i]`: the four d6 of `values[i]`, and which one the backend set aside. */
  dice: ResultDice[]
}

export type ResultDice = {
  faces: number[]
  /** The position, in `faces`, of the die set aside: the others add up to the result. */
  dropped: number
}

export async function rollCharacteristics(): Promise<CharacteristicRoll> {
  const { data } = await api<{ data: CharacteristicRoll }>('/character-rolls', { method: 'POST' })
  return data
}

/** The draft as the backend reads it: any field may still be missing in a preview. */
export type DraftBody = {
  worldId: string
  /** Which result of the series goes to each characteristic, by its position in the series. */
  placement: Partial<Record<Characteristic, number>>
  profession: string | null
  professionalPoints: Record<string, number>
  personalPoints: Record<string, number>
  name: string
  gender: Gender | null
}

export type Pool = { total: number; spent: number; left: number }

export type PreviewSkill = {
  reference: string
  /** Null until the characteristic it rests on is placed. */
  base: number | null
  professional: number
  personal: number
  value: number | null
}

/** The sheet the draft makes, as far as it goes. */
export type PreviewSheet = {
  /** Placed and raised; null: not placed yet. */
  characteristics: Record<Characteristic, number | null>
  /** Those raised to the floor. */
  raised: Characteristic[]
  profession: string | null
  skills: PreviewSkill[]
  professionalPool: Pool
  /** Null until INT is placed. */
  personalPool: Pool | null
  skillCap: number | null
  hitPoints: number | null
}

/** Something the draft gets wrong, on the path of the field at fault (`skills.fencing`). */
export type CreationIssue = { code: string; field: string; reference?: string }

export type Preview = { sheet: PreviewSheet; issues: CreationIssue[] }

/** The sheet the draft makes and what is wrong with it. Nothing is written. */
export async function previewCharacter(body: DraftBody, signal?: AbortSignal): Promise<Preview> {
  const { data } = await api<{ data: Preview }>('/characters/preview', {
    method: 'POST',
    body,
    signal,
  })
  return data
}

/** Creates the character the draft describes, on the series it was placed from. */
export async function createCharacter(body: DraftBody & { rollId: string }): Promise<string> {
  const { data } = await api<{ data: { id: string } }>('/characters', { method: 'POST', body })
  return data.id
}
