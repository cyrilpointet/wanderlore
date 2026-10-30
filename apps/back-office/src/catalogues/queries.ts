import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'
import type { Labels } from '@/content/labels'

/** The three catalogues of a world, and of each of its scenarios. */
export const CATALOGUES = ['npcs', 'locations', 'items'] as const
export type Catalogue = (typeof CATALOGUES)[number]

export const KINDS = ['unique', 'archetype'] as const
export type Kind = (typeof KINDS)[number]

export const DISPOSITIONS = ['hostile', 'unfriendly', 'neutral', 'friendly', 'allied'] as const
export type Disposition = (typeof DISPOSITIONS)[number]

/** Where definitions live: at world level, or in one scenario, overriding the world's. */
export type Level = { worldId: string } | { scenarioId: string }

type DefinitionBase = {
  id: string
  worldId: string
  scenarioId: string | null
  reference: string
  labels: Labels
  description: string
  kind: Kind
  updatedAt: string | null
}

export type NpcDefinition = DefinitionBase & {
  generic: boolean
  defaultDisposition: Disposition
  combat: unknown
  /** The named place a unique person waits in from the start; null for none. */
  initialLocation: string | null
}

/**
 * A place. A named one may declare its exits — written as JSON, checked by
 * the backend field by field — and be an entrance of its network.
 */
export type LocationDefinition = DefinitionBase & {
  parent: string | null
  exits?: unknown
  entrance?: boolean
}

export type ItemHolder = { holder: 'npc' | 'location'; reference: string }

export type ItemDefinition = DefinitionBase & {
  generic: boolean
  stackable: boolean
  equippable: boolean
  modifiers: unknown
  /** Null for anything that is no weapon. */
  weapon: unknown
  initialHolder: ItemHolder | null
}

export type Definition = NpcDefinition | LocationDefinition | ItemDefinition

function pathOf(level: Level): string {
  return 'scenarioId' in level ? `/admin/scenarios/${level.scenarioId}` : `/admin/worlds/${level.worldId}`
}

export const catalogueQuery = (level: Level, catalogue: Catalogue) =>
  queryOptions({
    queryKey: ['catalogue', pathOf(level), catalogue],
    queryFn: async () =>
      (await api<{ data: Definition[] }>(`${pathOf(level)}/${catalogue}`)).data,
  })

export async function createDefinition(
  level: Level,
  catalogue: Catalogue,
  payload: Record<string, unknown>
): Promise<Definition> {
  return (
    await api<{ data: Definition }>(`${pathOf(level)}/${catalogue}`, {
      method: 'POST',
      body: payload,
    })
  ).data
}

export async function updateDefinition(
  catalogue: Catalogue,
  id: string,
  payload: Record<string, unknown>
): Promise<Definition> {
  return (
    await api<{ data: Definition }>(`/admin/${catalogue}/${id}`, { method: 'PATCH', body: payload })
  ).data
}

export async function deleteDefinition(catalogue: Catalogue, id: string): Promise<void> {
  await api(`/admin/${catalogue}/${id}`, { method: 'DELETE' })
}
