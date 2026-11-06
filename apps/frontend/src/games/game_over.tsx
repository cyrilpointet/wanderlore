import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SECONDARY_ACTION } from '@/components/actions'
import { CARD } from '@/components/surfaces'

/**
 * In place of the input once a game is over — failed, or later completed: a
 * card laid in the dice tray. The story can still be read, nothing more can
 * be played in it.
 */
export function GameOver({ characterId, name }: { characterId: string; name: string }) {
  const { t } = useTranslation('game')

  return (
    <div
      role="status"
      className={`${CARD} flex flex-col items-center gap-3 p-4 text-center lg:flex-row lg:justify-between lg:text-left`}
    >
      <p className="font-serif text-[1.1875rem] leading-snug font-semibold text-text lg:whitespace-nowrap">
        {t('over.message')}
      </p>
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
