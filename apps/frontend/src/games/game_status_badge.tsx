import { useTranslation } from 'react-i18next'

import type { GameStatus } from '@/api/enums'

/** A game still being played stands out; a paused one stays neutral; a failed one reads red. */
const STATUS_TONE: Record<GameStatus, string> = {
  in_progress: 'border-success/40 bg-success/10 text-success',
  paused: 'border-border-strong bg-surface-2 text-muted',
  completed: 'border-border-strong bg-surface-2 text-muted',
  failed: 'border-danger/50 bg-danger/10 text-danger',
}

export function GameStatusBadge({ status }: { status: GameStatus }) {
  const { t } = useTranslation('enums')

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-0.5 text-meta uppercase ${STATUS_TONE[status]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {t(`gameStatus.${status}`)}
    </span>
  )
}
