import { Link } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { GameStatus } from '@/api/enums'
import { HitPoints } from '@/components/hit_points'
import { relativeTime } from '@/format/relative_time'
import type { GameSummary } from './queries'

/** A game still being played stands out; a paused or finished one stays neutral. */
const STATUS_TONE: Record<GameStatus, string> = {
  in_progress: 'border-success/40 bg-success/10 text-success',
  paused: 'border-border-strong bg-surface-2 text-muted',
  completed: 'border-border-strong bg-surface-2 text-muted',
}

export function GameCard({ game }: { game: GameSummary }) {
  const { t } = useTranslation('games')
  const { value, unit } = relativeTime(new Date(game.lastActivityAt))

  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: game.id }}
      className="group block rounded-lg border border-border-strong bg-surface-1 p-5 transition-colors hover:border-accent/60 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-[1.375rem] leading-tight text-text transition-colors group-hover:text-accent">
          {game.character.name}
        </h2>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-0.5 text-meta uppercase ${STATUS_TONE[game.status]}`}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {t(`gameStatus.${game.status}`, { ns: 'enums' })}
        </span>
      </div>

      <p className="mt-2 truncate font-serif text-body text-muted">
        {game.chapter
          ? t('worldAndChapter', { world: game.world.label, chapter: game.chapter.label })
          : game.world.label}
      </p>

      <div className="mt-5 flex items-center justify-between">
        <HitPoints current={game.character.hitPoints} max={game.character.hitPointsMax} />
        <span className="flex items-center gap-1.5 text-label text-subtle">
          <Clock aria-hidden className="size-4" />
          <time dateTime={game.lastActivityAt}>
            {t('lastActivity', {
              value,
              formatParams: { value: { range: unit, numeric: 'auto' } },
            })}
          </time>
        </span>
      </div>
    </Link>
  )
}
