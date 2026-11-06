import { useTranslation } from 'react-i18next'

import { PRIMARY_ACTION } from '@/components/actions'
import { Stamp } from '@/components/stamp'
import { CARD } from '@/components/surfaces'
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
    <article className={`${CARD} flex flex-col gap-2.5 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <h3 className="min-w-0 font-serif text-lg leading-snug font-semibold text-text">
          {scenario.title}
        </h3>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {scenario.status === 'draft' && (
            <Stamp tone="neutral">{t('scenarioStatus.draft', { ns: 'enums' })}</Stamp>
          )}
          {scenario.failed && <Stamp tone="failure">{t('scenarios.failed')}</Stamp>}
        </div>
      </div>

      <p className="font-serif text-[0.90625rem] leading-relaxed text-muted">{scenario.synopsis}</p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onStart}
          disabled={disabled}
          aria-busy={starting}
          className={PRIMARY_ACTION}
        >
          {starting ? t('scenarios.starting') : t('scenarios.play')}
        </button>
      </div>
    </article>
  )
}
