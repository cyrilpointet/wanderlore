import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { type Definition, type Level, catalogueQuery } from '@/catalogues/queries'
import { FormAlert } from '@/content/field'
import { formFailureOf, type FormFailure } from '@/content/form_errors'
import { DANGER, PRIMARY, SECONDARY, SECTION } from '@/content/ui'
import { emptyLoreDraft, loreDraftOf, lorePayloadOf } from './lore_draft'
import { LoreForm, type TagLists } from './lore_form'
import {
  type LoreFragment,
  createFragment,
  deleteFragment,
  loreQuery,
  updateFragment,
} from './queries'

/**
 * The lore of a world, or of one of its scenarios. At scenario level, a
 * fragment sharing the reference of a world one replaces it: the list says so.
 */
export function LoreEditor({ level, worldId }: { level: Level; worldId: string }) {
  const { t } = useTranslation('lore')
  const [adding, setAdding] = useState(false)
  const atScenario = 'scenarioId' in level

  const fragments = useQuery(loreQuery(level))
  const worldFragments = useQuery({ ...loreQuery({ worldId }), enabled: atScenario })
  const tags = useTagLists(level, worldId)

  if (fragments.isPending || tags === null) {
    return <p className="text-body text-muted">{t('loading', { ns: 'content' })}</p>
  }

  if (fragments.isError) {
    return <FormAlert message={formFailureOf(fragments.error).general ?? ''} />
  }

  const overridden = new Set(
    atScenario ? (worldFragments.data ?? []).map(({ reference }) => reference) : []
  )

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-muted">{t(atScenario ? 'scenarioIntro' : 'intro')}</p>
      {adding ? (
        <section className={SECTION}>
          <FragmentEditor level={level} tags={tags} onDone={() => setAdding(false)} />
        </section>
      ) : (
        <div>
          <button type="button" onClick={() => setAdding(true)} className={SECONDARY}>
            <Plus aria-hidden className="size-4" />
            {t('add')}
          </button>
        </div>
      )}
      {fragments.data.length === 0 && !adding && (
        <p className="text-body text-muted">{t('empty')}</p>
      )}
      {fragments.data.map((fragment) => (
        <details key={fragment.id} className={`${SECTION} group`}>
          <FragmentSummary fragment={fragment} overrides={overridden.has(fragment.reference)} />
          <div className="mt-4">
            <FragmentEditor level={level} tags={tags} fragment={fragment} />
          </div>
        </details>
      ))}
    </div>
  )
}

/** A fragment folded: what it says, its reference, and how it is sent. */
export function FragmentSummary({
  fragment,
  overrides,
}: {
  fragment: LoreFragment
  overrides: boolean
}) {
  const { t } = useTranslation('lore')

  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block truncate text-body text-text">{fragment.content}</span>
        <span className="block truncate font-mono text-label text-subtle">
          {fragment.reference}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap justify-end gap-2">
        {overrides && <Badge>{t('overrides')}</Badge>}
        {fragment.secret && <Badge>{t('secretBadge')}</Badge>}
        <Badge>
          {fragment.tags.length === 0
            ? t('always')
            : t('taggedWith', { count: fragment.tags.length })}
        </Badge>
        <Badge>{t(`kinds.${fragment.kind}`)}</Badge>
      </span>
    </summary>
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
 * Every place, person and item of the world, and of the scenario at that
 * level, by reference: what a fragment may be tagged with. `null` while
 * loading.
 */
function useTagLists(level: Level, worldId: string): TagLists | null {
  const atScenario = 'scenarioId' in level
  const world = {
    places: useQuery(catalogueQuery({ worldId }, 'locations')),
    people: useQuery(catalogueQuery({ worldId }, 'npcs')),
    items: useQuery(catalogueQuery({ worldId }, 'items')),
  }
  const own = {
    places: useQuery({ ...catalogueQuery(level, 'locations'), enabled: atScenario }),
    people: useQuery({ ...catalogueQuery(level, 'npcs'), enabled: atScenario }),
    items: useQuery({ ...catalogueQuery(level, 'items'), enabled: atScenario }),
  }

  if (!world.places.data || !world.people.data || !world.items.data) return null

  const references = (...lists: (Definition[] | undefined)[]) =>
    [...new Set(lists.flatMap((list) => list ?? []).map(({ reference }) => reference))].sort()

  return {
    places: references(world.places.data, atScenario ? own.places.data : undefined),
    people: references(world.people.data, atScenario ? own.people.data : undefined),
    items: references(world.items.data, atScenario ? own.items.data : undefined),
  }
}

/** The ids of the form of a fragment not created yet. */
const NEW_FRAGMENT = 'new-fragment'

/** A fragment being edited — or created, when none is given — saved on its own. */
function FragmentEditor({
  level,
  tags,
  fragment,
  onDone,
}: {
  level: Level
  tags: TagLists
  fragment?: LoreFragment
  onDone?: () => void
}) {
  const { t } = useTranslation('content')
  const queryClient = useQueryClient()
  const creating = fragment === undefined
  const [draft, setDraft] = useState(() => (fragment ? loreDraftOf(fragment) : emptyLoreDraft()))
  const [failure, setFailure] = useState<FormFailure | null>(null)
  const [confirming, setConfirming] = useState(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: loreQuery(level).queryKey })

  const save = useMutation({
    mutationFn: () => {
      const payload = lorePayloadOf(draft, { creating })

      return fragment ? updateFragment(fragment.id, payload) : createFragment(level, payload)
    },
    onMutate: () => setFailure(null),
    onSuccess: async () => {
      await refresh()
      onDone?.()
    },
    onError: (error) => setFailure(formFailureOf(error)),
  })

  const remove = useMutation({
    mutationFn: () => deleteFragment(fragment!.id),
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
      <LoreForm
        draft={draft}
        onChange={setDraft}
        errors={failure?.fields ?? {}}
        idPrefix={fragment?.id ?? NEW_FRAGMENT}
        creating={creating}
        tags={tags}
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
