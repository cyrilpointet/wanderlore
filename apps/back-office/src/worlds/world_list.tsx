import { useTranslation } from 'react-i18next'

import type { WorldSummary } from './queries'

/**
 * The worlds, each with its English name, its reference and how many
 * scenarios it holds. A game master edits in English first: other languages
 * are added name by name.
 */
export function WorldList({ worlds }: { worlds: WorldSummary[] }) {
  const { t } = useTranslation('worlds')

  if (worlds.length === 0) {
    return <p className="text-body text-muted">{t('empty')}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {worlds.map((world) => (
        <li
          key={world.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-border-strong bg-surface-1 px-5 py-4"
        >
          <div className="min-w-0">
            <p className="truncate font-serif text-[1.125rem] text-text">{world.labels.en}</p>
            <p className="truncate font-mono text-label text-subtle">{world.reference}</p>
          </div>
          <span className="shrink-0 text-label text-muted">
            {t('scenarioCount', { count: world.scenarioCount })}
          </span>
        </li>
      ))}
    </ul>
  )
}
