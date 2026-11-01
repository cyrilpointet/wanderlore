import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'
import { type Level, pathOf } from '@/catalogues/queries'

/** Which step a fragment goes to: rules to arbitration, ambiance to the narrator, facts to both. */
export const LORE_KINDS = ['rule', 'ambiance', 'fact'] as const
export type LoreKind = (typeof LORE_KINDS)[number]

/** A lore fragment of a world, or of one of its scenarios, overriding the world's. */
export type LoreFragment = {
  id: string
  worldId: string
  scenarioId: string | null
  reference: string
  kind: LoreKind
  content: string
  /** References of places, people or items; none: sent with every turn. */
  tags: string[]
  secret: boolean
  updatedAt: string | null
}

export const loreQuery = (level: Level) =>
  queryOptions({
    queryKey: ['catalogue', pathOf(level), 'lore'],
    queryFn: async () => (await api<{ data: LoreFragment[] }>(`${pathOf(level)}/lore`)).data,
  })

export async function createFragment(
  level: Level,
  payload: Record<string, unknown>
): Promise<LoreFragment> {
  return (
    await api<{ data: LoreFragment }>(`${pathOf(level)}/lore`, { method: 'POST', body: payload })
  ).data
}

export async function updateFragment(
  id: string,
  payload: Record<string, unknown>
): Promise<LoreFragment> {
  return (await api<{ data: LoreFragment }>(`/admin/lore/${id}`, { method: 'PATCH', body: payload }))
    .data
}

export async function deleteFragment(id: string): Promise<void> {
  await api(`/admin/lore/${id}`, { method: 'DELETE' })
}
