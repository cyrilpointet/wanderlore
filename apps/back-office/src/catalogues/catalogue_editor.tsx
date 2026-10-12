import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FormAlert } from '@/content/field'
import { formFailureOf, type FormFailure } from '@/content/form_errors'
import { DANGER, PRIMARY, SECONDARY, SECTION } from '@/content/ui'
import { definitionDraftOf, definitionPayloadOf, emptyDefinitionDraft } from './definition_draft'
import { type ClosedLists, DefinitionForm } from './definition_form'
import {
  type Catalogue,
  type Definition,
  type Level,
  catalogueQuery,
  createDefinition,
  deleteDefinition,
  updateDefinition,
} from './queries'

/**
 * One catalogue of a world, or of one of its scenarios. At scenario level, a
 * definition sharing the reference of a world one overrides it: the list says
 * so.
 */
export function CatalogueEditor({
  catalogue,
  level,
  worldId,
}: {
  catalogue: Catalogue
  level: Level
  /** The world of the level, whose unique people and places may be named. */
  worldId: string
}) {
  const { t } = useTranslation('catalogues')
  const [adding, setAdding] = useState(false)
  const atScenario = 'scenarioId' in level

  const definitions = useQuery(catalogueQuery(level, catalogue))
  const worldDefinitions = useQuery({ ...catalogueQuery({ worldId }, catalogue), enabled: atScenario })
  const lists = useClosedLists(level, worldId)

  if (definitions.isPending || lists === null) {
    return <p className="text-body text-muted">{t('loading', { ns: 'content' })}</p>
  }

  if (definitions.isError) {
    return <FormAlert message={formFailureOf(definitions.error).general ?? ''} />
  }

  const overridden = new Set(
    atScenario ? (worldDefinitions.data ?? []).map(({ reference }) => reference) : []
  )

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-muted">{t(`intro.${catalogue}`)}</p>
      {adding ? (
        <section className={SECTION}>
          <DefinitionEditor
            catalogue={catalogue}
            level={level}
            lists={lists}
            onDone={() => setAdding(false)}
          />
        </section>
      ) : (
        <div>
          <button type="button" onClick={() => setAdding(true)} className={SECONDARY}>
            <Plus aria-hidden className="size-4" />
            {t(`add.${catalogue}`)}
          </button>
        </div>
      )}
      {definitions.data.length === 0 && !adding && (
        <p className="text-body text-muted">{t('empty')}</p>
      )}
      {definitions.data.map((definition) => (
        <details key={definition.id} className={`${SECTION} group`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate font-serif text-[1.0625rem] text-text">
                {definition.labels.en}
              </span>
              <span className="block truncate font-mono text-label text-subtle">
                {definition.reference}
              </span>
            </span>
            <span className="flex shrink-0 gap-2">
              {overridden.has(definition.reference) && <Badge>{t('overrides')}</Badge>}
              <Badge>{t(`kinds.${definition.kind}`)}</Badge>
            </span>
          </summary>
          <div className="mt-4">
            <DefinitionEditor
              catalogue={catalogue}
              level={level}
              lists={lists}
              definition={definition}
            />
          </div>
        </details>
      ))}
    </div>
  )
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-sm border border-border-strong bg-surface-2 px-2 py-0.5 text-meta text-muted uppercase">
      {children}
    </span>
  )
}

/**
 * The unique people and places of the world, and of the scenario at that
 * level: what a parent or an initial holder may name. `null` while loading.
 */
function useClosedLists(level: Level, worldId: string): ClosedLists | null {
  const atScenario = 'scenarioId' in level
  const worldNpcs = useQuery(catalogueQuery({ worldId }, 'npcs'))
  const worldLocations = useQuery(catalogueQuery({ worldId }, 'locations'))
  const scenarioNpcs = useQuery({ ...catalogueQuery(level, 'npcs'), enabled: atScenario })
  const scenarioLocations = useQuery({ ...catalogueQuery(level, 'locations'), enabled: atScenario })

  if (!worldNpcs.data || !worldLocations.data) return null

  const uniques = (...lists: (Definition[] | undefined)[]) => [
    ...new Set(
      lists
        .flatMap((list) => list ?? [])
        .filter(({ kind }) => kind === 'unique')
        .map(({ reference }) => reference)
    ),
  ]

  return {
    uniqueNpcs: uniques(worldNpcs.data, atScenario ? scenarioNpcs.data : undefined),
    uniqueLocations: uniques(worldLocations.data, atScenario ? scenarioLocations.data : undefined),
  }
}

/** A definition being edited — or created, when none is given — saved on its own. */
function DefinitionEditor({
  catalogue,
  level,
  lists,
  definition,
  onDone,
}: {
  catalogue: Catalogue
  level: Level
  lists: ClosedLists
  definition?: Definition
  onDone?: () => void
}) {
  const { t } = useTranslation('content')
  const queryClient = useQueryClient()
  const creating = definition === undefined
  const [draft, setDraft] = useState(() =>
    definition ? definitionDraftOf(definition) : emptyDefinitionDraft()
  )
  const [failure, setFailure] = useState<FormFailure | null>(null)
  const [confirming, setConfirming] = useState(false)

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: catalogueQuery(level, catalogue).queryKey })

  const save = useMutation({
    mutationFn: async () => {
      const built = definitionPayloadOf(catalogue, draft, { creating })

      if (built.errors) {
        throw new DraftError(built.errors)
      }

      return definition
        ? updateDefinition(catalogue, definition.id, built.payload)
        : createDefinition(level, catalogue, built.payload)
    },
    onMutate: () => setFailure(null),
    onSuccess: async () => {
      await refresh()
      onDone?.()
    },
    onError: (error) =>
      setFailure(
        error instanceof DraftError ? { fields: error.fields, general: null } : formFailureOf(error)
      ),
  })

  const remove = useMutation({
    mutationFn: () => deleteDefinition(catalogue, definition!.id),
    onMutate: () => setFailure(null),
    onSuccess: refresh,
    onError: (error) => setFailure(formFailureOf(error)),
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
      className="flex flex-col gap-4"
    >
      <DefinitionForm
        catalogue={catalogue}
        draft={draft}
        onChange={setDraft}
        errors={failure?.fields ?? {}}
        idPrefix={definition?.id ?? `new-${catalogue}`}
        creating={creating}
        lists={lists}
      />
      {failure?.general && <FormAlert message={failure.general} />}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={save.isPending} className={PRIMARY}>
          {save.isPending ? t('saving') : t('save')}
        </button>
        {creating ? (
          <button type="button" onClick={onDone} className={SECONDARY}>
            {t('cancel')}
          </button>
        ) : confirming ? (
          <>
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className={DANGER}
            >
              <Trash2 aria-hidden className="size-4" />
              {remove.isPending ? t('deleting') : t('confirmDelete')}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={SECONDARY}>
              {t('cancel')}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={DANGER}>
            <Trash2 aria-hidden className="size-4" />
            {t('delete')}
          </button>
        )}
      </div>
    </form>
  )
}

/** A draft refused before it was sent: JSON that does not parse. */
class DraftError extends Error {
  constructor(readonly fields: Record<string, string>) {
    super('The draft cannot be sent as it is.')
  }
}
