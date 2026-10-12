import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/app_header'
import { FormAlert } from '@/content/field'
import { formFailureOf, type FormFailure } from '@/content/form_errors'
import { PRIMARY } from '@/content/ui'
import { createWorld, worldQuery, worldsQuery } from '@/worlds/queries'
import { emptyWorldDraft, worldPayloadOf } from '@/worlds/world_draft'
import { WorldForm } from '@/worlds/world_form'

export const Route = createFileRoute('/_authenticated/worlds/new')({
  component: NewWorld,
})

/** A new world: its reference, names and tone first; everything else in its editor. */
function NewWorld() {
  const { t } = useTranslation('worlds')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(emptyWorldDraft)
  const [failure, setFailure] = useState<FormFailure | null>(null)

  const create = useMutation({
    mutationFn: () => createWorld(worldPayloadOf(draft)),
    onMutate: () => setFailure(null),
    onSuccess: async (world) => {
      queryClient.setQueryData(worldQuery(world.id).queryKey, world)
      void queryClient.invalidateQueries({ queryKey: worldsQuery.queryKey, exact: true })
      await navigate({ to: '/worlds/$worldId', params: { worldId: world.id } })
    },
    onError: (error) => setFailure(formFailureOf(error)),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6 lg:pt-12">
        <Link
          to="/worlds"
          className="mb-6 inline-flex items-center gap-1.5 text-label text-muted transition-colors hover:text-text"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t('back')}
        </Link>
        <h1 className="mb-8 font-serif text-[1.75rem] leading-tight font-medium text-text">
          {t('newWorld')}
        </h1>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <WorldForm draft={draft} onChange={setDraft} errors={failure?.fields ?? {}} creating />
          {failure?.general && <FormAlert message={failure.general} />}
          <div>
            <button type="submit" disabled={create.isPending} className={PRIMARY}>
              {create.isPending ? t('creating') : t('create')}
            </button>
          </div>
        </form>
      </main>
    </>
  )
}
