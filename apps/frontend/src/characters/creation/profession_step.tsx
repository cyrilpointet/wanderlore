import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CARD } from '@/components/surfaces'
import type { CreationIssue, Profession } from '../queries'
import { issuesOn } from './draft'
import { Issues } from './issues'
import { kitOf } from './kit'

/**
 * The professions of the world, each with what it brings: its skills, which
 * the professional points go to, and what the character starts a game with.
 * A group of radio buttons: the arrow keys move from one to the next. Each
 * profession is a card; the one chosen is lifted off the sheet.
 */
export function ProfessionStep({
  professions,
  chosen,
  issues,
  onChoose,
}: {
  professions: Profession[]
  chosen: string | null
  issues: CreationIssue[]
  onChoose: (profession: string) => void
}) {
  const { t } = useTranslation('characters')
  const professionIssues = issuesOn(issues, 'profession')

  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="mb-5 font-serif text-[0.9375rem] leading-relaxed text-muted">
        {t('creation.profession.intro')}
      </legend>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-[18px]">
        {professions.map((profession) => {
          const selected = profession.reference === chosen
          const kit = kitOf(profession, t)
          return (
            <label
              key={profession.reference}
              className={`${CARD} relative flex cursor-pointer flex-col gap-2 p-4 pr-12 transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${
                selected
                  ? '-translate-y-[3px] border-accent! shadow-lift! ring-[1.5px] ring-accent'
                  : ''
              }`}
            >
              <input
                type="radio"
                name="profession"
                value={profession.reference}
                checked={selected}
                onChange={() => onChoose(profession.reference)}
                className="sr-only"
              />
              {/* The check badge, top right: empty ring, or ink blue once chosen. */}
              <span
                aria-hidden
                className={`absolute top-3.5 right-3.5 grid size-[22px] place-items-center rounded-full border-[1.5px] ${
                  selected ? 'border-accent bg-accent text-on-accent' : 'border-leader'
                }`}
              >
                {selected && <Check strokeWidth={3} className="size-[13px]" />}
              </span>
              <span className="font-serif text-lg leading-snug font-semibold text-text">
                {profession.label}
              </span>
              <span className="font-serif text-[0.90625rem] leading-relaxed text-muted">
                {profession.description}
              </span>
              {profession.skills.length > 0 && (
                <span className="text-label text-muted">
                  <span className="font-semibold text-text">{t('creation.profession.skills')}</span>{' '}
                  {t('creation.list', { items: profession.skills.map(({ label }) => label) })}
                </span>
              )}
              {kit.length > 0 && (
                <span className="text-label text-muted">
                  <span className="font-semibold text-text">{t('creation.profession.kit')}</span>{' '}
                  {t('creation.list', { items: kit })}
                </span>
              )}
            </label>
          )
        })}
      </div>

      <Issues issues={professionIssues} />
    </fieldset>
  )
}
