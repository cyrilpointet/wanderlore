import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PRIMARY_ACTION, SECONDARY_ACTION } from '@/components/actions'
import { HitPoints } from '@/components/hit_points'
import { PlaceTag } from '@/components/place_tag'
import { Stamp } from '@/components/stamp'
import { CARD, FOLDER_TAB, FOLDER_TAB_ON, LABEL } from '@/components/surfaces'
import type { CharacterGame, CharacterIdentity, CharacterSummary } from './queries'

/**
 * Profession and world, as the backend labels them; the gender through its
 * enum. Where the world is written on the card's tab, it is left out here.
 */
export function IdentityLine({
  character,
  withGender = false,
  withWorld = true,
}: {
  character: Pick<CharacterIdentity, 'world' | 'profession' | 'gender'>
  withGender?: boolean
  withWorld?: boolean
}) {
  const { t } = useTranslation('characters')
  const parts = [
    character.profession.label,
    ...(withGender ? [t(`gender.${character.gender}`, { ns: 'enums' })] : []),
    ...(withWorld ? [character.world.label] : []),
  ]

  return <>{parts.join(t('separator'))}</>
}

/**
 * An index card with a folder tab carrying the character's world (front spec,
 * section 8). The card itself comes from the caller.
 */
export function TabbedCard({
  world,
  className = '',
  children,
}: {
  world: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col items-start">
      <span className={`${FOLDER_TAB} ${FOLDER_TAB_ON} ml-3.5 max-w-[calc(100%-1.75rem)]`}>
        <span className="truncate">{world}</span>
      </span>
      <div className={`${CARD} relative w-full ${className}`}>{children}</div>
    </div>
  )
}

/**
 * The game a character plays: how they fare, then a tag with its scenario and
 * where the story stands. What can be done with it comes from the caller, on
 * the tag's line or, `actionsBelow`, on a line of its own.
 */
export function OngoingGame({
  game,
  actionsBelow = false,
  className = '',
  children,
}: {
  game: CharacterGame
  actionsBelow?: boolean
  className?: string
  children?: ReactNode
}) {
  const { t } = useTranslation('characters')
  const actions = children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="flex items-center gap-2">
          <span className={LABEL}>{t('game.current')}</span>
          {/* Playing says it all for a game under way; a paused one says so. */}
          {game.status !== 'in_progress' && (
            <Stamp tone="neutral">{t(`gameStatus.${game.status}`, { ns: 'enums' })}</Stamp>
          )}
        </span>
        {game.hitPoints !== null && game.hitPointsMax !== null && (
          <HitPoints current={game.hitPoints} max={game.hitPointsMax} />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <PlaceTag flat title={game.scenario.title} subtitle={game.chapter?.label} />
        {!actionsBelow && actions}
      </div>
      {actionsBelow && actions && <div className="flex justify-end">{actions}</div>}
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

  return (
    <TabbedCard world={character.world.label} className="group flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="font-serif text-[1.375rem] leading-tight font-semibold text-text transition-colors group-hover:text-accent">
            <Link
              to="/characters/$characterId"
              params={{ characterId: character.id }}
              className="after:absolute after:inset-0 after:rounded-[4px]"
            >
              {character.name}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-[0.84375rem] text-muted">
            <IdentityLine character={character} withWorld={false} />
          </p>
        </div>
        <ChevronRight
          aria-hidden
          className="mt-1 mr-1.5 size-[18px] shrink-0 text-muted transition-colors group-hover:text-text"
        />
      </div>

      {character.game && (
        <OngoingGame game={character.game} className="rounded-md border border-border bg-paper p-3">
          <Link
            to="/games/$gameId"
            params={{ gameId: character.game.id }}
            className={`relative z-10 ${PRIMARY_ACTION}`}
          >
            {t('game.continue')}
          </Link>
        </OngoingGame>
      )}
    </TabbedCard>
  )
}

/**
 * A world a character can be made in: a game box's lid seen from above — its
 * name, a short brick rule, its tone, and the way in.
 */
export function WorldCard({ world }: { world: { id: string; label: string; tone: string } }) {
  const { t } = useTranslation('characters')

  return (
    <article className="h-full rounded-md border border-border-strong bg-card p-2 shadow-[var(--wl-shadow-card),0_3px_0_var(--wl-card-under),0_4px_0_var(--wl-border-strong)]">
      <div className="flex h-full flex-col items-center gap-2.5 rounded-[3px] border-[1.5px] border-leader px-[18px] pt-[22px] pb-[18px] text-center">
        <h3 className="font-serif text-[1.4375rem] leading-tight font-semibold text-balance text-text">
          {world.label}
        </h3>
        <span aria-hidden className="h-0.5 w-9 bg-hp" />
        <p className="font-serif text-[0.96875rem] leading-relaxed text-muted italic">
          {world.tone}
        </p>
        <Link
          to="/worlds/$worldId/new-character"
          params={{ worldId: world.id }}
          className={`mt-auto ${SECONDARY_ACTION}`}
        >
          {t('worlds.create')}
        </Link>
      </div>
    </article>
  )
}
