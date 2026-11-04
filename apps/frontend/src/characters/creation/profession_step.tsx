import { useTranslation } from 'react-i18next'

import type { CreationIssue, Profession } from '../queries'
import { issuesOn } from './draft'
import { Issues } from './issues'

/**
 * The professions of the world, each with what it brings: its skills, which
 * the professional points go to, and what the character starts a game with.
 * A group of radio buttons: the arrow keys move from one to the next.
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
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-4 text-body text-muted">{t('creation.profession.intro')}</legend>

      {professions.map((profession) => {
        const selected = profession.reference === chosen
        return (
          <label
            key={profession.reference}
            className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent ${
              selected ? 'border-accent bg-accent/10' : 'border-border-strong bg-surface-1'
            }`}
          >
            <input
              type="radio"
              name="profession"
              value={profession.reference}
              checked={selected}
              onChange={() => onChoose(profession.reference)}
              className="mt-1.5 size-4 shrink-0 accent-accent"
            />
            <span className="flex min-w-0 flex-col gap-2">
              <span className="font-serif text-lg leading-tight text-text">{profession.label}</span>
              <span className="text-body text-muted">{profession.description}</span>
              {profession.skills.length > 0 && (
                <span className="text-label text-text">
                  <span className="text-subtle">{t('creation.profession.skills')}</span>{' '}
                  {t('creation.list', { items: profession.skills.map(({ label }) => label) })}
                </span>
              )}
              {(profession.startingItems.length > 0 || profession.startingResources.length > 0) && (
                <span className="text-label text-text">
                  <span className="text-subtle">{t('creation.profession.kit')}</span>{' '}
                  {t('creation.list', {
                    items: [
                      ...profession.startingItems.map(({ item, quantity, equipped }) =>
                        t(
                          equipped
                            ? 'creation.profession.itemEquipped'
                            : 'creation.profession.item',
                          {
                            item: item.label,
                            count: quantity,
                          }
                        )
                      ),
                      ...profession.startingResources.map(({ label, value }) =>
                        t('creation.profession.resource', { resource: label, value })
                      ),
                    ],
                  })}
                </span>
              )}
            </span>
          </label>
        )
      })}

      <Issues issues={professionIssues} />
    </fieldset>
  )
}
