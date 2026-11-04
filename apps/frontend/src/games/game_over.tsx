import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { PRIMARY_ACTION } from '@/components/actions'

/**
 * In place of the input once a game is over — failed, or later completed:
 * the story can still be read, nothing more can be played in it.
 */
export function GameOver({ characterId, name }: { characterId: string; name: string }) {
  const { t } = useTranslation('game')

  return (
    <div role="status" className="shrink-0 border-t border-border px-3 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-reading flex-col items-center gap-3 rounded-lg border border-border-strong bg-surface-1 p-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="font-serif text-body text-text">{t('over.message')}</p>
        <Link
          to="/characters/$characterId"
          params={{ characterId }}
          className={`shrink-0 ${PRIMARY_ACTION}`}
        >
          {t('over.back', { name })}
        </Link>
      </div>
    </div>
  )
}
