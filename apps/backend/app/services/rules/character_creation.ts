import { baseChanceOf, hitPointsFor } from './derived.js'
import { PERSONAL_POINTS_PER_INT, POWER_LEVEL_SCALE } from './power_levels.js'
import {
  type BaseChance,
  CHARACTERISTICS,
  type Characteristic,
  type Characteristics,
  type PowerLevel,
} from './types.js'

/**
 * Creating a character, as the book does it (rules, section 3bis): the
 * series rolled is placed, SIZ and INT are raised to 8, a profession is
 * picked, and two pools of points go to the skills — the professional one to
 * the profession's, the personal one to any. Pure: the same calculation
 * answers the preview the front shows at every change, and checks the
 * creation it submits once.
 *
 * Written as a chain of steps, each handed the sheet as it stands: the
 * adjustment of a species (roadmap, Phase 13bis) slots in right after the
 * placement, before the floor of 8, without rewriting the rest.
 */

/**
 * Each result of the series is four d6, the lowest set aside and the three
 * best added up (a departure from the book's 3D6, common at real tables):
 * still 3 to 18, but weighted towards the middle and above.
 */
export const DICE_PER_RESULT = 4
export const DICE_KEPT = 3

/** One result of the series: the four d6 as drawn, the one set aside, and the total of the others. */
export type ResultDice = {
  faces: number[]
  /** The position, in `faces`, of the die set aside. */
  dropped: number
  value: number
}

/**
 * Keeps the best three of four d6. Of equal lowest faces, the first is set
 * aside: which one does not change the total, only which die is greyed out.
 */
export function keepBestThree(faces: number[]): ResultDice {
  const dropped = faces.indexOf(Math.min(...faces))
  const value = faces.reduce((total, face, index) => (index === dropped ? total : total + face), 0)

  return { faces, dropped, value }
}

/** The floor of SIZ and INT: a lower result placed there is raised to it. */
export const CHARACTERISTIC_FLOOR = 8
const FLOORED: Characteristic[] = ['SIZ', 'INT']

