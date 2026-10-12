import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'
import type { Labels } from '@/content/labels'

export type Entry = { reference: string; labels: Labels }

export type ActiveQuest = { reference: string; step: number; summary: string }

export type InitialState = {
  location: string
  chapter: string | null
  quests: ActiveQuest[]
}

export type ScenarioStatus = 'draft' | 'published'

/** A scenario as the back-office edits it; its catalogues have routes of their own. */
export type Scenario = {
  id: string
  worldId: string
  reference: string
  labels: Labels
  synopsis: string
  status: ScenarioStatus
  chapters: Entry[]
  quests: Entry[]
  pregeneratedCharacter: unknown
  initialState: InitialState | null
  glossary: Entry[]
  updatedAt: string | null
}

export type ScenarioPayload = Omit<Scenario, 'id' | 'worldId' | 'status' | 'updatedAt'>

/** One thing that keeps a scenario from being published, as the backend names it. */
export type CoherenceIssue = { code: string; location: string; reference?: string }

export const scenariosQuery = (worldId: string) =>
  queryOptions({
    queryKey: ['worlds', worldId, 'scenarios'],
    queryFn: async () =>
      (await api<{ data: Scenario[] }>(`/admin/worlds/${worldId}/scenarios`)).data,
  })

export const scenarioQuery = (scenarioId: string) =>
  queryOptions({
    queryKey: ['scenarios', scenarioId],
    queryFn: async () => (await api<{ data: Scenario }>(`/admin/scenarios/${scenarioId}`)).data,
  })

export async function createScenario(
  worldId: string,
  payload: Pick<ScenarioPayload, 'reference' | 'labels'>
): Promise<Scenario> {
  return (
    await api<{ data: Scenario }>(`/admin/worlds/${worldId}/scenarios`, {
      method: 'POST',
      body: payload,
    })
  ).data
}

export async function updateScenario(
  scenarioId: string,
  payload: Partial<ScenarioPayload>
): Promise<Scenario> {
  return (
    await api<{ data: Scenario }>(`/admin/scenarios/${scenarioId}`, {
      method: 'PATCH',
      body: payload,
    })
  ).data
}

export async function deleteScenario(scenarioId: string): Promise<void> {
  await api(`/admin/scenarios/${scenarioId}`, { method: 'DELETE' })
}

export async function publishScenario(scenarioId: string): Promise<Scenario> {
  return (
    await api<{ data: Scenario }>(`/admin/scenarios/${scenarioId}/publish`, { method: 'POST' })
  ).data
}

export async function unpublishScenario(scenarioId: string): Promise<Scenario> {
  return (
    await api<{ data: Scenario }>(`/admin/scenarios/${scenarioId}/unpublish`, { method: 'POST' })
  ).data
}
