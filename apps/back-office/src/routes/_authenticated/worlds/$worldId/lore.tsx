import { createFileRoute } from '@tanstack/react-router'

import { LoreEditor } from '@/lore/lore_editor'

export const Route = createFileRoute('/_authenticated/worlds/$worldId/lore')({
  component: Lore,
})

/** The world's lore; a scenario's own is edited with the scenario. */
function Lore() {
  const { worldId } = Route.useParams()

  return <LoreEditor level={{ worldId }} worldId={worldId} />
}
