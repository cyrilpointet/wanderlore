import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Field, FormAlert } from '@/content/field'
import { errorUnder, formFailureOf, type FormFailure } from '@/content/form_errors'
import { labelsOf, type LabelRow } from '@/content/labels'
import { LabelsEditor } from '@/content/labels_editor'
import { suggestReference } from '@/content/references'
import { INPUT, PRIMARY, SECTION } from '@/content/ui'
import { createScenario, scenarioQuery, scenariosQuery } from '@/scenarios/queries'
import { worldsQuery } from '@/worlds/queries'

export const Route = createFileRoute('/_authenticated/worlds/$worldId/scenarios')({
  loader: ({ context: { queryClient }, params: { worldId } }) =>
    queryClient.ensureQueryData(scenariosQuery(worldId)),
  component: Scenarios,
})

function Scenarios() {
  const { t } = useTranslation('scenarios')
  const { worldId } = Route.useParams()
  const { data: scenarios } = useSuspenseQuery(scenariosQuery(worldId))

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body text-muted">{t('intro')}</p>
      {scenarios.length === 0 ? (
        <p className="text-body text-muted">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {scenarios.map((scenario) => (
            <li key={scenario.id}>
              <Link
                to="/scenarios/$scenarioId"
                params={{ scenarioId: scenario.id }}
                className="flex items-center justify-between gap-4 rounded-lg border border-border-strong bg-surface-1 px-5 py-4 transition-colors hover:border-accent/60"
              >
                <span className="min-w-0">
                  <span className="block truncate font-serif text-[1.125rem] text-text">
                    {scenario.labels.en}
                  </span>
                  <span className="block truncate font-mono text-label text-subtle">
                    {scenario.reference}
                  </span>
                </span>
                <span className="shrink-0 rounded-sm border border-border-strong bg-surface-2 px-2 py-0.5 text-meta text-muted uppercase">
                  {t(`statuses.${scenario.status}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewScenario worldId={worldId} />
    </div>
  )
}

/** A new scenario: its reference and title; everything else in its editor. */
function NewScenario({ worldId }: { worldId: string }) {
  const { t } = useTranslation('scenarios')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [reference, setReference] = useState('')
  const [labels, setLabels] = useState<LabelRow[]>([{ language: 'en', name: '' }])
  const [failure, setFailure] = useState<FormFailure | null>(null)
  const englishName = labels[0]?.name ?? ''

  const create = useMutation({
    mutationFn: () =>
      createScenario(worldId, { reference: reference.trim(), labels: labelsOf(labels) }),
    onMutate: () => setFailure(null),
    onSuccess: async (scenario) => {
      queryClient.setQueryData(scenarioQuery(scenario.id).queryKey, scenario)
      void queryClient.invalidateQueries({ queryKey: scenariosQuery(worldId).queryKey })
      void queryClient.invalidateQueries({ queryKey: worldsQuery.queryKey, exact: true })
      await navigate({ to: '/scenarios/$scenarioId', params: { scenarioId: scenario.id } })
    },
    onError: (error) => setFailure(formFailureOf(error)),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  const errors = failure?.fields ?? {}
  const labelsError = errorUnder(errors, 'labels')

  return (
    <form onSubmit={submit} className={`${SECTION} flex flex-col gap-4`}>
      <h2 className="font-serif text-[1.25rem] text-text">{t('newScenario')}</h2>
      <LabelsEditor rows={labels} onChange={setLabels} error={labelsError} label={t('form.title')} />
      <Field
        id="new-scenario-reference"
        label={t('form.reference')}
        hint={t('referenceHint', { ns: 'content' })}
        error={errors.reference}
      >
        <input
          id="new-scenario-reference"
          value={reference}
          placeholder={suggestReference(englishName)}
          onChange={(event) => setReference(event.target.value)}
          onBlur={() => {
            if (reference === '' && englishName !== '') setReference(suggestReference(englishName))
          }}
          className={`${INPUT} font-mono`}
        />
      </Field>
      {failure?.general && <FormAlert message={failure.general} />}
      <div>
        <button type="submit" disabled={create.isPending} className={PRIMARY}>
          {create.isPending ? t('creating') : t('create')}
        </button>
      </div>
    </form>
  )
}
