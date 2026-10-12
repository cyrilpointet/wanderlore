import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ActionTypesEditor } from '@/worlds/action_types_editor'
import { actionTypesQuery, worldQuery } from '@/worlds/queries'

export const Route = createFileRoute('/_authenticated/worlds/$worldId/action-types')({
  loader: ({ context: { queryClient }, params: { worldId } }) =>
    queryClient.ensureQueryData(actionTypesQuery(worldId)),
  component: ActionTypes,
})

function ActionTypes() {
  const { t } = useTranslation('worlds')
  const { worldId } = Route.useParams()
  const { data: world } = useSuspenseQuery(worldQuery(worldId))
  const { data: actionTypes } = useSuspenseQuery(actionTypesQuery(worldId))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-muted">{t('actionTypes.intro')}</p>
      <ActionTypesEditor
        worldId={worldId}
        actionTypes={actionTypes}
        skills={world.skills.map(({ reference }) => reference)}
      />
    </div>
  )
}
