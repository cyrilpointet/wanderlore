import { Link } from '@tanstack/react-router'
import { Clock, Trash2 } from 'lucide-react'
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

/**
 * The whole card opens the game, through a link stretched over it; the delete
 * button sits above that link, since a button cannot live inside one.
 */
export function GameCard({ game, onDelete }: { game: GameSummary; onDelete: () => void }) {
  const { t } = useTranslation('games')
  const { value, unit } = relativeTime(new Date(game.lastActivityAt))

  return (
    <article className="group relative rounded-lg border border-border-strong bg-surface-1 p-5 transition-colors hover:border-accent/60 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-[1.375rem] leading-tight text-text transition-colors group-hover:text-accent">
          <Link
            to="/games/$gameId"
            params={{ gameId: game.id }}
            className="after:absolute after:inset-0 after:rounded-lg"
          >
            {game.character.name}
          </Link>
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

      <div className="mt-5 flex items-center justify-between gap-3">
        <HitPoints current={game.character.hitPoints} max={game.character.hitPointsMax} />
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-label text-subtle">
            <Clock aria-hidden className="size-4" />
            <time dateTime={game.lastActivityAt}>
              {t('lastActivity', {
                value,
                formatParams: { value: { range: unit, numeric: 'auto' } },
              })}
            </time>
          </span>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t('deleteGame', { name: game.character.name })}
            title={t('deleteGame', { name: game.character.name })}
            className="relative z-10 -my-1 -mr-1.5 grid size-8 place-items-center rounded-full text-subtle transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </article>
  )
}
