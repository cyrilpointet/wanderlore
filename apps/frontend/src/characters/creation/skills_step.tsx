import { useTranslation } from 'react-i18next'

import { SKILL_CATEGORIES } from '@/api/enums'
import type { BaseChance, CreationIssue, CreationWorld, Pool, PreviewSheet } from '../queries'
import { issuesOn, type Pool as PoolName } from './draft'
import { Issues } from './issues'

const PROFESSIONAL: PoolName = 'professional'
const PERSONAL: PoolName = 'personal'

type SkillRow = {
  reference: string
  label: string
  baseChance: BaseChance
  /** From the preview: null until it answers, or while the characteristic is not placed. */
  base: number | null
  value: number | null
  /** The draft's points, as the player types them: never late on the preview. */
  professional: number
  personal: number
}

/**
 * The two pools of points on the skills (front spec, section 5.6): the
 * professional one on the profession's skills only, the personal one on any.
 * Every figure — what is left, a skill's base and value — is the preview's;
 * points left over are pointed out, never in the way.
 */
export function SkillsStep({
  creation,
  profession,
  professionalPoints,
  personalPoints,
  sheet,
  issues,
  onPoints,
}: {
  creation: CreationWorld
  /** The profession chosen at the step before. */
  profession: string | null
  professionalPoints: Record<string, number>
  personalPoints: Record<string, number>
  sheet: PreviewSheet | null
  issues: CreationIssue[]
  onPoints: (pool: PoolName, skill: string, points: number) => void
}) {
  const { t } = useTranslation('characters')
  const trained = new Set(
    creation.professions
      .find(({ reference }) => reference === profession)
      ?.skills.map(({ reference }) => reference) ?? []
  )
  const previewed = new Map(sheet?.skills.map((skill) => [skill.reference, skill]))
  const rows = creation.skills.map((skill): SkillRow & { category: string } => {
    const preview = previewed.get(skill.reference)
    return {
      ...skill,
      base: preview?.base ?? null,
      value: preview?.value ?? null,
      professional: professionalPoints[skill.reference] ?? 0,
      personal: personalPoints[skill.reference] ?? 0,
    }
  })
  const poolIssues = {
    professional: issuesOn(issues, 'professionalPoints'),
    personal: issuesOn(issues, 'personalPoints'),
  }
  const own = rows.filter(({ reference }) => trained.has(reference))
  const others = SKILL_CATEGORIES.map((category) => ({
    category,
    skills: rows.filter((row) => row.category === category && !trained.has(row.reference)),
  })).filter(({ skills }) => skills.length > 0)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body text-muted">{t('creation.skills.intro')}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <PoolCard
          title={t('creation.skills.professionalPool')}
          pool={sheet?.professionalPool ?? null}
          issues={poolIssues.professional}
        />
        <PoolCard
          title={t('creation.skills.personalPool')}
          pool={sheet?.personalPool ?? null}
          issues={poolIssues.personal}
        />
      </div>

      {sheet?.skillCap !== null && sheet?.skillCap !== undefined && (
        <p className="text-label text-subtle">
          {t('creation.skills.cap', { cap: sheet.skillCap })}
        </p>
      )}

      {own.length > 0 && (
        <section>
          <h3 className="mb-3 text-meta text-subtle uppercase">
            {t('creation.skills.professionSkills')}
          </h3>
          <ul className="flex flex-col gap-2">
            {own.map((row) => (
              <SkillLine
                key={row.reference}
                row={row}
                professional
                issues={issues}
                onPoints={onPoints}
              />
            ))}
          </ul>
        </section>
      )}

      {others.map(({ category, skills }) => (
        <section key={category}>
          <h3 className="mb-3 text-meta text-subtle uppercase">
            {t(`skillCategory.${category}`, { ns: 'enums' })}
          </h3>
          <ul className="flex flex-col gap-2">
            {skills.map((row) => (
              <SkillLine
                key={row.reference}
                row={row}
                professional={false}
                issues={issues}
                onPoints={onPoints}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** A pool and what is left of it; points left over are pointed out, not refused. */
function PoolCard({
  title,
  pool,
  issues,
}: {
  title: string
  pool: Pool | null
  issues: CreationIssue[]
}) {
  const { t } = useTranslation('characters')

  return (
    <div className="rounded-lg border border-border-strong bg-surface-1 p-4">
      <p className="text-meta text-subtle uppercase">{title}</p>
      {pool ? (
        <>
          <p className="mt-1 text-body text-text tabular-nums">
            {t('creation.skills.left', { left: pool.left, total: pool.total })}
          </p>
          {pool.left > 0 && (
            <p className="mt-1 text-label text-muted">
              {t('creation.skills.unspent', { count: pool.left })}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-body text-muted">{t('creation.unknown')}</p>
      )}
      <Issues issues={issues} className="mt-2" />
    </div>
  )
}

function SkillLine({
  row,
  professional,
  issues,
  onPoints,
}: {
  row: SkillRow
  /** One of the profession's skills: the professional points go to it too. */
  professional: boolean
  issues: CreationIssue[]
  onPoints: (pool: PoolName, skill: string, points: number) => void
}) {
  const { t } = useTranslation('characters')
  const setPoints = (pool: PoolName) => (points: number) => onPoints(pool, row.reference, points)
  const own = [
    ...issuesOn(issues, `skills.${row.reference}`),
    ...issuesOn(issues, `professionalPoints.${row.reference}`),
    ...issuesOn(issues, `personalPoints.${row.reference}`),
  ]

  return (
    <li className="rounded-lg border border-border bg-surface-1 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-body text-text">{row.label}</span>
        <span className="shrink-0 text-body font-medium text-text tabular-nums">
          <span className="sr-only">{t('creation.skills.valueOf', { skill: row.label })}</span>
          {row.value === null ? t('creation.unknown') : t('creation.percent', { value: row.value })}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-label text-muted">
        <span className="tabular-nums">
          {row.base !== null
            ? t('creation.skills.base', { value: row.base })
            : typeof row.baseChance === 'number'
              ? t('creation.skills.base', { value: row.baseChance })
              : t('creation.skills.baseOf', {
                  characteristic: t(`characteristic.${row.baseChance.characteristic}`, {
                    ns: 'enums',
                  }),
                  multiplier: row.baseChance.multiplier,
                })}
        </span>
        {professional && (
          <PointsInput
            label={t('creation.skills.professionalShort')}
            accessibleLabel={t('creation.skills.professionalFor', { skill: row.label })}
            value={row.professional}
            onChange={setPoints(PROFESSIONAL)}
          />
        )}
        <PointsInput
          label={t('creation.skills.personalShort')}
          accessibleLabel={t('creation.skills.personalFor', { skill: row.label })}
          value={row.personal}
          onChange={setPoints(PERSONAL)}
        />
      </div>
      <Issues issues={own} className="mt-2" />
    </li>
  )
}

function PointsInput({
  label,
  accessibleLabel,
  value,
  onChange,
}: {
  label: string
  accessibleLabel: string
  value: number
  onChange: (points: number) => void
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span aria-hidden>{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        aria-label={accessibleLabel}
        // Empty rather than 0, so the field can be cleared and typed afresh.
        value={value === 0 ? '' : value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="h-9 w-16 rounded-md border border-border-strong bg-surface-2 px-2 text-right text-body text-text tabular-nums focus:border-accent focus:outline-none"
      />
    </label>
  )
}
