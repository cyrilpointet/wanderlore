import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import type { EndReason } from '@/api/enums'
import { SECONDARY_ACTION } from '@/components/actions'
import { Stamp } from '@/components/stamp'
import { CARD } from '@/components/surfaces'

/**
 * In place of the input once a game is over: a card laid in the dice tray,
 * stamped with why it ended — won, lost by defeat or death, or given up. The
 * story can still be read, nothing more can be played in it.
 */
export function GameOver({
  characterId,
  name,
  endReason,
}: {
  characterId: string
  name: string
  /** Null only for a game closed before the backend gave a reason. */
  endReason: EndReason | null
}) {
  const { t } = useTranslation('game')

  return (
    <div
      role="status"
      className={`${CARD} flex flex-col items-center gap-3 p-4 text-center lg:flex-row lg:justify-between lg:text-left`}
    >
      <div className="flex min-w-0 flex-col items-center gap-2.5 lg:flex-row lg:gap-3.5">
        {endReason && <EndStamp reason={endReason} className="shrink-0" />}
        <p className="font-serif text-[1.1875rem] leading-snug font-semibold text-balance text-text">
          {endReason ? t(`over.${endReason}`, { name }) : t('over.message')}
        </p>
      </div>
      <Link
        to="/characters/$characterId"
        params={{ characterId }}
        className={`shrink-0 ${SECONDARY_ACTION}`}
      >
        {t('over.back', { name })}
      </Link>
    </div>
  )
}

/**
 * Why a game ended, stamped: in green for a game won, in red for one lost —
 * the word says which, the colour only doubles it. Small on a card, large at
 * the foot of the story; `pressed` brings it down onto the sheet as it
 * appears, once.
 */
export function EndStamp({
  reason,
  size = 'small',
  pressed = false,
  className = '',
}: {
  reason: EndReason
  size?: 'small' | 'large'
  pressed?: boolean
  className?: string
}) {
  const { t } = useTranslation('enums')

  return (
    <Stamp
      tone={reason === 'victory' ? 'success' : 'failure'}
      size={size}
      className={`${pressed ? 'animate-stamp-press' : ''} ${className}`}
    >
      {t(`endReason.${reason}`)}
    </Stamp>
  )
}
