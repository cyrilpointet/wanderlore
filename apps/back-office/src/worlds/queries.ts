import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'
import type { Labels } from '@/content/labels'

export type { Labels }

/** A world as the back-office lists it. Shapes mirror the backend transformers. */
export type WorldSummary = {
  id: string
  reference: string
  labels: Labels
  scenarioCount: number
  updatedAt: string | null
}

export type Entry = { reference: string; labels: Labels }

/** The seven characteristics of BRP: the system's, the same in every world. */
export const CHARACTERISTICS = ['STR', 'CON', 'SIZ', 'INT', 'POW', 'DEX', 'CHA'] as const
export type Characteristic = (typeof CHARACTERISTICS)[number]

/** The six skill categories of BRP. */
export const SKILL_CATEGORIES = [
  'combat',
  'communication',
  'manipulation',
  'mental',
  'perception',
  'physical',
] as const
export type SkillCategory = (typeof SKILL_CATEGORIES)[number]

/** What an untrained character has in a skill: a fixed chance, or a characteristic times a multiplier. */
export type BaseChance = number | { characteristic: Characteristic; multiplier: number }

export type Skill = Entry & { category: SkillCategory; baseChance: BaseChance }

/** Everything a world holds itself; its scenarios and catalogues have routes of their own. */
export type WorldDetail = {
  id: string
  reference: string
  labels: Labels
  narrativeTone: string
  rules: string[]
  ambiance: string[]
  skills: Skill[]
  resources: Entry[]
  glossary: Entry[]
  updatedAt: string | null
}

/** A world as it is sent: everything but its id, the reference only on creation. */
export type WorldPayload = Omit<WorldDetail, 'id' | 'updatedAt'>

/** A category of action, resolved by a skill or by a characteristic — exactly one. */
export type ActionType = {
  id: string
  actionType: string
  description: string
  associatedSkill: string | null
  associatedCharacteristic: Characteristic | null
}

/** The worlds of the game, sorted by reference by the backend. */
export const worldsQuery = queryOptions({
  queryKey: ['worlds'],
  queryFn: async () => (await api<{ data: WorldSummary[] }>('/admin/worlds')).data,
})

export const worldQuery = (worldId: string) =>
  queryOptions({
    queryKey: ['worlds', worldId],
    queryFn: async () => (await api<{ data: WorldDetail }>(`/admin/worlds/${worldId}`)).data,
  })

export const actionTypesQuery = (worldId: string) =>
  queryOptions({
    queryKey: ['worlds', worldId, 'action-types'],
    queryFn: async () =>
      (await api<{ data: ActionType[] }>(`/admin/worlds/${worldId}/action-types`)).data,
  })

export async function createWorld(payload: WorldPayload): Promise<WorldDetail> {
  return (await api<{ data: WorldDetail }>('/admin/worlds', { method: 'POST', body: payload }))
    .data
}

export async function updateWorld(
  worldId: string,
  payload: Partial<WorldPayload>
): Promise<WorldDetail> {
  return (
    await api<{ data: WorldDetail }>(`/admin/worlds/${worldId}`, {
      method: 'PATCH',
      body: payload,
    })
  ).data
}

export async function deleteWorld(worldId: string): Promise<void> {
  await api(`/admin/worlds/${worldId}`, { method: 'DELETE' })
}

export async function createActionType(
  worldId: string,
  payload: Omit<ActionType, 'id'>
): Promise<ActionType> {
  return (
    await api<{ data: ActionType }>(`/admin/worlds/${worldId}/action-types`, {
      method: 'POST',
      body: payload,
    })
  ).data
}

export async function updateActionType(
  id: string,
  payload: Pick<ActionType, 'description' | 'associatedSkill' | 'associatedCharacteristic'>
): Promise<ActionType> {
  return (
    await api<{ data: ActionType }>(`/admin/action-types/${id}`, {
      method: 'PATCH',
      body: payload,
    })
  ).data
}

export async function deleteActionType(id: string): Promise<void> {
  await api(`/admin/action-types/${id}`, { method: 'DELETE' })
}
