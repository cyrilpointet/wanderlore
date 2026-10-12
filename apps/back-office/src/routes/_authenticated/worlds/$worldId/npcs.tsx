import { createFileRoute } from '@tanstack/react-router'

import { CatalogueEditor } from '@/catalogues/catalogue_editor'

export const Route = createFileRoute('/_authenticated/worlds/$worldId/npcs')({
  component: Catalogue,
})

/** The world-level catalogue; a scenario's own definitions are edited with the scenario. */
function Catalogue() {
  const { worldId } = Route.useParams()

  return <CatalogueEditor catalogue="npcs" level={{ worldId }} worldId={worldId} />
}
