import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
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
    // On the table itself, without the app bar: the page is one sheet of work.
    <main className="mx-auto flex w-full max-w-[920px] flex-col gap-[22px] px-4 pt-6 pb-12 lg:pt-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 self-start text-[0.875rem] font-medium text-muted transition-colors hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t('page.back')}
      </Link>
      <header>
        <h1 className="font-serif text-[1.625rem] leading-tight font-semibold text-balance text-text">
          {t('creation.title')}
        </h1>
        <p className="font-serif text-[0.96875rem] leading-relaxed text-muted italic">
          {creation.world.label}
        </p>
      </header>
      {/* A fresh draft per world: the draft never outlives the page. */}
      <CharacterCreation key={worldId} creation={creation} />
    </main>
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
