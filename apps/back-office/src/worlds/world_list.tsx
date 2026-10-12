import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import type { WorldSummary } from './queries'

/** The worlds, each a way into its editor. */
export function WorldList({ worlds }: { worlds: WorldSummary[] }) {
  const { t } = useTranslation('worlds')

  if (worlds.length === 0) {
    return <p className="text-body text-muted">{t('empty')}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {worlds.map((world) => (
        <li key={world.id}>
          <Link
            to="/worlds/$worldId"
            params={{ worldId: world.id }}
            className="block rounded-lg border border-border-strong bg-surface-1 transition-colors hover:border-accent/60"
          >
            <WorldRow world={world} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * A world by its English name, its reference and how many scenarios it
 * holds. A game master edits in English first: other languages are added
 * name by name.
 */
export function WorldRow({ world }: { world: WorldSummary }) {
  const { t } = useTranslation('worlds')

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="truncate font-serif text-[1.125rem] text-text">{world.labels.en}</p>
        <p className="truncate font-mono text-label text-subtle">{world.reference}</p>
      </div>
      <span className="shrink-0 text-label text-muted">
        {t('scenarioCount', { count: world.scenarioCount })}
      </span>
    </div>
  )
}
