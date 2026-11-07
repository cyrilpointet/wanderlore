import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { BookOpen, ChevronLeft, CircleAlert, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DANGER_TEXT_ACTION,
  ICON_BUTTON,
  PRIMARY_ACTION,
  SECONDARY_ACTION,
  SMALL,
} from '@/components/actions'
import { Stamp } from '@/components/stamp'
import { CARD } from '@/components/surfaces'
import { relativeTime } from '@/format/relative_time'
import { CharacterStats } from '@/games/character_sheet'
import { EndStamp } from '@/games/game_over'
import { IdentityLine, OngoingGame, TabbedCard } from './character_card'
import type { CharacterDetail, PastGame } from './queries'
import { ScenarioCard } from './scenario_card'

/**
 * A character's page (front spec, section 5.6): who they are, the game they
 * play, the scenarios of their world they may start, the games they played.
 * Shows what it is given; the page that holds it sends the requests and asks
 * for confirmation.
 *
 * The sheet is a tabbed card — the world on its tab — beside the rest from a
 * wide screen up. No hit points on it: they belong to a game, and only show
 * on the current game's card.
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
        className="inline-flex items-center gap-1 self-start rounded-sm text-sm leading-none font-medium text-muted transition-colors hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {t('page.back')}
      </Link>

      <div className="grid gap-[22px] lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <section aria-label={t('page.sheet')}>
          <TabbedCard world={character.world.label} className="flex flex-col gap-5 p-5">
            <div>
              <h1 className="font-serif text-[1.625rem] leading-tight font-semibold text-balance text-text">
                {character.name}
              </h1>
              <p className="mt-0.5 text-[0.84375rem] text-muted">
                <IdentityLine character={character} withGender withWorld={false} />
              </p>
            </div>
            <CharacterStats character={character} />
          </TabbedCard>
        </section>

        <div className="flex min-w-0 flex-col gap-7">
          {game && (
            <Section title={t('game.title')}>
              <OngoingGame game={game} actionsBelow className={`${CARD} p-4`}>
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
                  className={`${CARD} flex items-center gap-2 border-l-4 border-l-hp p-4 text-body text-text`}
                >
                  <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
                  {startError}
                </p>
              )}
              {character.scenarios.length === 0 ? (
                <p className="font-serif text-body text-muted italic">{t('scenarios.empty')}</p>
              ) : (
                <ul className="flex flex-col gap-3.5">
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

          {character.pastGames.length > 0 && (
            <Section title={t('pastGames.title')}>
              <ul className="flex flex-col">
                {character.pastGames.map((past) => (
                  <li key={past.id}>
                    <PastGameRow game={past} onDelete={() => onDeleteGame(past)} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {!character.engaged && (
            <div>
              <button type="button" onClick={onDeleteCharacter} className={DANGER_TEXT_ACTION}>
                <Trash2 aria-hidden className="size-[18px]" />
                {t('page.deleteCharacter')}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * A game over, stamped with why it ended — won, or failed by defeat, death or
 * abandon: read again, and — failed — taken off the page.
 */
function PastGameRow({ game, onDelete }: { game: PastGame; onDelete: () => void }) {
  const { t } = useTranslation('characters')
  const ended = game.endedAt ? relativeTime(new Date(game.endedAt)) : null

  return (
    <article className="flex flex-wrap items-center gap-3 border-b border-border py-3">
      <div className="flex min-w-45 flex-1 flex-col gap-0.5">
        <p className="font-serif text-[0.96875rem] leading-snug font-semibold text-text">
          {game.scenario.title}
        </p>
        {ended && game.endedAt && (
          <time dateTime={game.endedAt} className="text-[0.78125rem] text-subtle">
            {t('pastGames.ended', {
              value: ended.value,
              formatParams: { value: { range: ended.unit, numeric: 'auto' } },
            })}
          </time>
        )}
      </div>
      {game.endReason ? (
        <EndStamp reason={game.endReason} />
      ) : (
        <Stamp tone={game.status === 'failed' ? 'failure' : 'success'}>
          {t(`gameStatus.${game.status}`, { ns: 'enums' })}
        </Stamp>
      )}
      <div className="flex items-center gap-2">
        <Link
          to="/games/$gameId"
          params={{ gameId: game.id }}
          className={`${SECONDARY_ACTION} ${SMALL}`}
        >
          <BookOpen aria-hidden className="size-4" />
          {t('pastGames.read')}
        </Link>
        {game.status === 'failed' && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={t('pastGames.delete', { scenario: game.scenario.title })}
            title={t('pastGames.delete', { scenario: game.scenario.title })}
            className={`${ICON_BUTTON} hover:text-danger`}
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </article>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <h2 className="font-serif text-xl leading-tight font-semibold text-text">{title}</h2>
      {children}
    </section>
  )
}
