import { useState, type ComponentProps, type FormEvent } from 'react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { CatalogueSummary } from '@/content/catalogue_summary'
import { Field, FormAlert } from '@/content/field'
import { errorUnder, formFailureOf, type FormFailure } from '@/content/form_errors'
import {
  type ImportedCatalogues,
  cataloguesOf,
  importedUniques,
  noCatalogues,
} from '@/content/imports'
import { JsonImport } from '@/content/json_import'
import { labelsOf, type LabelRow } from '@/content/labels'
import { LabelsEditor } from '@/content/labels_editor'
import { suggestReference } from '@/content/references'
import { INPUT, PRIMARY, SECTION } from '@/content/ui'
import { createScenario, scenarioQuery, scenariosQuery } from '@/scenarios/queries'
import {
  type ScenarioDraft,
  scenarioDraftFromJson,
  scenarioUpdateOf,
} from '@/scenarios/scenario_draft'
import { ScenarioForm } from '@/scenarios/scenario_form'
import { useUniques } from '@/scenarios/uniques'
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

/**
 * A new scenario: its reference and title; everything else in its editor. A
 * scenario filled in from a file shows its whole form at once, with the
 * catalogues and lore it carries, to be checked before it is all created.
 */
function NewScenario({ worldId }: { worldId: string }) {
  const { t } = useTranslation('scenarios')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [reference, setReference] = useState('')
  const [labels, setLabels] = useState<LabelRow[]>([{ language: 'en', name: '' }])
  const [imported, setImported] = useState<ScenarioDraft | null>(null)
  const [catalogues, setCatalogues] = useState<ImportedCatalogues>(noCatalogues)
  const [failure, setFailure] = useState<FormFailure | null>(null)
  const englishName = labels[0]?.name ?? ''

  const create = useMutation({
    mutationFn: () => {
      if (imported === null) {
        return createScenario(worldId, { reference: reference.trim(), labels: labelsOf(labels) })
      }

      const built = scenarioUpdateOf(imported)

      if (built.errors) {
        setFailure({ fields: built.errors, general: null })
        return Promise.resolve(null)
      }

      return createScenario(worldId, {
        ...built.payload,
        ...catalogues,
        reference: reference.trim(),
      })
    },
    onMutate: () => setFailure(null),
    onSuccess: async (scenario) => {
      if (!scenario) return
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
    <form
      onSubmit={submit}
      className={imported === null ? `${SECTION} flex flex-col gap-4` : 'flex flex-col gap-6'}
    >
      <h2 className="font-serif text-[1.25rem] text-text">{t('newScenario')}</h2>
      <JsonImport
        hint={t('importHint')}
        onImport={(value) => {
          const read = scenarioDraftFromJson(value)
          setReference(read.reference)
          setImported(read.draft)
          setCatalogues(cataloguesOf(value))
          setFailure(null)
        }}
      />
      {imported === null ? (
        <>
          <LabelsEditor
            rows={labels}
            onChange={setLabels}
            error={labelsError}
            label={t('form.title')}
          />
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
                if (reference === '' && englishName !== '')
                  setReference(suggestReference(englishName))
              }}
              className={`${INPUT} font-mono`}
            />
          </Field>
        </>
      ) : (
        <ImportedScenario
          worldId={worldId}
          reference={reference}
          onReferenceChange={setReference}
          draft={imported}
          onChange={setImported}
          errors={errors}
          catalogues={catalogues}
        />
      )}
      <CatalogueSummary catalogues={catalogues} errors={errors} />
      {failure?.general && <FormAlert message={failure.general} />}
      {failure && !failure.general && Object.keys(failure.fields).length > 0 && (
        <FormAlert message={t('fixErrors', { ns: 'worlds' })} />
      )}
      <div>
        <button type="submit" disabled={create.isPending} className={PRIMARY}>
          {create.isPending ? t('creating') : t('create')}
        </button>
      </div>
    </form>
  )
}

/**
 * The whole form of a scenario not created yet: its places and people are the
 * world's, and those its file brings along.
 */
function ImportedScenario({
  worldId,
  catalogues,
  ...form
}: { worldId: string; catalogues: ImportedCatalogues } & Omit<
  ComponentProps<typeof ScenarioForm>,
  'uniqueLocations' | 'uniqueNpcs'
>) {
  const worldLocations = useUniques({ worldId }, 'locations')
  const worldNpcs = useUniques({ worldId }, 'npcs')
  const uniqueLocations = [
    ...new Set([...worldLocations, ...importedUniques(catalogues.locations)]),
  ]
  const uniqueNpcs = [...new Set([...worldNpcs, ...importedUniques(catalogues.npcs)])]

  return <ScenarioForm {...form} uniqueLocations={uniqueLocations} uniqueNpcs={uniqueNpcs} />
}
