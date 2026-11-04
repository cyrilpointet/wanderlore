import { CHARACTERISTICS, type Characteristic, type Gender } from '@/api/enums'
import type { CharacteristicRoll, CreationIssue, DraftBody } from '../queries'

/**
 * The draft of a character, as the player builds it step by step (front
 * spec, section 5.6). Pure: it holds the player's choices and where they
 * stand, never a value of the sheet — those all come from the preview the
 * backend computes.
 */

/** The steps of the creation, as they come. */
export type StepId = 'dice' | 'placement' | 'profession' | 'skills' | 'identity'

/**
 * A step, and what it answers for: the codes of a refusal that send the
 * player back to it, and the fields of the draft it edits (a field's path
 * starts with one of them: `skills.fencing` belongs to `skills`).
 */
export type StepDefinition = {
  id: StepId
  codes: readonly string[]
  fields: readonly string[]
}

/**
 * The steps in their order. Never referred to by position: a step that only
 * some worlds have — a species, before the placement — slots in this list
 * without anything else moving.
 */
export const CREATION_STEPS: readonly StepDefinition[] = [
  { id: 'dice', codes: ['no_characteristic_roll', 'stale_characteristic_roll'], fields: [] },
  { id: 'placement', codes: [], fields: ['placement'] },
  { id: 'profession', codes: [], fields: ['profession'] },
  { id: 'skills', codes: [], fields: ['professionalPoints', 'personalPoints', 'skills'] },
  { id: 'identity', codes: [], fields: ['name', 'gender'] },
]

/** The creation came on a series replaced since — rolled again in another tab. */
const STALE_ROLL = 'stale_characteristic_roll'

/** Why the creation was refused, shown on the step it sends the player back to. */
export type Refusal = { code: string; message: string }

export type Draft = {
  steps: readonly StepDefinition[]
  step: StepId
  /** The furthest step reached: the player may go back to any step up to it. */
  reached: StepId
  /** The series drawn by the backend; null until the first roll. */
  roll: CharacteristicRoll | null
  /** Which result of the series goes to each characteristic, by its position in the series. */
  placement: Partial<Record<Characteristic, number>>
  profession: string | null
  professionalPoints: Record<string, number>
  personalPoints: Record<string, number>
  name: string
  gender: Gender | null
  /** Cleared as soon as the player changes anything or moves on. */
  refusal: Refusal | null
}

export type Pool = 'professional' | 'personal'

export type DraftAction =
  /** A new series: it replaces the last, and undoes the placement. */
  | { type: 'rolled'; roll: CharacteristicRoll }
  /** A result goes to a characteristic; one that held it gets the result it gives up, if any. */
  | { type: 'placed'; characteristic: Characteristic; index: number }
  | { type: 'unplaced'; characteristic: Characteristic }
  /** Another profession: the professional points went to the old one's skills, they go. */
  | { type: 'profession_chosen'; profession: string }
  | { type: 'points_set'; pool: Pool; skill: string; points: number }
  | { type: 'named'; name: string }
  | { type: 'gender_chosen'; gender: Gender }
  | { type: 'next' }
  | { type: 'back' }
  /** To a step already reached. */
  | { type: 'went'; step: StepId }
  /** The creation was refused: back to the step of the field at fault, if one is named. */
  | { type: 'refused'; code: string; message: string; field?: string }

export function initialDraft(steps: readonly StepDefinition[] = CREATION_STEPS): Draft {
  const first = steps[0]?.id ?? 'dice'

  return {
    steps,
    step: first,
    reached: first,
    roll: null,
    placement: {},
    profession: null,
    professionalPoints: {},
    personalPoints: {},
    name: '',
    gender: null,
    refusal: null,
  }
}

const indexOf = (draft: Draft, step: StepId) => draft.steps.findIndex(({ id }) => id === step)

/** The step a refusal or an issue belongs to: by its code first, then by its field. */
export function stepOf(
  steps: readonly StepDefinition[],
  issue: { code: string; field?: string }
): StepId | null {
  const byCode = steps.find(({ codes }) => codes.includes(issue.code))
  if (byCode) return byCode.id

  const { field } = issue
  if (field === undefined) return null

  const byField = steps.find(({ fields }) =>
    fields.some((owned) => field === owned || field.startsWith(`${owned}.`))
  )
  return byField?.id ?? null
}

