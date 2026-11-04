import { useTranslation } from 'react-i18next'

import { CHARACTERISTICS, GENDERS, type Gender } from '@/api/enums'
import type { CreationIssue, CreationWorld, PreviewSheet } from '../queries'
import { issuesOn } from './draft'
import { Issues } from './issues'

/**
 * Who the character is: a name, a gender — then the whole sheet as the
 * backend computes it, before **Create**.
 */
export function IdentityStep({
  creation,
  name,
  gender,
  profession,
  sheet,
  issues,
  onName,
  onGender,
}: {
  creation: CreationWorld
  name: string
  gender: Gender | null
  profession: string | null
  sheet: PreviewSheet | null
  issues: CreationIssue[]
  onName: (name: string) => void
  onGender: (gender: Gender) => void
}) {
  const { t } = useTranslation('characters')
  const max = creation.nameMaxLength
  const labelOf = new Map(creation.skills.map(({ reference, label }) => [reference, label]))
  const trained = (sheet?.skills ?? []).filter(
    ({ reference, professional, personal }) => professional + personal > 0 && labelOf.has(reference)
  )
  const professionLabel = creation.professions.find(
    ({ reference }) => reference === profession
  )?.label
  // An empty name is not done yet, rather than wrong.
  const nameIssues = name.trim() === '' ? [] : issuesOn(issues, 'name')
  const genderIssues = issuesOn(issues, 'gender')

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="character-name" className="text-label font-medium text-muted">
          {t('creation.identity.name')}
        </label>
        <input
          id="character-name"
          type="text"
          autoComplete="off"
          maxLength={max}
          value={name}
          aria-invalid={nameIssues.length > 0 ? true : undefined}
          aria-describedby="character-name-counter"
          onChange={(event) => onName(event.target.value)}
          className="h-11 w-full rounded-lg border border-border-strong bg-surface-1 px-3 text-body text-text transition-colors focus:border-accent focus:outline-none"
        />
        <p
          id="character-name-counter"
          className={`text-right text-meta ${name.length >= max ? 'text-danger' : 'text-subtle'}`}
        >
          {t('creation.identity.counter', { count: name.length, max })}
        </p>
        <Issues issues={nameIssues} />
      </div>

      <fieldset>
        <legend className="mb-2 text-label font-medium text-muted">
          {t('creation.identity.gender')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((value) => (
            <label
              key={value}
              className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-body transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent ${
                gender === value
                  ? 'border-accent bg-accent/10 text-text'
                  : 'border-border-strong bg-surface-1 text-muted'
              }`}
            >
              <input
                type="radio"
                name="gender"
                value={value}
                checked={gender === value}
                onChange={() => onGender(value)}
                className="size-4 accent-accent"
              />
              {t(`gender.${value}`, { ns: 'enums' })}
            </label>
          ))}
        </div>
      </fieldset>

      <section className="rounded-lg border border-border bg-surface-1 p-5">
        <h3 className="text-meta text-subtle uppercase">{t('creation.identity.summary')}</h3>
        <p className="mt-2 font-serif text-xl text-text">
          {name.trim() || t('creation.identity.unnamed')}
        </p>
        <p className="mt-1 text-label text-muted">
          {[
            professionLabel,
            gender ? t(`gender.${gender}`, { ns: 'enums' }) : null,
            creation.world.label,
          ]
            .filter(Boolean)
            .join(t('separator'))}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5">
          {CHARACTERISTICS.map((characteristic) => (
            <div
              key={characteristic}
              className="flex items-baseline justify-between gap-4 text-body"
            >
              <dt className="text-muted">
                {t(`characteristic.${characteristic}`, { ns: 'enums' })}
              </dt>
              <dd className="text-text tabular-nums">
                {sheet?.characteristics[characteristic] ?? t('creation.unknown')}
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 text-body">
            <dt className="text-muted">{t('creation.identity.hitPoints')}</dt>
            <dd className="text-text tabular-nums">{sheet?.hitPoints ?? t('creation.unknown')}</dd>
          </div>
        </dl>

        {trained.length > 0 && (
          <dl className="mt-4 flex flex-col gap-1 border-t border-border pt-4">
            {trained.map((skill) => (
              <div
                key={skill.reference}
                className="flex items-baseline justify-between gap-4 text-label text-muted"
              >
                <dt>{labelOf.get(skill.reference)}</dt>
                <dd className="tabular-nums">
                  {skill.value === null
                    ? t('creation.unknown')
                    : t('creation.percent', { value: skill.value })}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <Issues issues={genderIssues} />
    </div>
  )
}
