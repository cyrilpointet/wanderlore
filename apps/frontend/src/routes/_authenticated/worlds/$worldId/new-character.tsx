import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/client'
import { PRIMARY_ACTION } from '@/components/actions'
import { AppHeader } from '@/components/app_header'
import { CharacterCreation } from '@/characters/creation/character_creation'
import { creationQuery } from '@/characters/queries'

export const Route = createFileRoute('/_authenticated/worlds/$worldId/new-character')({
  loader: async ({ context: { queryClient }, params: { worldId } }) => {
    try {
      await queryClient.ensureQueryData(creationQuery(worldId))
    } catch (error) {
      // A world with nothing to play answers like one that does not exist.
      if (error instanceof ApiError && error.status === 404) throw notFound()
      throw error
    }
  },
  component: NewCharacter,
  notFoundComponent: WorldNotFound,
})

function NewCharacter() {
  const { worldId } = Route.useParams()
  const { data: creation } = useSuspenseQuery(creationQuery(worldId))
  const { t } = useTranslation('characters')

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-xl px-4 pt-8 pb-12 sm:px-6 lg:pt-16">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-label text-muted transition-colors hover:text-text"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t('page.back')}
        </Link>
        <p className="text-meta text-subtle uppercase">{creation.world.label}</p>
        <h1 className="mt-1 mb-8 font-serif text-[1.75rem] leading-tight font-medium text-text lg:text-[2rem]">
          {t('creation.title')}
        </h1>
        {/* A fresh draft per world: the draft never outlives the page. */}
        <CharacterCreation key={worldId} creation={creation} />
      </main>
    </>
  )
}

function WorldNotFound() {
  const { t } = useTranslation('characters')

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
        <p className="font-serif text-narration-lg text-text">{t('creation.notFound')}</p>
        <Link to="/" className={`mt-8 ${PRIMARY_ACTION}`}>
          {t('page.back')}
        </Link>
      </main>
    </>
  )
}
