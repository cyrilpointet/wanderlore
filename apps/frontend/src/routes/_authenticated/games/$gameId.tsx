import { useCallback, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/client'
import { isOver } from '@/api/enums'
import { errorMessage } from '@/i18n/errors'
import { NotFoundMessage } from '@/components/system_pages'
import { SHEET } from '@/components/surfaces'
import { CharacterSheet } from '@/games/character_sheet'
import { DiceTray } from '@/games/dice_tray'
import { GameHeader } from '@/games/game_header'
import { Journal } from '@/games/journal'
import { gameQuery, turnsQuery } from '@/games/queries'
import { SheetDialog } from '@/games/sheet_dialog'
import type { SheetTab } from '@/games/sheet_tabs'
import { Composer } from '@/games/composer'
import { GameOver } from '@/games/game_over'
import { heldInFlight } from '@/games/held_turn'
import { lastRevealed, liveRollOf, locksInput } from '@/games/roll_reveal'
import { rollLine, rollText } from '@/games/roll_text'
import { SceneTag } from '@/games/scene_tag'
import { TurnInFlight } from '@/games/turn_in_flight'
import { isBusy, progressKey } from '@/games/turn_machine'
import { waitingText } from '@/games/waiting'
import { useDraft } from '@/games/use_draft'
import { useEarlierTurns } from '@/games/use_earlier_turns'
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
  const { data: journal } = useSuspenseQuery(turnsQuery(gameId))
  const earlier = useEarlierTurns(gameId)
  // The card the sheet was last opened on stays while it is put back down.
  const [sheet, setSheet] = useState<{ open: boolean; tab: SheetTab; opening: number }>({
    open: false,
    tab: 'character',
    opening: 0,
  })
  const openSheet = useCallback(
    (tab: SheetTab) => setSheet((current) => ({ open: true, tab, opening: current.opening + 1 })),
    []
  )
  const closeSheet = useCallback(() => setSheet((current) => ({ ...current, open: false })), [])
  const [draft, setDraft] = useDraft(gameId)
  // The draft is cleared once the turn is accepted, never before: a failed POST keeps it.
  const turn = useTurn(game, { onAccepted: () => setDraft('') })
  const { state, reveal } = turn
  // Recorded only once its dice are thrown: the voice never gives the outcome away.
  const voice = useNarrationVoice(turn.narrated)
  const { t } = useTranslation('game')

  // A turn over before its dice were thrown stays where the turn in flight was.
  const shown = state.status !== 'idle' ? state : turn.held ? heldInFlight(turn.held) : null
  const liveRoll = liveRollOf(reveal, shown?.submission.turnId ?? null)
  const announced = lastRevealed(reveal)

  function edit() {
    const text = turn.edit()
    if (text !== null) setDraft(text)
  }

  return (
    /*
     * The game table (front spec, section 8). On a phone, from top to bottom:
     * the character's card, the sheet of the story with its place tag, the
     * dice tray with the input. From `lg`, the sheet and the tray on the left,
     * the stack of the character's cards on the right.
     */
    <div className="flex h-dvh flex-col px-2.5 lg:mx-auto lg:grid lg:max-w-[1240px] lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:gap-x-11 lg:px-9 lg:pt-[18px] lg:pb-[26px] lg:[grid-template-areas:'top_top'_'board_stack'_'dock_stack']">
      <GameHeader game={game} onOpenSheet={openSheet} voice={voice} />

      <main className="relative z-10 mt-6 flex min-h-0 flex-1 flex-col lg:mt-0 lg:[grid-area:board]">
        <SceneTag
          game={game}
          className="absolute -top-4 left-1/2 z-20 max-w-[calc(100%-40px)] -translate-x-1/2"
        />
        <div className={`${SHEET} flex min-h-0 flex-1 flex-col pt-9 lg:pt-10`}>
          <Journal
            game={game}
            turns={journal.turns}
            earlier={{
              remain: journal.hasEarlier,
              load: earlier.loadEarlier,
              loading: earlier.loading,
              error: earlier.error,
            }}
            progress={`${progressKey(shown ?? state)}:${reveal.status}`}
            revealedTurnId={turn.released}
            inFlight={
              shown && (
                <TurnInFlight state={shown} reveal={reveal} onRetry={turn.retry} onEdit={edit} />
              )
            }
          />
        </div>
        {/*
         * Waiting messages, then the narration, told once to screen readers.
         * Silent while the dice wait: the card's button speaks for itself.
         */}
        <p aria-live="polite" className="sr-only">
          {liveRoll
            ? ''
            : state.status === 'in_progress'
              ? waitingText(state, t)
              : (turn.narrated ?? '')}
        </p>
        {/* Each roll in full, once its dice are thrown. */}
        <p aria-live="polite" className="sr-only">
          {announced ? rollLine(rollText(announced, t)) : ''}
        </p>
      </main>

      <DiceTray
        live={liveRoll}
        onThrow={turn.throwDice}
        onDiceStopped={turn.diceStopped}
        onFolded={turn.folded}
      >
        {isOver(game.status) ? (
          <GameOver characterId={game.characterId} name={game.character.name} />
        ) : (
          <Composer
            value={draft}
            onChange={(value) => {
              setDraft(value)
              turn.inputChanged()
            }}
            onSubmit={turn.submit}
            locked={isBusy(state) || locksInput(reveal)}
            ready={turn.subscribed}
            error={
              state.status === 'idle' && state.inputError
                ? errorMessage(state.inputError)
                : undefined
            }
          />
        )}
      </DiceTray>

      <aside className="hidden min-h-0 pb-2 lg:block lg:[grid-area:stack]">
        <CharacterSheet game={game} />
      </aside>

      <SheetDialog
        game={game}
        open={sheet.open}
        tab={sheet.tab}
        opening={sheet.opening}
        onClose={closeSheet}
      />
    </div>
  )
}

function GameNotFound() {
  const { t } = useTranslation('game')

  return <NotFoundMessage message={t('notFound')} />
}