export const NAME_MAX_LENGTH = 35
/** Letters of any script, spaces, apostrophes, hyphens and full stops — and a letter at least. */
const NAME = /^[\p{L}\p{M} '’.-]+$/u

export type CreationGender = 'female' | 'male' | 'neutral'

/** What the world brings to a creation: its level, its skills, its professions. */
export type CreationWorld = {
  powerLevel: PowerLevel
  skills: { reference: string; baseChance: BaseChance }[]
  professions: { reference: string; skills: string[] }[]
}

/** The player's choices so far: any of them may still be missing in a preview. */
export type CharacterDraft = {
  /** Which result of the series goes to each characteristic, by its position in the series. */
  placement: Partial<Record<Characteristic, number>>
  profession: string | null
  professionalPoints: Record<string, number>
  personalPoints: Record<string, number>
  name: string
  gender: CreationGender | null
}

export type CreationIssueCode =
  | 'no_characteristic_roll'
  | 'invalid_placement'
  | 'incomplete_placement'
  | 'unknown_profession'
  | 'missing_profession'
  | 'unknown_skill'
  | 'profession_skill_only'
  | 'pool_exceeded'
  | 'skill_cap_exceeded'
  | 'invalid_character_name'
  | 'missing_gender'

/** Something the draft gets wrong, on the path of the field at fault (`personalPoints`). */
export type CreationIssue = {
  code: CreationIssueCode
  field: string
  reference?: string
}

export type CreatedSkill = {
  reference: string
  /** What the skill is worth untrained, on the characteristics placed; null until they all are. */
  base: number | null
  professional: number
  personal: number
  /** Base and points; null while the base is. */
  value: number | null
}

export type Pool = { total: number; spent: number; left: number }

/** The sheet as the draft makes it, as far as it goes. */
export type CreationSheet = {
  /** As placed and raised; a characteristic not placed yet is null. */
  characteristics: Record<Characteristic, number | null>
  /** Those a result under 8 was raised on. */
  raised: Characteristic[]
  profession: string | null
  /** Every skill of the world, in its order. */
  skills: CreatedSkill[]
  professionalPool: Pool
  /** INT × 10: unknown until INT is placed. */
  personalPool: Pool | null
  /** The most a skill may be worth once created; null: no cap. */
  skillCap: number | null
  /** What a game starts at, CON + SIZ; null until both are placed. */
  hitPoints: number | null
}

export type CreationResult = {
  sheet: CreationSheet
  issues: CreationIssue[]
}

/**
 * Works the draft through, step after step. `series` is the player's current
 * series, read from the base — null when they have none.
 */
export function createCharacter(
  world: CreationWorld,
  series: number[] | null,
  draft: CharacterDraft
): CreationResult {
  const issues: CreationIssue[] = []
  const report = (code: CreationIssueCode, field: string, reference?: string) =>
    issues.push(reference === undefined ? { code, field } : { code, field, reference })

  let characteristics = placeSeries(series, draft.placement, report)
  /** Phase 13bis: the species adjusts the characteristics here, before the floor. */
  const floored = raiseToFloor(characteristics)
  characteristics = floored.characteristics

  const scale = POWER_LEVEL_SCALE[world.powerLevel]
  const profession = pickProfession(world, draft.profession, report)
  const skills = spendPoints(world, characteristics, profession, draft, scale.skillCap, report)
  const pools = poolsOf(characteristics, scale.professionalPoints, draft, report)

  checkIdentity(draft, report)

  return {
    sheet: {
      characteristics,
      raised: floored.raised,
      profession: profession?.reference ?? null,
      skills,
      ...pools,
      skillCap: scale.skillCap,
      hitPoints:
        characteristics.CON !== null && characteristics.SIZ !== null
          ? hitPointsFor(characteristics as Characteristics)
          : null,
    },
    issues,
  }
}

/** Whether every characteristic has its score: what the creation needs, and the sheet stores. */
export function isComplete(
  characteristics: Record<Characteristic, number | null>
): characteristics is Characteristics {
  return CHARACTERISTICS.every((name) => characteristics[name] !== null)
}

type Report = (code: CreationIssueCode, field: string, reference?: string) => void

/**
 * The series placed: each result goes to one characteristic, and each
 * characteristic gets one result — an exact permutation of what was rolled,
 * nothing else.
 */
function placeSeries(
  series: number[] | null,
  placement: CharacterDraft['placement'],
  report: Report
): Record<Characteristic, number | null> {
  const placed = Object.fromEntries(CHARACTERISTICS.map((name) => [name, null])) as Record<
    Characteristic,
    number | null
  >

  if (series === null) {
    report('no_characteristic_roll', 'placement')
    return placed
  }

  const used = new Set<number>()
  let invalid = false

  for (const [name, index] of Object.entries(placement)) {
    if (!(CHARACTERISTICS as readonly string[]).includes(name)) {
      report('invalid_placement', `placement.${name}`, name)
      invalid = true
      continue
    }
    if (
      index === undefined ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= series.length ||
      used.has(index)
    ) {
      report('invalid_placement', `placement.${name}`, name)
      invalid = true
      continue
    }

    used.add(index)
    placed[name as Characteristic] = series[index]
  }

  /** An invalid entry already says what is wrong with the placement; a gap would say it again. */
  const missing = CHARACTERISTICS.filter((name) => placed[name] === null)
  if (missing.length > 0 && !invalid) {
    report('incomplete_placement', 'placement', missing[0])
  }

  return placed
}

/** SIZ and INT never under 8: a lower result placed there is raised to it. */
function raiseToFloor(characteristics: Record<Characteristic, number | null>) {
  const raised: Characteristic[] = []
  const result = { ...characteristics }

  for (const name of FLOORED) {
    const score = result[name]

    if (score !== null && score < CHARACTERISTIC_FLOOR) {
      result[name] = CHARACTERISTIC_FLOOR
      raised.push(name)
    }
  }

  return { characteristics: result, raised }
}

function pickProfession(world: CreationWorld, reference: string | null, report: Report) {
  if (reference === null) {
    report('missing_profession', 'profession')
    return null
  }

  const profession = world.professions.find((entry) => entry.reference === reference)

  if (!profession) {
    report('unknown_profession', 'profession', reference)
    return null
  }

  return profession
}

/**
 * The points of both pools, skill by skill, on top of the base chance worked
 * out on the characteristics placed. The professional ones go to the
 * profession's skills only; the cap bears on the final value.
 */
function spendPoints(
  world: CreationWorld,
  characteristics: Record<Characteristic, number | null>,
  profession: CreationWorld['professions'][number] | null,
  draft: CharacterDraft,
  cap: number | null,
  report: Report
): CreatedSkill[] {
  const known = new Set(world.skills.map(({ reference }) => reference))
  const trained = new Set(profession?.skills ?? [])

  for (const [field, points] of [
    ['professionalPoints', draft.professionalPoints],
    ['personalPoints', draft.personalPoints],
  ] as const) {
    for (const reference of Object.keys(points)) {
      if (!known.has(reference)) report('unknown_skill', `${field}.${reference}`, reference)
    }
  }
  for (const [reference, points] of Object.entries(draft.professionalPoints)) {
    if (points > 0 && known.has(reference) && profession !== null && !trained.has(reference)) {
      report('profession_skill_only', `professionalPoints.${reference}`, reference)
    }
  }

  return world.skills.map(({ reference, baseChance }) => {
    const base = baseOf(baseChance, characteristics)
    const professional = draft.professionalPoints[reference] ?? 0
    const personal = draft.personalPoints[reference] ?? 0
    const value = base === null ? null : base + professional + personal

    if (cap !== null && value !== null && value > cap && professional + personal > 0) {
      report('skill_cap_exceeded', `skills.${reference}`, reference)
    }

    return { reference, base, professional, personal, value }
  })
}

/** Unknown while the characteristic it rests on is not placed. */
function baseOf(
  base: BaseChance,
  characteristics: Record<Characteristic, number | null>
): number | null {
  if (typeof base === 'number') {
    return base
  }

  const score = characteristics[base.characteristic]

  return score === null ? null : baseChanceOf(base, { [base.characteristic]: score } as never)
}

/** Neither pool is overspent; what is left over is allowed. */
function poolsOf(
  characteristics: Record<Characteristic, number | null>,
  professionalPoints: number,
  draft: CharacterDraft,
  report: Report
) {
  const spent = (points: Record<string, number>) =>
    Object.values(points).reduce((total, value) => total + value, 0)

  const professional = spent(draft.professionalPoints)
  if (professional > professionalPoints) report('pool_exceeded', 'professionalPoints')

  const personal = spent(draft.personalPoints)
  const int = characteristics.INT
  const personalTotal = int === null ? null : int * PERSONAL_POINTS_PER_INT
  if (personalTotal !== null && personal > personalTotal) report('pool_exceeded', 'personalPoints')

  return {
    professionalPool: {
      total: professionalPoints,
      spent: professional,
      left: professionalPoints - professional,
    },
    personalPool:
      personalTotal === null
        ? null
        : { total: personalTotal, spent: personal, left: personalTotal - personal },
  }
}

function checkIdentity(draft: CharacterDraft, report: Report) {
  if (!isValidName(draft.name)) {
    report('invalid_character_name', 'name')
  }
  if (draft.gender === null) {
    report('missing_gender', 'gender')
  }
}

/** 1 to 35 characters once trimmed, from the letters and the few marks a name may hold. */
export function isValidName(name: string): boolean {
  const trimmed = name.trim()

  return (
    trimmed.length >= 1 &&
    trimmed.length <= NAME_MAX_LENGTH &&
    NAME.test(trimmed) &&
    /\p{L}/u.test(trimmed)
  )
}
