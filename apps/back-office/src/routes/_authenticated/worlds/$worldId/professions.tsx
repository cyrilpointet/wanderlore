import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { ProfessionsEditor } from '@/professions/professions_editor'
import { professionsQuery } from '@/professions/queries'
import { worldQuery } from '@/worlds/queries'

export const Route = createFileRoute('/_authenticated/worlds/$worldId/professions')({
  loader: ({ context: { queryClient }, params: { worldId } }) =>
    queryClient.ensureQueryData(professionsQuery(worldId)),
  component: Professions,
})

/** The professions of the world: no scenario has any of its own. */
function Professions() {
  const { worldId } = Route.useParams()
  const { data: world } = useSuspenseQuery(worldQuery(worldId))
  const { data: professions } = useSuspenseQuery(professionsQuery(worldId))

  return (
    <ProfessionsEditor
      worldId={worldId}
      professions={professions}
      skills={world.skills.map(({ reference, labels }) => ({ reference, name: labels.en }))}
    />
  )
}
