import { useTranslation } from 'react-i18next'

import type { ScenarioSummary } from './queries'

type ScenarioCardProps = {
  scenario: ScenarioSummary
  /** Set while this scenario's game is being started. */
  starting: boolean
  /** Starting any game disables every card: one game at a time. */
  disabled: boolean
  onStart: () => void
}

/** A scenario of the New game catalogue: its world, its story, and a way in. */
export function ScenarioCard({ scenario, starting, disabled, onStart }: ScenarioCardProps) {
  const { t } = useTranslation('games')

  return (
    <article className="rounded-lg border border-border-strong bg-surface-1 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-meta text-subtle uppercase">{scenario.world.label}</p>
          <h2 className="mt-1 font-serif text-[1.375rem] leading-tight text-text">
            {scenario.title}
          </h2>
        </div>
        {scenario.status === 'draft' && (
          <span className="inline-flex shrink-0 items-center rounded-sm border border-border-strong bg-surface-2 px-2 py-0.5 text-meta text-muted uppercase">
            {t('scenarioStatus.draft', { ns: 'enums' })}
          </span>
        )}
      </div>

      <p className="mt-3 font-serif text-body text-muted italic">{scenario.world.tone}</p>
      <p className="mt-3 font-serif text-body text-text">{scenario.synopsis}</p>

      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        aria-busy={starting}
        className="mt-5 h-10 rounded-lg bg-accent px-4 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-70"
      >
        {starting ? t('newGamePage.starting') : t('newGamePage.start')}
      </button>
    </article>
  )
}
