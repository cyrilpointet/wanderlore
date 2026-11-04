import { useState } from 'react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/client'
import { PRIMARY_ACTION } from '@/components/actions'
import { AppHeader } from '@/components/app_header'
import { CharacterView } from '@/characters/character_view'
import { AbandonGameDialog, DeleteCharacterDialog, DeleteGameDialog } from '@/characters/dialogs'
import {
  CHARACTERS_KEY,
  characterQuery,
  charactersQuery,
  deleteCharacter,
  startGame,
  type PastGame,
} from '@/characters/queries'
import { abandonGame, deleteGame, gameQuery } from '@/games/queries'
import { failureMessage } from '@/i18n/errors'

export const Route = createFileRoute('/_authenticated/characters/$characterId')({
  loader: async ({ context: { queryClient }, params: { characterId } }) => {
    try {
      await queryClient.ensureQueryData(characterQuery(characterId))
    } catch (error) {
      // Someone else's character answers exactly like one that does not exist.
      if (error instanceof ApiError && error.status === 404) throw notFound()
      throw error
    }
  },
  component: CharacterPage,
  notFoundComponent: CharacterNotFound,
})

/** What the player asked to confirm, until they do or change their mind. */
type Pending =
  { kind: 'abandon' } | { kind: 'deleteGame'; game: PastGame } | { kind: 'deleteCharacter' }

function CharacterPage() {
  const { characterId } = Route.useParams()
  const { data: character } = useSuspenseQuery(characterQuery(characterId))
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [pending, setPending] = useState<Pending | null>(null)

  /** The character's page and the home both show their games. */
  const refresh = () => queryClient.invalidateQueries({ queryKey: CHARACTERS_KEY })

  const start = useMutation({
    mutationFn: (scenarioId: string) => startGame(characterId, scenarioId),
    onSuccess: (game) => {
      // The game screen opens on what the backend just answered, without asking again.
      queryClient.setQueryData(gameQuery(game.id).queryKey, game)
      void refresh()
      void navigate({ to: '/games/$gameId', params: { gameId: game.id } })
    },
  })

  const abandon = useMutation({
    mutationFn: abandonGame,
    onSuccess: (game) => {
      queryClient.setQueryData(gameQuery(game.id).queryKey, game)
      void refresh()
      setPending(null)
    },
  })

  const removeGame = useMutation({
    mutationFn: deleteGame,
    onSuccess: (_, gameId) => {
      queryClient.removeQueries({ queryKey: gameQuery(gameId).queryKey })
      void refresh()
      setPending(null)
    },
  })

  const removeCharacter = useMutation({
    mutationFn: () => deleteCharacter(characterId),
    onSuccess: async () => {
      queryClient.setQueryData(charactersQuery.queryKey, (list) =>
        list?.filter((entry) => entry.id !== characterId)
      )
      await navigate({ to: '/' })
      queryClient.removeQueries({ queryKey: characterQuery(characterId).queryKey })
      void refresh()
    },
  })

  const ask = (next: Pending) => {
    abandon.reset()
    removeGame.reset()
    removeCharacter.reset()
    setPending(next)
  }
  const close = () => setPending(null)
  const askAbandon = () => ask({ kind: 'abandon' })
  const askDeleteGame = (game: PastGame) => ask({ kind: 'deleteGame', game })
  const askDeleteCharacter = () => ask({ kind: 'deleteCharacter' })

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-xl px-4 pt-8 pb-12 sm:px-6 lg:pt-16">
        <CharacterView
          character={character}
          starting={start.isPending ? (start.variables ?? null) : null}
          startError={start.isError ? failureMessage(start.error) : null}
          onStart={(scenarioId) => start.mutate(scenarioId)}
          onAbandon={askAbandon}
          onDeleteGame={askDeleteGame}
          onDeleteCharacter={askDeleteCharacter}
        />
      </main>

      <AbandonGameDialog
        scenario={character.game?.scenario.title ?? ''}
        open={pending?.kind === 'abandon'}
        pending={abandon.isPending}
        error={abandon.isError ? failureMessage(abandon.error) : null}
        onConfirm={() => character.game && abandon.mutate(character.game.id)}
        onClose={close}
      />
      <DeleteGameDialog
        scenario={pending?.kind === 'deleteGame' ? pending.game.scenario.title : ''}
        open={pending?.kind === 'deleteGame'}
        pending={removeGame.isPending}
        error={removeGame.isError ? failureMessage(removeGame.error) : null}
        onConfirm={() => pending?.kind === 'deleteGame' && removeGame.mutate(pending.game.id)}
        onClose={close}
      />
      <DeleteCharacterDialog
        name={character.name}
        open={pending?.kind === 'deleteCharacter'}
        pending={removeCharacter.isPending}
        error={removeCharacter.isError ? failureMessage(removeCharacter.error) : null}
        onConfirm={() => removeCharacter.mutate()}
        onClose={close}
      />
    </>
  )
}

function CharacterNotFound() {
  const { t } = useTranslation('characters')

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
        <p className="font-serif text-narration-lg text-text">{t('page.notFound')}</p>
        <Link to="/" className={`mt-8 ${PRIMARY_ACTION}`}>
          {t('page.back')}
        </Link>
      </main>
    </>
  )
}
