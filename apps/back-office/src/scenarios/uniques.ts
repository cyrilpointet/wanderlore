import { useQuery } from '@tanstack/react-query'

import { catalogueQuery } from '@/catalogues/queries'

/**
 * The named places, or people, of a world and of one of its scenarios — of
 * the world alone for a scenario not created yet.
 */
export function useUniques(
  { worldId, scenarioId }: { worldId: string; scenarioId?: string },
  catalogue: 'locations' | 'npcs'
): string[] {
  const world = useQuery(catalogueQuery({ worldId }, catalogue))
  const own = useQuery({
    ...catalogueQuery({ scenarioId: scenarioId ?? '' }, catalogue),
    enabled: scenarioId !== undefined,
  })

  return [
    ...new Set(
      [...(world.data ?? []), ...(own.data ?? [])]
        .filter(({ kind }) => kind === 'unique')
        .map(({ reference }) => reference)
    ),
  ]
}
