import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CircleCheck, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { catalogueQuery } from '@/catalogues/queries'
import { FormAlert } from '@/content/field'
import { formFailureOf, type FormFailure } from '@/content/form_errors'
import { DANGER, PRIMARY, SECTION } from '@/content/ui'
import { Publication } from '@/scenarios/publication'
import {
  deleteScenario,
  type Scenario,
  scenarioQuery,
  scenariosQuery,
  updateScenario,
} from '@/scenarios/queries'
import { scenarioDraftOf, scenarioUpdateOf } from '@/scenarios/scenario_draft'
import { ScenarioForm } from '@/scenarios/scenario_form'
import { worldsQuery } from '@/worlds/queries'

export const Route = createFileRoute('/_authenticated/scenarios/$scenarioId/')({
  component: ScenarioEditor,
})

function ScenarioEditor() {
  const { scenarioId } = Route.useParams()
  const { data: scenario } = useSuspenseQuery(scenarioQuery(scenarioId))

  return (
    <div className="flex flex-col gap-8">
      <Publication scenario={scenario} />
      {/* Keyed on the saved version: a save starts the form over from what the backend kept. */}
      <ScenarioEditorForm key={scenario.updatedAt ?? scenario.id} scenario={scenario} />
      <DeleteScenario scenario={scenario} />
    </div>
  )
}

function ScenarioEditorForm({ scenario }: { scenario: Scenario }) {
  const { t } = useTranslation('scenarios')
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(() => scenarioDraftOf(scenario))
  const [failure, setFailure] = useState<FormFailure | null>(null)
  const [saved, setSaved] = useState(false)
  const uniqueLocations = useUniqueLocations(scenario)

  const save = useMutation({
    mutationFn: () => {
      const built = scenarioUpdateOf(draft)

      if (built.errors) {
        setFailure({ fields: built.errors, general: null })
        return Promise.resolve(null)
      }

      return updateScenario(scenario.id, built.payload)
    },
    onMutate: () => {
      setFailure(null)
      setSaved(false)
    },
    onSuccess: (updated) => {
      if (!updated) return
      queryClient.setQueryData(scenarioQuery(scenario.id).queryKey, updated)
      void queryClient.invalidateQueries({ queryKey: scenariosQuery(scenario.worldId).queryKey })
      setSaved(true)
    },
    onError: (error) => setFailure(formFailureOf(error)),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <ScenarioForm
        reference={scenario.reference}
        draft={draft}
        onChange={(next) => {
          setDraft(next)
          setSaved(false)
        }}
        errors={failure?.fields ?? {}}
        uniqueLocations={uniqueLocations}
      />
      {failure?.general && <FormAlert message={failure.general} />}
      {failure && !failure.general && Object.keys(failure.fields).length > 0 && (
        <FormAlert message={t('fixErrors', { ns: 'worlds' })} />
      )}
      <div className="sticky bottom-4 flex items-center gap-3">
        <button type="submit" disabled={save.isPending} className={PRIMARY}>
          {save.isPending ? t('saving', { ns: 'content' }) : t('save', { ns: 'content' })}
        </button>
        {saved && (
          <span role="status" className="flex items-center gap-1.5 text-label text-success">
            <CircleCheck aria-hidden className="size-4" />
            {t('saved', { ns: 'content' })}
          </span>
        )}
      </div>
    </form>
  )
}

/** The named places a game of this scenario may start in: the world's and its own. */
function useUniqueLocations(scenario: Scenario): string[] {
  const world = useQuery(catalogueQuery({ worldId: scenario.worldId }, 'locations'))
  const own = useQuery(catalogueQuery({ scenarioId: scenario.id }, 'locations'))

  return [
    ...new Set(
      [...(world.data ?? []), ...(own.data ?? [])]
        .filter(({ kind }) => kind === 'unique')
        .map(({ reference }) => reference)
    ),
  ]
}

/** Only a scenario no game was started from: the backend refuses the others. */
function DeleteScenario({ scenario }: { scenario: Scenario }) {
  const { t } = useTranslation('scenarios')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  const remove = useMutation({
    mutationFn: () => deleteScenario(scenario.id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: scenarioQuery(scenario.id).queryKey })
      await queryClient.invalidateQueries({ queryKey: scenariosQuery(scenario.worldId).queryKey })
      void queryClient.invalidateQueries({ queryKey: worldsQuery.queryKey, exact: true })
      await navigate({ to: '/worlds/$worldId/scenarios', params: { worldId: scenario.worldId } })
    },
  })

  return (
    <section className={`${SECTION} flex flex-col gap-3`}>
      <p className="text-label text-muted">{t('deleteScenarioHint')}</p>
      {remove.error && <FormAlert message={formFailureOf(remove.error).general ?? ''} />}
      <div className="flex gap-2">
        {confirming ? (
          <>
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className={DANGER}
            >
              <Trash2 aria-hidden className="size-4" />
              {remove.isPending
                ? t('deleting', { ns: 'content' })
                : t('confirmDelete', { ns: 'content' })}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={DANGER}>
              {t('cancel', { ns: 'content' })}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={DANGER}>
            <Trash2 aria-hidden className="size-4" />
            {t('deleteScenario')}
          </button>
        )}
      </div>
    </section>
  )
}
