import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { LoreEditor } from '@/lore/lore_editor'
import { scenarioQuery } from '@/scenarios/queries'

export const Route = createFileRoute('/_authenticated/scenarios/$scenarioId/lore')({
  component: Lore,
})

/** The scenario's own lore, added to the world's or replacing it. */
function Lore() {
  const { scenarioId } = Route.useParams()
  const { data: scenario } = useSuspenseQuery(scenarioQuery(scenarioId))

  return <LoreEditor level={{ scenarioId }} worldId={scenario.worldId} />
}
