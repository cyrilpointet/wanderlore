import { queryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'
import type { Labels } from '@/content/labels'

/** An item a game starts with: a definition by reference, as many as given, worn or not. */
export type StartingItem = {
  definition: string
  descriptor: string | null
  quantity: number
  equipped: boolean
}

/**
 * A profession of a world, which a player picks for their character: the
 * skills it trains, and what it starts a game with. At world level only: no
 * scenario overrides a profession.
 */
export type Profession = {
  id: string
  worldId: string
  reference: string
  labels: Labels
  /** One line of English, shown to the player who picks it. */
  description: string
  /** References of the world's skills. */
  skills: string[]
  startingItems: StartingItem[]
  /** By reference of the world's resources. */
  startingResources: Record<string, number>
  updatedAt: string | null
}

/**
 * A profession as it is sent: everything but its id, the reference only on
 * creation. Its equipment and resources go as the JSON written, for the
 * backend to judge field by field.
 */
export type ProfessionPayload = Omit<
  Profession,
  'id' | 'worldId' | 'updatedAt' | 'startingItems' | 'startingResources'
> & { startingItems: unknown; startingResources: unknown }

export const professionsQuery = (worldId: string) =>
  queryOptions({
    queryKey: ['worlds', worldId, 'professions'],
    queryFn: async () =>
      (await api<{ data: Profession[] }>(`/admin/worlds/${worldId}/professions`)).data,
  })

export async function createProfession(
  worldId: string,
  payload: ProfessionPayload
): Promise<Profession> {
  return (
    await api<{ data: Profession }>(`/admin/worlds/${worldId}/professions`, {
      method: 'POST',
      body: payload,
    })
  ).data
}

export async function updateProfession(
  id: string,
  payload: Omit<ProfessionPayload, 'reference'>
): Promise<Profession> {
  return (
    await api<{ data: Profession }>(`/admin/professions/${id}`, { method: 'PATCH', body: payload })
  ).data
}

export async function deleteProfession(id: string): Promise<void> {
  await api(`/admin/professions/${id}`, { method: 'DELETE' })
}
