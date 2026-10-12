import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { CatalogueEditor } from '@/catalogues/catalogue_editor'
import { scenarioQuery } from '@/scenarios/queries'

export const Route = createFileRoute('/_authenticated/scenarios/$scenarioId/items')({
  component: Catalogue,
})

/** The scenario's own definitions, added to the world's or replacing them. */
function Catalogue() {
  const { t } = useTranslation('scenarios')
  const { scenarioId } = Route.useParams()
  const { data: scenario } = useSuspenseQuery(scenarioQuery(scenarioId))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-label text-muted">{t('catalogueHint')}</p>
      <CatalogueEditor catalogue="items" level={{ scenarioId }} worldId={scenario.worldId} />
    </div>
  )
}
