import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/app_header'
import { ScenarioCard } from '@/games/scenario_card'
import { gameQuery, gamesQuery, scenariosQuery, startGame } from '@/games/queries'
import { failureMessage } from '@/i18n/errors'

export const Route = createFileRoute('/_authenticated/games/new')({
  component: NewGame,
})

function NewGame() {
  const { t } = useTranslation('games')

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-xl px-4 pt-8 pb-12 sm:px-6 lg:pt-16">
        <Link
          to="/games"
          className="mb-6 inline-flex items-center gap-1.5 text-label text-muted transition-colors hover:text-text"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t('newGamePage.back')}
        </Link>
        <h1 className="font-serif text-[1.75rem] leading-tight font-medium text-text lg:text-[2rem]">
          {t('newGamePage.title')}
        </h1>
        <p className="mt-2 mb-8 text-body text-muted">{t('newGamePage.intro')}</p>
        <Catalogue />
      </main>
    </>
  )
}

function Catalogue() {
  const { t } = useTranslation('games')
  const scenarios = useQuery(scenariosQuery)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const start = useMutation({
    mutationFn: startGame,
    onSuccess: (game) => {
      // The game screen opens on what the backend just answered, without asking again.
      queryClient.setQueryData(gameQuery(game.id).queryKey, game)
      void queryClient.invalidateQueries({ queryKey: gamesQuery.queryKey, exact: true })
      void navigate({ to: '/games/$gameId', params: { gameId: game.id } })
    },
  })

  if (scenarios.isPending) {
    return (
      <p aria-busy className="text-body text-muted">
        {t('newGamePage.loading')}
      </p>
    )
  }

  if (scenarios.isError) {
    return (
      <div role="alert" className="rounded-lg border border-danger/60 p-5 text-body text-text">
        <p className="flex items-center gap-2">
          <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
          {failureMessage(scenarios.error)}
        </p>
        <button
          type="button"
          onClick={() => scenarios.refetch()}
          disabled={scenarios.isFetching}
          className="mt-4 h-10 rounded-lg bg-accent px-4 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-70"
        >
          {t('tryAgain', { ns: 'common' })}
        </button>
      </div>
    )
  }

  if (scenarios.data.length === 0) {
    return <p className="text-body text-muted">{t('newGamePage.empty')}</p>
  }

  return (
    <>
      {start.isError && (
        <p
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg border border-danger/60 p-4 text-body text-text"
        >
          <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
          {failureMessage(start.error)}
        </p>
      )}
      <ul className="flex flex-col gap-4">
        {scenarios.data.map((scenario) => (
          <li key={scenario.id}>
            <ScenarioCard
              scenario={scenario}
              starting={start.isPending && start.variables === scenario.id}
              disabled={start.isPending}
              onStart={() => start.mutate(scenario.id)}
            />
          </li>
        ))}
      </ul>
    </>
  )
}
