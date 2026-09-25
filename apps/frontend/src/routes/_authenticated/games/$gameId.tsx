import { useCallback, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/client'
import { AppHeader } from '@/components/app_header'
import { CharacterSheet } from '@/games/character_sheet'
import { GameHeader } from '@/games/game_header'
import { Journal } from '@/games/journal'
import { gameQuery, turnsQuery } from '@/games/queries'
import { SheetDialog } from '@/games/sheet_dialog'

export const Route = createFileRoute('/_authenticated/games/$gameId')({
  loader: async ({ context: { queryClient }, params: { gameId } }) => {
    try {
      await Promise.all([
        queryClient.ensureQueryData(gameQuery(gameId)),
        queryClient.ensureQueryData(turnsQuery(gameId)),
      ])
    } catch (error) {
      // Someone else's game answers exactly like one that does not exist.
      if (error instanceof ApiError && error.status === 404) throw notFound()
      throw error
    }
  },
  component: GameScreen,
  notFoundComponent: GameNotFound,
})

function GameScreen() {
  const { gameId } = Route.useParams()
  const { data: game } = useSuspenseQuery(gameQuery(gameId))
  const { data: turns } = useSuspenseQuery(turnsQuery(gameId))
  const [sheetOpen, setSheetOpen] = useState(false)
  const closeSheet = useCallback(() => setSheetOpen(false), [])

  return (
    <div className="flex h-dvh flex-col">
      <GameHeader game={game} onOpenSheet={() => setSheetOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <Journal game={game} turns={turns} />
        </main>

        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border bg-surface-1 px-6 py-8 lg:block">
          <CharacterSheet game={game} />
        </aside>
      </div>

      <SheetDialog game={game} open={sheetOpen} onClose={closeSheet} />
    </div>
  )
}

function GameNotFound() {
  const { t } = useTranslation('game')

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
        <p className="font-serif text-narration-lg text-text">{t('notFound')}</p>
        <Link
          to="/games"
          className="mt-8 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover"
        >
          {t('backToGames')}
        </Link>
      </main>
    </>
  )
}
