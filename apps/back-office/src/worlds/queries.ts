import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'

/** Names by language code; English is always there. */
export type Labels = { en: string } & Record<string, string>

/** A world as the back-office lists it. Shapes mirror the backend transformers. */
export type WorldSummary = {
  id: string
  reference: string
  labels: Labels
  scenarioCount: number
  updatedAt: string | null
}

/** The worlds of the game, sorted by reference by the backend. */
export const worldsQuery = queryOptions({
  queryKey: ['worlds'],
  queryFn: async () => (await api<{ data: WorldSummary[] }>('/admin/worlds')).data,
})
