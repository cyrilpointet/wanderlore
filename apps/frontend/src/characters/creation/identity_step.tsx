import { useTranslation } from 'react-i18next'

import { CHARACTERISTICS, GENDERS, type Gender } from '@/api/enums'
import { HitPoints } from '@/components/hit_points'
import { CARD, INSET, LABEL } from '@/components/surfaces'
import type { CreationIssue, CreationWorld, PreviewSheet } from '../queries'
import { issuesOn } from './draft'
import { Issues } from './issues'
import { kitOf } from './kit'

/**
 * Who the character is: a name, a gender — then the whole sheet as the
 * backend computes it, on the card beside them, before **Create**.
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
  // Strongest first, as a sheet reads; those yet to be valued last.
  const trained = (sheet?.skills ?? [])
    .filter(
      ({ reference, professional, personal }) =>
        professional + personal > 0 && labelOf.has(reference)
    )
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
  const chosen = creation.professions.find(({ reference }) => reference === profession)
  const professionLabel = chosen?.label
  const kit = chosen ? kitOf(chosen, t) : []
  // An empty name is not done yet, rather than wrong.
  const nameIssues = name.trim() === '' ? [] : issuesOn(issues, 'name')
  const genderIssues = issuesOn(issues, 'gender')

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="character-name" className="text-[0.78125rem] font-semibold text-muted">
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
            className="h-11 w-full rounded-md border border-border-strong bg-paper px-3 text-body text-text transition-colors focus:border-accent focus:outline-none aria-invalid:border-danger"
          />
          <p
            id="character-name-counter"
            className={`text-right text-xs tabular-nums ${name.length >= max ? 'text-danger' : 'text-subtle'}`}
          >
            {t('creation.identity.counter', { count: name.length, max })}
          </p>
          <Issues issues={nameIssues} />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[0.78125rem] font-semibold text-muted">
            {t('creation.identity.gender')}
          </legend>
          {/* A segmented control: the radio buttons are its segments. */}
          <div className="flex gap-0.5 rounded-lg bg-tray p-[3px] shadow-tray">
            {GENDERS.map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-md px-3.5 py-2 text-[0.84375rem] leading-none transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent ${
                  gender === value
                    ? 'bg-card font-semibold text-text shadow-card'
                    : 'font-medium text-muted hover:text-text'
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  value={value}
                  checked={gender === value}
                  onChange={() => onGender(value)}
                  className="sr-only"
                />
                {t(`gender.${value}`, { ns: 'enums' })}
              </label>
            ))}
          </div>
          <Issues issues={genderIssues} />
        </fieldset>
      </div>

      <section aria-labelledby="creation-summary" className="flex flex-col gap-2.5">
        <h3 id="creation-summary" className={LABEL}>
          {t('creation.identity.summary')}
        </h3>
        {/* The finished character, as the backend computes it: an index card. */}
        <div className={`${CARD} flex flex-col gap-4 p-[18px]`}>
          <div>
            <p
              className={`font-serif text-[1.625rem] leading-tight font-semibold break-words ${
                name.trim() ? 'text-text' : 'text-subtle'
              }`}
            >
              {name.trim() || t('creation.identity.unnamed')}
            </p>
            <p className="mt-0.5 text-[0.84375rem] text-muted">
              {[professionLabel, gender ? t(`gender.${gender}`, { ns: 'enums' }) : null]
                .filter(Boolean)
                .join(t('separator'))}
            </p>
          </div>

          <div className={`${INSET} flex flex-col gap-2.5 px-3.5 py-3`}>
            <div className="flex items-center justify-between">
              <h4 className={LABEL}>{t('creation.identity.hitPoints')}</h4>
              {sheet?.hitPoints == null ? (
                <span className="text-[0.8125rem] font-semibold text-hp">
                  {t('creation.unknown')}
                </span>
              ) : (
                <span aria-hidden className="text-[0.8125rem] font-semibold text-hp tabular-nums">
                  {t('hitPoints.value', {
                    ns: 'common',
                    current: sheet.hitPoints,
                    max: sheet.hitPoints,
                  })}
                </span>
              )}
            </div>
            {sheet?.hitPoints != null && (
              <HitPoints
                current={sheet.hitPoints}
                max={sheet.hitPoints}
                size="large"
                value={false}
              />
            )}
          </div>

          <dl className="grid grid-cols-7 gap-[5px]">
            {CHARACTERISTICS.map((characteristic) => {
              const value = sheet?.characteristics[characteristic] ?? null
              return (
                <div
                  key={characteristic}
                  className={`${INSET} flex flex-col items-center gap-0.5 pt-[7px] pb-1.5`}
                >
                  <dt className="text-[0.59375rem] leading-none font-semibold tracking-[0.06em] text-subtle">
                    <abbr
                      title={t(`characteristic.${characteristic}`, { ns: 'enums' })}
                      className="no-underline"
                    >
                      {t(`characteristicShort.${characteristic}`, { ns: 'enums' })}
                    </abbr>
                  </dt>
                  <dd className="text-[1.0625rem] leading-tight font-semibold text-text tabular-nums">
                    {value === null ? t('creation.unknown') : t('number', { ns: 'common', value })}
                  </dd>
                </div>
              )
            })}
          </dl>

          {trained.length > 0 && (
            <dl>
              {trained.map((skill) => (
                <div
                  key={skill.reference}
                  className="flex items-baseline gap-1.5 text-[0.90625rem] leading-[1.9] text-text"
                >
                  <dt>{labelOf.get(skill.reference)}</dt>
                  <span
                    aria-hidden
                    className="flex-1 -translate-y-1 border-b-[1.5px] border-dotted border-leader"
                  />
                  <dd className="font-semibold tabular-nums">
                    {skill.value === null
                      ? t('creation.unknown')
                      : t('creation.percent', { value: skill.value })}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {kit.length > 0 && (
            <p className="text-label text-muted">
              <span className="font-semibold text-text">{t('creation.profession.kit')}</span>{' '}
              {t('creation.list', { items: kit })}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
