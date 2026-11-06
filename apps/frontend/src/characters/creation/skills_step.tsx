import { Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SKILL_CATEGORIES } from '@/api/enums'
import { CARD, LABEL } from '@/components/surfaces'
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
    <>
      <p className="font-serif text-[0.9375rem] leading-relaxed text-muted">
        {t('creation.skills.intro')}
      </p>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-3 lg:sticky lg:top-5">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1">
            <PoolCard
              title={t('creation.skills.professionalPool')}
              pool={sheet?.professionalPool ?? null}
              issues={poolIssues.professional}
              tone="professional"
            />
            <PoolCard
              title={t('creation.skills.personalPool')}
              pool={sheet?.personalPool ?? null}
              issues={poolIssues.personal}
              tone="personal"
            />
          </div>

          {sheet?.skillCap !== null && sheet?.skillCap !== undefined && (
            <p className="text-label text-subtle">
              {t('creation.skills.cap', { cap: sheet.skillCap })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-[22px]">
          {own.length > 0 && (
            <section>
              <h3 className={`mb-1 ${LABEL}`}>{t('creation.skills.professionSkills')}</h3>
              <ul>
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
              <h3 className={`mb-1 ${LABEL}`}>{t(`skillCategory.${category}`, { ns: 'enums' })}</h3>
              <ul>
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
      </div>
    </>
  )
}

/** How many counters a pool's stack holds: a picture of what is left, not a figure. */
const COUNTERS = 10

/** The colour of a pool's counters. */
const COUNTER_TONES = {
  professional: 'bg-accent shadow-[0_1px_0_var(--color-accent-hover)]',
  personal: 'bg-success shadow-[0_1px_0_var(--color-muted)]',
}

/**
 * A pool and what is left of it, on a small card; points left over are
 * pointed out, not refused. The stack of counters only pictures the share
 * left — the figures are the preview's.
 */
function PoolCard({
  title,
  pool,
  issues,
  tone,
}: {
  title: string
  pool: Pool | null
  issues: CreationIssue[]
  tone: keyof typeof COUNTER_TONES
}) {
  const { t } = useTranslation('characters')
  const standing =
    pool && pool.total > 0
      ? Math.min(COUNTERS, Math.max(0, Math.ceil((pool.left / pool.total) * COUNTERS)))
      : 0

  return (
    <div className={`${CARD} flex flex-col gap-2 p-3`}>
      <p className={LABEL}>{title}</p>
      {pool ? (
        <>
          <div className="flex items-end gap-2.5">
            <span aria-hidden className="flex flex-col-reverse pt-0.5">
              {Array.from({ length: COUNTERS }, (_, counter) => (
                <span
                  key={counter}
                  className={`-mt-0.5 block h-1.5 w-[26px] rounded-[50%] ${COUNTER_TONES[tone]} ${
                    counter < standing ? '' : 'opacity-20'
                  }`}
                />
              ))}
            </span>
            <span
              aria-hidden
              className="text-[1.625rem] leading-none font-semibold text-text tabular-nums"
            >
              {t('number', { ns: 'common', value: pool.left })}
            </span>
          </div>
          <p className="text-xs text-subtle tabular-nums">
            {t('creation.skills.left', { left: pool.left, total: pool.total })}
          </p>
          {pool.left > 0 && (
            <p className="text-xs text-muted">
              {t('creation.skills.unspent', { count: pool.left })}
            </p>
          )}
        </>
      ) : (
        <p className="text-body text-muted">{t('creation.unknown')}</p>
      )}
      <Issues issues={issues} />
    </div>
  )
}

/** What a step of the − and + buttons moves, in points. */
const POINTS_STEP = 5

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
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-2 border-b border-border py-2.5 lg:grid-cols-[minmax(0,1fr)_auto_64px]">
      <div className="col-start-1 row-start-1 min-w-0">
        <span className="block text-[0.90625rem] leading-snug font-semibold text-text">
          {row.label}
        </span>
        <span className="text-xs text-subtle tabular-nums">
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
      </div>
      <div className="col-span-2 row-start-2 flex flex-wrap items-center gap-x-3.5 gap-y-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
        {professional && (
          <PointsStepper
            label={t('creation.skills.professionalShort')}
            accessibleLabel={t('creation.skills.professionalFor', { skill: row.label })}
            value={row.professional}
            onChange={setPoints(PROFESSIONAL)}
          />
        )}
        <PointsStepper
          label={t('creation.skills.personalShort')}
          accessibleLabel={t('creation.skills.personalFor', { skill: row.label })}
          value={row.personal}
          onChange={setPoints(PERSONAL)}
        />
      </div>
      <span className="col-start-2 row-start-1 text-end text-[1.0625rem] leading-none font-bold text-text tabular-nums lg:col-start-3">
        <span className="sr-only">{t('creation.skills.valueOf', { skill: row.label })}</span>
        {row.value === null ? t('creation.unknown') : t('creation.percent', { value: row.value })}
      </span>
      <Issues issues={own} className="col-span-full" />
    </li>
  )
}

/**
 * The points one pool puts on one skill: a field to type them in, between
 * − and + for the pointer. The field is the keyboard's way (its arrows step
 * it too), so the buttons stay out of the tab order.
 */
function PointsStepper({
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
  const { t } = useTranslation('characters')

  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-subtle">
      <span aria-hidden className="me-1.5">
        {label}
      </span>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('creation.skills.fewer', { count: POINTS_STEP, field: accessibleLabel })}
        disabled={!(value > 0)}
        onClick={() => onChange(Math.max(0, value - POINTS_STEP))}
        className={STEPPER_BUTTON}
      >
        <Minus aria-hidden className="size-3.5" />
      </button>
      <input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        aria-label={accessibleLabel}
        // Empty rather than 0, so the field can be cleared and typed afresh.
        value={value === 0 ? '' : value}
        placeholder={t('number', { ns: 'common', value: 0 })}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="h-7 w-10 appearance-none rounded-sm border border-transparent bg-transparent text-center text-[0.875rem] font-semibold text-text tabular-nums placeholder:text-text hover:border-border focus:border-accent focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('creation.skills.more', { count: POINTS_STEP, field: accessibleLabel })}
        onClick={() => onChange((Number.isFinite(value) ? value : 0) + POINTS_STEP)}
        className={STEPPER_BUTTON}
      >
        <Plus aria-hidden className="size-3.5" />
      </button>
    </span>
  )
}

const STEPPER_BUTTON =
  'grid size-7 place-items-center rounded-md border border-border-strong bg-card text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:text-subtle disabled:opacity-60'
