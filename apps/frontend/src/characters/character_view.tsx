import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, CircleAlert, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DANGER_ACTION, PRIMARY_ACTION, SECONDARY_ACTION } from '@/components/actions'
import { relativeTime } from '@/format/relative_time'
import { CharacterStats } from '@/games/character_sheet'
import { GameStatusBadge } from '@/games/game_status_badge'
import { IdentityLine, OngoingGame } from './character_card'
import type { CharacterDetail, PastGame } from './queries'
import { ScenarioCard } from './scenario_card'

/**
 * A character's page (front spec, section 5.6): who they are, the game they
 * play, the scenarios of their world they may start, the games they played.
 * Shows what it is given; the page that holds it sends the requests and asks
 * for confirmation.
 */
export function CharacterView({
  character,
  starting,
  startError,
  onStart,
  onAbandon,
  onDeleteGame,
  onDeleteCharacter,
}: {
  character: CharacterDetail
  /** The scenario whose game is being started. */
  starting: string | null
  /** Why the last start failed, already worded for the player. */
  startError: string | null
  onStart: (scenarioId: string) => void
  onAbandon: () => void
  onDeleteGame: (game: PastGame) => void
  onDeleteCharacter: () => void
}) {
  const { t } = useTranslation('characters')
  const { game } = character

  return (
    <>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-label text-muted transition-colors hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t('page.back')}
      </Link>
      <h1 className="font-serif text-[1.75rem] leading-tight font-medium text-text lg:text-[2rem]">
        {character.name}
      </h1>
      <p className="mt-1.5 text-body text-muted">
        <IdentityLine character={character} withGender />
      </p>

      {game && (
        <Section title={t('game.title')}>
          <OngoingGame game={game}>
            <button type="button" onClick={onAbandon} className={SECONDARY_ACTION}>
              {t('game.abandon')}
            </button>
            <Link to="/games/$gameId" params={{ gameId: game.id }} className={PRIMARY_ACTION}>
              {t('game.continue')}
            </Link>
          </OngoingGame>
        </Section>
      )}

      {!character.engaged && (
        <Section title={t('scenarios.title')}>
          {startError && (
            <p
              role="alert"
              className="mb-4 flex items-center gap-2 rounded-lg border border-danger/60 p-4 text-body text-text"
            >
              <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
              {startError}
            </p>
          )}
          {character.scenarios.length === 0 ? (
            <p className="text-body text-muted">{t('scenarios.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {character.scenarios.map((scenario) => (
                <li key={scenario.id}>
                  <ScenarioCard
                    scenario={scenario}
                    starting={starting === scenario.id}
                    disabled={starting !== null}
                    onStart={() => onStart(scenario.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title={t('page.sheet')}>
        <div className="flex flex-col gap-8 rounded-lg border border-border bg-surface-1 px-5 pb-6 sm:px-6 [&>section:first-child]:border-t-0">
          <CharacterStats character={character} />
        </div>
      </Section>

      {character.pastGames.length > 0 && (
        <Section title={t('pastGames.title')}>
          <ul className="flex flex-col gap-3">
            {character.pastGames.map((past) => (
              <li key={past.id}>
                <PastGameRow game={past} onDelete={() => onDeleteGame(past)} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!character.engaged && (
        <div className="mt-12 border-t border-border pt-6">
          <button type="button" onClick={onDeleteCharacter} className={DANGER_ACTION}>
            <Trash2 aria-hidden className="size-4" />
            {t('page.deleteCharacter')}
          </button>
        </div>
      )}
    </>
  )
}

/** A game over: read again, and — failed — taken off the page. */
function PastGameRow({ game, onDelete }: { game: PastGame; onDelete: () => void }) {
  const { t } = useTranslation('characters')
  const ended = game.endedAt ? relativeTime(new Date(game.endedAt)) : null

  return (
    <article className="flex items-center gap-3 rounded-lg border border-border-strong bg-surface-1 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-body text-text">{game.scenario.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-label text-subtle">
          <GameStatusBadge status={game.status} />
          {ended && game.endedAt && (
            <time dateTime={game.endedAt}>
              {t('pastGames.ended', {
                value: ended.value,
                formatParams: { value: { range: ended.unit, numeric: 'auto' } },
              })}
            </time>
          )}
        </div>
      </div>
      <Link
        to="/games/$gameId"
        params={{ gameId: game.id }}
        className="shrink-0 text-label text-accent underline-offset-2 hover:underline"
      >
        {t('pastGames.read')}
      </Link>
      {game.status === 'failed' && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('pastGames.delete', { scenario: game.scenario.title })}
          title={t('pastGames.delete', { scenario: game.scenario.title })}
          className="-mr-1.5 grid size-8 shrink-0 place-items-center rounded-full text-subtle transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      )}
    </article>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-meta text-subtle uppercase">{title}</h2>
      {children}
    </section>
  )
}
