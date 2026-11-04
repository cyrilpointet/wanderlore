import { describe, expect, test } from 'vitest'

import {
  CREATION_STEPS,
  draftBody,
  draftReducer,
  initialDraft,
  issuesOf,
  shownIssues,
  stepOf,
  type Draft,
  type DraftAction,
  type StepDefinition,
} from './draft'

/** The three d6 of each result only matter to the dice step: the draft keeps them as drawn. */
const DICE = Array.from({ length: 7 }, () => [1, 2, 3])
const ROLL = { id: 'roll-1', values: [14, 9, 6, 12, 17, 10, 8], dice: DICE }
const REROLL = { id: 'roll-2', values: [11, 11, 13, 5, 15, 7, 16], dice: DICE }

function run(...actions: DraftAction[]): Draft {
  return actions.reduce(draftReducer, initialDraft())
}

const rolled: DraftAction = { type: 'rolled', roll: ROLL }
const next: DraftAction = { type: 'next' }

describe('creation draft — steps', () => {
  test('starts on the dice, nothing chosen', () => {
    expect(initialDraft()).toMatchObject({
      step: 'dice',
      reached: 'dice',
      roll: null,
      placement: {},
      profession: null,
      name: '',
      gender: null,
    })
  })

  test('goes through the steps in the order of the list, and stops at the last', () => {
    const steps = [rolled, next, next, next, next]

    expect(run(...steps.slice(0, 2)).step).toBe('placement')
    expect(run(...steps).step).toBe('identity')
    expect(run(...steps, next).step).toBe('identity')
  })

  test('goes back a step, keeping everything chosen', () => {
    const state = run(rolled, next, { type: 'placed', characteristic: 'STR', index: 0 }, next, {
      type: 'back',
    })

    expect(state.step).toBe('placement')
    expect(state.reached).toBe('profession')
    expect(state.placement).toEqual({ STR: 0 })
    expect(draftReducer(initialDraft(), { type: 'back' }).step).toBe('dice')
  })

  test('jumps back to any step reached, never beyond', () => {
    const state = run(rolled, next, next, next)

    expect(draftReducer(state, { type: 'went', step: 'placement' }).step).toBe('placement')
    expect(draftReducer(state, { type: 'went', step: 'identity' })).toBe(state)
  })

  test('follows the list it is given, whatever it holds', () => {
    const steps: StepDefinition[] = CREATION_STEPS.filter(({ id }) => id !== 'profession')
    const state = [rolled, next, next].reduce(draftReducer, initialDraft(steps))

    expect(state.step).toBe('skills')
  })
})

describe('creation draft — dice and placement', () => {
  test('places a result on a characteristic', () => {
    expect(run(rolled, { type: 'placed', characteristic: 'STR', index: 4 }).placement).toEqual({
      STR: 4,
    })
  })

  test('moves a result from one characteristic to another', () => {
    const state = run(
      rolled,
      { type: 'placed', characteristic: 'STR', index: 4 },
      { type: 'placed', characteristic: 'DEX', index: 4 }
    )

    expect(state.placement).toEqual({ DEX: 4 })
  })

  test('swaps two results when the one taken was already placed', () => {
    const state = run(
      rolled,
      { type: 'placed', characteristic: 'STR', index: 4 },
      { type: 'placed', characteristic: 'DEX', index: 1 },
      { type: 'placed', characteristic: 'DEX', index: 4 }
    )

    expect(state.placement).toEqual({ STR: 1, DEX: 4 })
  })

  test('takes a result back', () => {
    const state = run(
      rolled,
      { type: 'placed', characteristic: 'STR', index: 4 },
      { type: 'unplaced', characteristic: 'STR' }
    )

    expect(state.placement).toEqual({})
  })

  test('places nothing without a series, or outside it', () => {
    expect(run({ type: 'placed', characteristic: 'STR', index: 0 }).placement).toEqual({})
    expect(run(rolled, { type: 'placed', characteristic: 'STR', index: 7 }).placement).toEqual({})
  })

  test('a reroll replaces the series and undoes the placement', () => {
    const state = run(
      rolled,
      next,
      { type: 'placed', characteristic: 'STR', index: 4 },
      next,
      { type: 'went', step: 'dice' },
      { type: 'rolled', roll: REROLL }
    )

    expect(state.roll).toEqual(REROLL)
    expect(state.placement).toEqual({})
    // What came after rested on the old series: it is gone through again.
    expect(state.reached).toBe('dice')
  })
})

