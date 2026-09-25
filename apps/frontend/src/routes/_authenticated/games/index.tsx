import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/app_header'
import { GameCard } from '@/games/game_card'
import { gamesQuery } from '@/games/queries'
import { failureMessage } from '@/i18n/errors'

export const Route = createFileRoute('/_authenticated/games/')({
  component: Games,
})

function Games() {
  const { t } = useTranslation('games')

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-xl px-4 pt-8 pb-12 sm:px-6 lg:pt-16">
        <h1 className="mb-8 font-serif text-[1.75rem] leading-tight font-medium text-text lg:text-[2rem]">
          {t('title')}
        </h1>
        <GameList />
      </main>
    </>
  )
}

function GameList() {
  const { t } = useTranslation('games')
  const games = useQuery(gamesQuery)

  if (games.isPending) {
    return (
      <div aria-busy className="flex flex-col gap-4">
        <span className="sr-only">{t('loading')}</span>
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  if (games.isError) {
    return (
      <div role="alert" className="rounded-lg border border-danger/60 p-5 text-body text-text">
        <p className="flex items-center gap-2">
          <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
          {failureMessage(games.error)}
        </p>
        <button
          type="button"
          onClick={() => games.refetch()}
          disabled={games.isFetching}
          className="mt-4 h-10 rounded-lg bg-accent px-4 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-70"
        >
          {t('tryAgain', { ns: 'common' })}
        </button>
      </div>
    )
  }

  if (games.data.length === 0) {
    return <p className="text-body text-muted">{t('empty')}</p>
  }

  return (
    <ul className="flex flex-col gap-4">
      {games.data.map((game) => (
        <li key={game.id}>
          <GameCard game={game} />
        </li>
      ))}
    </ul>
  )
}

function CardSkeleton() {
  return (
    <div aria-hidden className="rounded-lg border border-border bg-surface-1 p-5 sm:p-6">
      <div className="flex flex-col gap-3 motion-safe:animate-pulse">
        <div className="h-6 w-2/5 rounded-sm bg-surface-2" />
        <div className="h-4 w-3/5 rounded-sm bg-surface-2" />
        <div className="mt-3 flex justify-between">
          <div className="h-4 w-14 rounded-sm bg-surface-2" />
          <div className="h-4 w-20 rounded-sm bg-surface-2" />
        </div>
      </div>
    </div>
  )
}