/** The issues of the preview that belong to a step. */
export function issuesOf(
  steps: readonly StepDefinition[],
  step: StepId,
  issues: readonly CreationIssue[]
): CreationIssue[] {
  return issues.filter((issue) => stepOf(steps, issue) === step)
}

/** The issues on exactly this field: `skills.fencing`, not `skills`. */
export function issuesOn(issues: readonly CreationIssue[], field: string): CreationIssue[] {
  return issues.filter((issue) => issue.field === field)
}

/**
 * What says a step is not done yet rather than done wrong: it keeps the
 * player from going on, but is not shown as an error while they work.
 */
const NOT_DONE_YET = new Set([
  'no_characteristic_roll',
  'incomplete_placement',
  'missing_profession',
  'missing_gender',
])

export function shownIssues(issues: readonly CreationIssue[]): CreationIssue[] {
  return issues.filter(({ code }) => !NOT_DONE_YET.has(code))
}

/** The draft as the backend reads it, for the preview and the creation. */
export function draftBody(worldId: string, draft: Draft): DraftBody {
  return {
    worldId,
    placement: draft.placement,
    profession: draft.profession,
    professionalPoints: draft.professionalPoints,
    personalPoints: draft.personalPoints,
    name: draft.name,
    gender: draft.gender,
  }
}

export function draftReducer(state: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case 'rolled':
      return {
        ...state,
        roll: action.roll,
        placement: {},
        // What comes after the dice rested on the old series: it has to be gone through again.
        reached: state.step,
        refusal: null,
      }

    case 'placed': {
      const { characteristic, index } = action
      if (!state.roll || !Number.isInteger(index) || index < 0 || index >= state.roll.values.length)
        return state

      const placement = { ...state.placement }
      const given = placement[characteristic]
      const holder = CHARACTERISTICS.find(
        (other) => other !== characteristic && placement[other] === index
      )

      if (holder) {
        if (given === undefined) delete placement[holder]
        else placement[holder] = given
      }
      placement[characteristic] = index

      return { ...state, placement, refusal: null }
    }

    case 'unplaced': {
      const placement = { ...state.placement }
      delete placement[action.characteristic]
      return { ...state, placement, refusal: null }
    }

    case 'profession_chosen':
      if (action.profession === state.profession) return state
      return {
        ...state,
        profession: action.profession,
        professionalPoints: {},
        refusal: null,
      }

    case 'points_set': {
      const key = action.pool === 'professional' ? 'professionalPoints' : 'personalPoints'
      const points = { ...state[key] }
      const value = Number.isFinite(action.points) ? Math.max(0, Math.trunc(action.points)) : 0

      if (value === 0) delete points[action.skill]
      else points[action.skill] = value

      return { ...state, [key]: points, refusal: null }
    }

    case 'named':
      return { ...state, name: action.name, refusal: null }

    case 'gender_chosen':
      return { ...state, gender: action.gender, refusal: null }

    case 'next': {
      const next = state.steps[indexOf(state, state.step) + 1]
      if (!next) return state
      return {
        ...state,
        step: next.id,
        reached: furthest(state, state.reached, next.id),
        refusal: null,
      }
    }

    case 'back': {
      const previous = state.steps[indexOf(state, state.step) - 1]
      if (!previous) return state
      return { ...state, step: previous.id, refusal: null }
    }

    case 'went':
      if (
        indexOf(state, action.step) < 0 ||
        indexOf(state, action.step) > indexOf(state, state.reached)
      )
        return state
      return { ...state, step: action.step, refusal: null }

    case 'refused': {
      const step = stepOf(state.steps, action) ?? state.step
      const refused = { ...state, step, refusal: { code: action.code, message: action.message } }
      // The series was replaced since: it is gone, and the placement made on it with it.
      return action.code === STALE_ROLL
        ? { ...refused, roll: null, placement: {}, reached: step }
        : refused
    }
  }
}

/** The later of two steps. */
function furthest(state: Draft, a: StepId, b: StepId): StepId {
  return indexOf(state, a) >= indexOf(state, b) ? a : b
}
