import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/client'
import { FormAlert } from '@/content/field'
import { formFailureOf, type FieldErrors, type FormFailure } from '@/content/form_errors'
import { DANGER, PRIMARY, SECONDARY, SECTION } from '@/content/ui'
import { emptyProfessionDraft, professionDraftOf, professionPayloadOf } from './profession_draft'
import { ProfessionForm, type SkillChoice } from './profession_form'
import {
  type Profession,
  createProfession,
  deleteProfession,
  professionsQuery,
  updateProfession,
} from './queries'

/**
 * The professions of a world, which a player picks for their character. Each
 * is edited and saved on its own; one a character follows cannot be removed.
 */
export function ProfessionsEditor({
  worldId,
  professions,
  skills,
}: {
  worldId: string
  professions: Profession[]
  skills: SkillChoice[]
}) {
  const { t } = useTranslation('professions')
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-muted">{t('intro')}</p>
      {adding ? (
        <section className={SECTION}>
          <ProfessionEditor worldId={worldId} skills={skills} onDone={() => setAdding(false)} />
        </section>
      ) : (
        <div>
          <button type="button" onClick={() => setAdding(true)} className={SECONDARY}>
            <Plus aria-hidden className="size-4" />
            {t('add')}
          </button>
        </div>
      )}
      {professions.length === 0 && !adding && (
        <p className="text-body text-muted">{t('empty')}</p>
      )}
      {professions.map((profession) => (
        <details key={profession.id} className={`${SECTION} group`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate font-serif text-[1.0625rem] text-text">
                {profession.labels.en}
              </span>
              <span className="block truncate font-mono text-label text-subtle">
                {profession.reference}
              </span>
            </span>
            <span className="shrink-0 rounded-sm border border-border-strong bg-surface-2 px-2 py-0.5 text-meta text-muted uppercase">
              {t('skillCount', { count: profession.skills.length })}
            </span>
          </summary>
          <div className="mt-4">
            <ProfessionEditor worldId={worldId} skills={skills} profession={profession} />
          </div>
        </details>
      ))}
    </div>
  )
}

/** A profession being edited — or created, when none is given — saved on its own. */
function ProfessionEditor({
  worldId,
  skills,
  profession,
  onDone,
}: {
  worldId: string
  skills: SkillChoice[]
  profession?: Profession
  onDone?: () => void
}) {
  const { t } = useTranslation('content')
  const { t: tProfessions } = useTranslation('professions')
  const queryClient = useQueryClient()
  const creating = profession === undefined
  const [draft, setDraft] = useState(() =>
    profession ? professionDraftOf(profession) : emptyProfessionDraft()
  )
  const [failure, setFailure] = useState<FormFailure | null>(null)
  const [confirming, setConfirming] = useState(false)

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: professionsQuery(worldId).queryKey })

  const save = useMutation({
    mutationFn: async () => {
      const built = professionPayloadOf(draft, { creating })

      if (built.errors) {
        throw new DraftError(built.errors)
      }

      return profession
        ? updateProfession(profession.id, built.payload)
        : createProfession(worldId, { ...built.payload, reference: built.payload.reference ?? '' })
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
    mutationFn: () => deleteProfession(profession!.id),
    onMutate: () => setFailure(null),
    onSuccess: refresh,
    onError: (error) =>
      setFailure(
        // A profession is in use by characters, not by games: said in its own words.
        error instanceof ApiError && error.code === 'content_in_use'
          ? { fields: {}, general: tProfessions('inUse') }
          : formFailureOf(error)
      ),
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
      className="flex flex-col gap-4"
    >
      <ProfessionForm
        draft={draft}
        onChange={setDraft}
        errors={failure?.fields ?? {}}
        idPrefix={profession?.id ?? NEW_PROFESSION}
        creating={creating}
        skills={skills}
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

/** The ids of the fields of a profession being added, which has no id of its own yet. */
const NEW_PROFESSION = 'new-profession'

/** A draft refused before it was sent: JSON that does not parse. */
class DraftError extends Error {
  constructor(readonly fields: FieldErrors) {
    super('The draft cannot be sent as it is.')
  }
}