describe('creation draft — profession, skills and identity', () => {
  test('another profession drops the professional points, not the personal ones', () => {
    const state = run(
      { type: 'profession_chosen', profession: 'musketeer' },
      { type: 'points_set', pool: 'professional', skill: 'fencing', points: 40 },
      { type: 'points_set', pool: 'personal', skill: 'ride', points: 20 },
      { type: 'profession_chosen', profession: 'priest' }
    )

    expect(state.profession).toBe('priest')
    expect(state.professionalPoints).toEqual({})
    expect(state.personalPoints).toEqual({ ride: 20 })
  })

  test('sets points as whole numbers, none below zero, and drops a skill set back to 0', () => {
    expect(
      run({ type: 'points_set', pool: 'personal', skill: 'ride', points: 12.7 }).personalPoints
    ).toEqual({ ride: 12 })
    expect(
      run(
        { type: 'points_set', pool: 'personal', skill: 'ride', points: 12 },
        { type: 'points_set', pool: 'personal', skill: 'ride', points: 0 }
      ).personalPoints
    ).toEqual({})
    expect(
      run({ type: 'points_set', pool: 'personal', skill: 'ride', points: Number.NaN })
        .personalPoints
    ).toEqual({})
  })

  test('the body sent to the backend is the draft, the series aside', () => {
    const state = run(
      rolled,
      { type: 'placed', characteristic: 'INT', index: 2 },
      { type: 'named', name: 'Anne' },
      { type: 'gender_chosen', gender: 'female' }
    )

    expect(draftBody('world-1', state)).toEqual({
      worldId: 'world-1',
      placement: { INT: 2 },
      profession: null,
      professionalPoints: {},
      personalPoints: {},
      name: 'Anne',
      gender: 'female',
    })
  })
})

describe('creation draft — refusals', () => {
  const atIdentity = () => run(rolled, next, next, next, next)
  const refuse = (code: string, field?: string): DraftAction => ({
    type: 'refused',
    code,
    message: 'Refused.',
    field,
  })

  test.each([
    ['incomplete_placement', 'placement', 'placement'],
    ['invalid_placement', 'placement.STR', 'placement'],
    ['missing_profession', 'profession', 'profession'],
    ['pool_exceeded', 'professionalPoints', 'skills'],
    ['profession_skill_only', 'professionalPoints.fencing', 'skills'],
    ['pool_exceeded', 'personalPoints', 'skills'],
    ['skill_cap_exceeded', 'skills.fencing', 'skills'],
    ['invalid_character_name', 'name', 'identity'],
    ['missing_gender', 'gender', 'identity'],
    ['no_characteristic_roll', undefined, 'dice'],
  ])('%s on %s sends back to the %s step', (code, field, step) => {
    const state = draftReducer(atIdentity(), refuse(code, field))

    expect(state.step).toBe(step)
    expect(state.reached).toBe('identity')
    expect(state.refusal).toEqual({ code, message: 'Refused.' })
  })

  test('a series replaced since is dropped: the dice have to be rolled again', () => {
    const state = draftReducer(
      run(rolled, next, { type: 'placed', characteristic: 'STR', index: 0 }, next, next, next),
      refuse('stale_characteristic_roll', 'placement')
    )

    expect(state).toMatchObject({ step: 'dice', reached: 'dice', roll: null, placement: {} })
  })

  test('a refusal without a field stays where the player is', () => {
    expect(draftReducer(atIdentity(), refuse('network_error')).step).toBe('identity')
  })

  test('the refusal goes as soon as the player changes something or moves on', () => {
    const refused = draftReducer(atIdentity(), refuse('missing_gender', 'gender'))

    expect(draftReducer(refused, { type: 'gender_chosen', gender: 'male' }).refusal).toBeNull()
    expect(draftReducer(refused, { type: 'back' }).refusal).toBeNull()
  })
})

describe('creation issues', () => {
  const issues = [
    { code: 'incomplete_placement', field: 'placement', reference: 'CON' },
    { code: 'skill_cap_exceeded', field: 'skills.fencing', reference: 'fencing' },
    { code: 'pool_exceeded', field: 'personalPoints' },
    { code: 'missing_gender', field: 'gender' },
  ]

  test('each step gets its own', () => {
    expect(issuesOf(CREATION_STEPS, 'skills', issues).map(({ code }) => code)).toEqual([
      'skill_cap_exceeded',
      'pool_exceeded',
    ])
    expect(issuesOf(CREATION_STEPS, 'profession', issues)).toEqual([])
    expect(stepOf(CREATION_STEPS, { code: 'unknown', field: 'elsewhere' })).toBeNull()
  })

  test('what is only not done yet is not shown as an error', () => {
    expect(shownIssues(issues).map(({ code }) => code)).toEqual([
      'skill_cap_exceeded',
      'pool_exceeded',
    ])
  })
})
