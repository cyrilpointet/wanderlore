import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { previewCharacter, type DraftBody, type Preview } from '../queries'
import { draftBody, type Draft } from './draft'

/** How long the draft has to stay still before it is sent: a burst of typing sends once. */
export const PREVIEW_DELAY_MS = 300

/**
 * The sheet the draft makes, computed by the backend: every value the
 * creation shows comes from here, never from the front. The draft is sent a
 * short while after it last changed; the last answer stays on screen
 * meanwhile, flagged as not yet current.
 *
 * Keyed by the series too: the backend computes on the player's current
 * series, and a reroll changes the sheet even when the draft does not.
 */
export function usePreview(worldId: string, draft: Draft) {
  const key = JSON.stringify({ roll: draft.roll?.id ?? null, body: draftBody(worldId, draft) })
  const [settled, setSettled] = useState(key)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(key), PREVIEW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [key])

  const query = useQuery({
    queryKey: ['creation-preview', settled],
    queryFn: ({ signal }) =>
      previewCharacter((JSON.parse(settled) as { body: DraftBody }).body, signal),
    // Nothing to compute before a series is drawn.
    enabled: draft.roll !== null,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  })

  const preview: Preview | null = draft.roll === null ? null : (query.data ?? null)

  return {
    preview,
    /** The preview answers the draft as it stands: what the step decides on is up to date. */
    current: settled === key && query.isSuccess && !query.isPlaceholderData,
    error: query.isError ? query.error : null,
    retrying: query.isFetching,
    retry: () => void query.refetch(),
  }
}
