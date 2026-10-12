import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CircleCheck, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FormAlert } from '@/content/field'
import { formFailureOf, type FormFailure } from '@/content/form_errors'
import { DANGER, PRIMARY, SECTION } from '@/content/ui'
import { deleteWorld, updateWorld, worldQuery, worldsQuery, type WorldDetail } from '@/worlds/queries'
import { worldDraftOf, worldUpdateOf } from '@/worlds/world_draft'
import { WorldForm } from '@/worlds/world_form'

export const Route = createFileRoute('/_authenticated/worlds/$worldId/')({
  component: WorldEditor,
})

function WorldEditor() {
  const { worldId } = Route.useParams()
  const { data: world } = useSuspenseQuery(worldQuery(worldId))

  // Keyed on the saved version: a save starts the form over from what the backend kept.
  return <WorldEditorForm key={world.updatedAt ?? world.id} world={world} />
}

function WorldEditorForm({ world }: { world: WorldDetail }) {
  const { t } = useTranslation('worlds')
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(() => worldDraftOf(world))
  const [failure, setFailure] = useState<FormFailure | null>(null)
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: () => updateWorld(world.id, worldUpdateOf(draft)),
    onMutate: () => {
      setFailure(null)
      setSaved(false)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(worldQuery(world.id).queryKey, updated)
      void queryClient.invalidateQueries({ queryKey: worldsQuery.queryKey, exact: true })
      setSaved(true)
    },
    onError: (error) => setFailure(formFailureOf(error)),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <WorldForm
          draft={draft}
          onChange={(next) => {
            setDraft(next)
            setSaved(false)
          }}
          errors={failure?.fields ?? {}}
          creating={false}
        />
        {failure?.general && <FormAlert message={failure.general} />}
        {failure && !failure.general && Object.keys(failure.fields).length > 0 && (
          <FormAlert message={t('fixErrors')} />
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

      <DeleteWorld worldId={world.id} />
    </div>
  )
}

/** Only a world no game was ever played in: the backend refuses the others. */
function DeleteWorld({ worldId }: { worldId: string }) {
  const { t } = useTranslation('worlds')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  const remove = useMutation({
    mutationFn: () => deleteWorld(worldId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: worldQuery(worldId).queryKey })
      await queryClient.invalidateQueries({ queryKey: worldsQuery.queryKey, exact: true })
      await navigate({ to: '/worlds' })
    },
  })

  return (
    <section className={`${SECTION} flex flex-col gap-3`}>
      <p className="text-label text-muted">{t('deleteWorldHint')}</p>
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
              {remove.isPending ? t('deleting', { ns: 'content' }) : t('confirmDelete', { ns: 'content' })}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={DANGER}>
              {t('cancel', { ns: 'content' })}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={DANGER}>
            <Trash2 aria-hidden className="size-4" />
            {t('deleteWorld')}
          </button>
        )}
      </div>
    </section>
  )
}
