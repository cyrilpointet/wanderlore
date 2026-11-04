import { useTranslation } from 'react-i18next'

import type { ScenarioChoice } from './queries'

type ScenarioCardProps = {
  scenario: ScenarioChoice
  /** Set while this scenario's game is being started. */
  starting: boolean
  /** Starting any game disables every card: one game at a time. */
  disabled: boolean
  onStart: () => void
}

/**
 * A scenario the character may play: its story, whether they failed it
 * before, and a way in. A draft, which only a game master is shown, says so.
 */
export function ScenarioCard({ scenario, starting, disabled, onStart }: ScenarioCardProps) {
  const { t } = useTranslation('characters')

  return (
    <article className="rounded-lg border border-border-strong bg-surface-1 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-serif text-[1.375rem] leading-tight text-text">
          {scenario.title}
        </h3>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {scenario.status === 'draft' && (
            <span className="inline-flex items-center rounded-sm border border-border-strong bg-surface-2 px-2 py-0.5 text-meta text-muted uppercase">
              {t('scenarioStatus.draft', { ns: 'enums' })}
            </span>
          )}
          {scenario.failed && (
            <span className="inline-flex items-center rounded-sm border border-danger/50 bg-danger/10 px-2 py-0.5 text-meta text-danger uppercase">
              {t('scenarios.failed')}
            </span>
          )}
        </div>
      </div>

      <p className="mt-3 font-serif text-body text-text">{scenario.synopsis}</p>

      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        aria-busy={starting}
        className="mt-5 h-10 rounded-lg bg-accent px-4 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-70"
      >
        {starting ? t('scenarios.starting') : t('scenarios.play')}
      </button>
    </article>
  )
}
