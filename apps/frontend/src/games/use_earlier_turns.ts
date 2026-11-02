import { useMutation, useQueryClient } from '@tanstack/react-query'

import { earliestTurnNumber, withEarlier } from './journal_pages'
import { turnsPage, turnsQuery } from './queries'

/**
 * Loads the page of the story before the turns already loaded, and puts it in
 * front of them. The story only ever grows: a page is never dropped.
 */
export function useEarlierTurns(gameId: string) {
  const queryClient = useQueryClient()
  const { queryKey } = turnsQuery(gameId)

  const earlier = useMutation({
    mutationFn: () => {
      const journal = queryClient.getQueryData(queryKey)
      return turnsPage(gameId, journal && earliestTurnNumber(journal))
    },
    onSuccess: (page) =>
      queryClient.setQueryData(queryKey, (journal) => journal && withEarlier(journal, page)),
  })

  return {
    loadEarlier: () => earlier.mutate(),
    loading: earlier.isPending,
    error: earlier.error,
  }
}
