import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PRIMARY_ACTION } from '@/components/actions'
import { HitPoints } from '@/components/hit_points'
import { relativeTime } from '@/format/relative_time'
import { GameStatusBadge } from '@/games/game_status_badge'
import type { CharacterGame, CharacterIdentity, CharacterSummary } from './queries'

/** World and profession, as the backend labels them; the gender through its enum. */
export function IdentityLine({
  character,
  withGender = false,
}: {
  character: Pick<CharacterIdentity, 'world' | 'profession' | 'gender'>
  withGender?: boolean
}) {
  const { t } = useTranslation('characters')
  const parts = [
    character.profession.label,
    ...(withGender ? [t(`gender.${character.gender}`, { ns: 'enums' })] : []),
    character.world.label,
  ]

  return <>{parts.join(t('separator'))}</>
}

/**
 * The game a character plays: its scenario, where the story stands and how
 * they fare. What can be done with it comes from the caller.
 */
export function OngoingGame({ game, children }: { game: CharacterGame; children?: ReactNode }) {
  const { t } = useTranslation('characters')

  return (
    <div className="rounded-md border border-border bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-meta text-subtle uppercase">{t('game.current')}</p>
          <p className="mt-1 font-serif text-body text-text">{game.scenario.title}</p>
          {game.chapter && <p className="mt-0.5 text-label text-muted">{game.chapter.label}</p>}
        </div>
        <GameStatusBadge status={game.status} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {game.hitPoints !== null && game.hitPointsMax !== null ? (
          <HitPoints current={game.hitPoints} max={game.hitPointsMax} />
        ) : (
          <span />
        )}
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </div>
  )
}

/**
 * A character on the home: the whole card opens their page, through a link
 * stretched over it; **Continue** sits above that link and goes straight to
 * the game they play.
 */
export function CharacterCard({ character }: { character: CharacterSummary }) {
  const { t } = useTranslation('characters')
  const { value, unit } = relativeTime(new Date(character.lastActivityAt))

  return (
    <article className="group relative rounded-lg border border-border-strong bg-surface-1 p-5 transition-colors hover:border-accent/60 sm:p-6">
      <h3 className="font-serif text-[1.375rem] leading-tight text-text transition-colors group-hover:text-accent">
        <Link
          to="/characters/$characterId"
          params={{ characterId: character.id }}
          className="after:absolute after:inset-0 after:rounded-lg"
        >
          {character.name}
        </Link>
      </h3>
      <p className="mt-1.5 truncate text-label text-muted">
        <IdentityLine character={character} />
      </p>

      {character.game && (
        <div className="mt-4">
          <OngoingGame game={character.game}>
            <Link
              to="/games/$gameId"
              params={{ gameId: character.game.id }}
              className={`relative z-10 ${PRIMARY_ACTION}`}
            >
              {t('game.continue')}
            </Link>
          </OngoingGame>
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-label text-subtle">
        <Clock aria-hidden className="size-4" />
        <time dateTime={character.lastActivityAt}>
          {t('lastActivity', {
            ns: 'games',
            value,
            formatParams: { value: { range: unit, numeric: 'auto' } },
          })}
        </time>
      </p>
    </article>
  )
}

/** A world a character can be made in: its name, its tone, and the way in. */
export function WorldCard({ world }: { world: { id: string; label: string; tone: string } }) {
  const { t } = useTranslation('characters')

  return (
    <article className="rounded-lg border border-border-strong bg-surface-1 p-5 sm:p-6">
      <h3 className="font-serif text-[1.375rem] leading-tight text-text">{world.label}</h3>
      <p className="mt-2 font-serif text-body text-muted italic">{world.tone}</p>
      <Link
        to="/worlds/$worldId/new-character"
        params={{ worldId: world.id }}
        className={`mt-5 ${PRIMARY_ACTION}`}
      >
        {t('worlds.create')}
      </Link>
    </article>
  )
}
