import { useCallback, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/client'
import { errorMessage } from '@/i18n/errors'
import { AppHeader } from '@/components/app_header'
import { CharacterSheet } from '@/games/character_sheet'
import { GameHeader } from '@/games/game_header'
import { Journal } from '@/games/journal'
import { gameQuery, turnsQuery } from '@/games/queries'
import { SheetDialog } from '@/games/sheet_dialog'
import { Composer } from '@/games/composer'
import { TurnInFlight } from '@/games/turn_in_flight'
import { isBusy, progressKey } from '@/games/turn_machine'
import { waitingText } from '@/games/waiting'
import { useDraft } from '@/games/use_draft'
import { useNarrationVoice } from '@/games/use_narration_voice'
import { useTurn } from '@/games/use_turn'

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
  const [draft, setDraft] = useDraft(gameId)
  // The draft is cleared once the turn is accepted, never before: a failed POST keeps it.
  const turn = useTurn(game, { onAccepted: () => setDraft('') })
  const { state } = turn
  const voice = useNarrationVoice(turn.narrated)
  const { t } = useTranslation('game')

  function edit() {
    const text = turn.edit()
    if (text !== null) setDraft(text)
  }

  return (
    <div className="flex h-dvh flex-col">
      <GameHeader game={game} onOpenSheet={() => setSheetOpen(true)} voice={voice} />

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <Journal
            game={game}
            turns={turns}
            progress={progressKey(state)}
            inFlight={
              state.status !== 'idle' && (
                <TurnInFlight state={state} onRetry={turn.retry} onEdit={edit} />
              )
            }
          />
          <Composer
            value={draft}
            onChange={(value) => {
              setDraft(value)
              turn.inputChanged()
            }}
            onSubmit={turn.submit}
            locked={isBusy(state)}
            ready={turn.subscribed}
            error={
              state.status === 'idle' && state.inputError
                ? errorMessage(state.inputError)
                : undefined
            }
          />
          {/* Waiting messages, then the narration, told once to screen readers. */}
          <p aria-live="polite" className="sr-only">
            {state.status === 'in_progress' ? waitingText(state, t) : (turn.narrated ?? '')}
          </p>
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
