import { test } from '@japa/runner'

import {
  TurnValidationError,
  type ValidationMeta,
  validateArbitration,
  validateNarration,
} from '#services/game/turn_validator'

const META: ValidationMeta = {
  skills: ['swordsmanship', 'persuasion'],
  locations: ['paris', 'louvre'],
  hitPointsMax: 10,
}

function arbitration(overrides: Record<string, unknown> = {}) {
  return {
    intent: { type: 'social_dialogue', target: 'guard_02', summary: 'Talking past the guard' },
    validity: { factual: true, plausibility: 'plausible', justification: 'The letter is real.' },
    resolution: { mode: 'roll_required', skill_used: 'persuasion', difficulty: 'medium' },
    narration: null,
    effects: null,
    alert: { prompt_injection_suspected: false, out_of_scope: false },
    ...overrides,
  }
}

function settled(overrides: Record<string, unknown> = {}) {
  return arbitration({
    resolution: { mode: 'automatic_success', skill_used: null, difficulty: null },
    narration: 'The guard waves you through without a word.',
    effects: { movement: 'louvre', scenario_flags: [], hit_points_delta: 0 },
    ...overrides,
  })
}

function narration(overrides: Record<string, unknown> = {}) {
  return {
    narration: 'The blade turns aside at the last moment.',
    effects: { movement: null, scenario_flags: ['duel_survived'], hit_points_delta: -2 },
    ...overrides,
  }
}

/**
 * Collects the rejection rather than letting it escape, so a spec can assert on
 * which rule fired instead of merely that something failed.
 */
async function reject(run: () => Promise<unknown>): Promise<TurnValidationError> {
  const error = await run()
    .then(() => null)
    .catch((caught) => caught)

  if (!(error instanceof TurnValidationError)) {
    throw new Error(`Expected a TurnValidationError, got ${error}`)
  }

  return error
}

function fields(error: TurnValidationError): string[] {
  return error.reasons.map((item) => item.field)
}

test.group('Turn validator | accepted payloads', () => {
  test('accepts a roll that names a skill the character has', async ({ assert }) => {
    const output = await validateArbitration(arbitration(), META)

    assert.equal(output.resolution.skill_used, 'persuasion')
  })

  test('accepts a settled turn that narrates and states its effects', async ({ assert }) => {
    const output = await validateArbitration(settled(), META)

    assert.equal(output.effects?.movement, 'louvre')
  })

  test('accepts a narration payload', async ({ assert }) => {
    const output = await validateNarration(narration(), META)

    assert.deepEqual(output.effects.scenario_flags, ['duel_survived'])
  })
})

test.group('Turn validator | closed lists', () => {
  test('rejects a skill the character does not have', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        arbitration({
          resolution: { mode: 'roll_required', skill_used: 'alchemy', difficulty: 'medium' },
        }),
        META
      )
    )

    /**
     * The invariant the rules document insists on: the model picks from the
     * list it was handed, it does not invent an entity with mechanical
     * consequences.
     */
    assert.include(fields(error), 'resolution.skill_used')
  })

  test('rejects a difficulty outside the standard scale', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        arbitration({
          resolution: { mode: 'roll_required', skill_used: 'persuasion', difficulty: 'trivial' },
        }),
        META
      )
    )

    assert.include(fields(error), 'resolution.difficulty')
  })

  test('rejects a movement to a place the world does not define', async ({ assert }) => {
    const error = await reject(() =>
      validateNarration(
        narration({
          effects: { movement: 'noble_quarter', scenario_flags: [], hit_points_delta: 0 },
        }),
        META
      )
    )

    /**
     * A well-formed reference is not enough: a place outside the list has no
     * label, so it would reach the player as a raw identifier.
     */
    assert.include(fields(error), 'effects.movement')
  })

  test('rejects a flag written as a display name', async ({ assert }) => {
    const error = await reject(() =>
      validateNarration(
        narration({
          effects: { movement: null, scenario_flags: ["Queen's favour"], hit_points_delta: 0 },
        }),
        META
      )
    )

    /**
     * A display name would never match the reference written last turn, and
     * the state would quietly grow duplicates of the same flag.
     */
    assert.isNotEmpty(error.reasons)
  })
})

test.group('Turn validator | roll coherence', () => {
  test('rejects a narration written before the roll is resolved', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(arbitration({ narration: 'You slip past easily.' }), META)
    )

    /**
     * The whole reason the call splits in two: a model that narrates the
     * outcome of a roll it does not know has decided it, which is the
     * backend's job.
     */
    assert.include(fields(error), 'narration')
  })

  test('rejects effects settled before the roll is resolved', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        arbitration({
          effects: { movement: 'louvre', scenario_flags: [], hit_points_delta: 0 },
        }),
        META
      )
    )

    assert.include(fields(error), 'effects')
  })

  test('rejects a roll with no skill and no difficulty', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        arbitration({
          resolution: { mode: 'roll_required', skill_used: null, difficulty: null },
        }),
        META
      )
    )

    assert.includeMembers(fields(error), ['resolution.skill_used', 'resolution.difficulty'])
  })

  test('rejects a settled turn that names a skill anyway', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        settled({
          resolution: { mode: 'automatic_success', skill_used: 'persuasion', difficulty: null },
        }),
        META
      )
    )

    assert.include(fields(error), 'resolution.skill_used')
  })

  test('rejects a settled turn that narrates nothing', async ({ assert }) => {
    const error = await reject(() => validateArbitration(settled({ narration: '   ' }), META))

    assert.include(fields(error), 'narration')
  })
})

test.group('Turn validator | bounds', () => {
  test('rejects a hit point swing larger than the character', async ({ assert }) => {
    const error = await reject(() =>
      validateNarration(
        narration({
          effects: { movement: null, scenario_flags: [], hit_points_delta: -11 },
        }),
        META
      )
    )

    assert.include(fields(error), 'effects.hit_points_delta')
  })

  test('accepts a swing at exactly the maximum', async ({ assert }) => {
    const output = await validateNarration(
      narration({ effects: { movement: null, scenario_flags: [], hit_points_delta: -10 } }),
      META
    )

    assert.equal(output.effects.hit_points_delta, -10)
  })

  test('rejects a fractional hit point delta', async ({ assert }) => {
    const error = await reject(() =>
      validateNarration(
        narration({ effects: { movement: null, scenario_flags: [], hit_points_delta: -1.5 } }),
        META
      )
    )

    assert.isNotEmpty(error.reasons)
  })

  test('rejects more flags than a single turn may raise', async ({ assert }) => {
    const error = await reject(() =>
      validateNarration(
        narration({
          effects: {
            movement: null,
            scenario_flags: ['a_one', 'b_two', 'c_three', 'd_four', 'e_five', 'f_six'],
            hit_points_delta: 0,
          },
        }),
        META
      )
    )

    assert.isNotEmpty(error.reasons)
  })
})

test.group('Turn validator | malformed payloads', () => {
  test('rejects a missing field', async ({ assert }) => {
    const { alert, ...withoutAlert } = arbitration()

    const error = await reject(() => validateArbitration(withoutAlert, META))

    assert.isNotEmpty(error.reasons)
  })

  test('rejects something that is not an object at all', async ({ assert }) => {
    const error = await reject(() => validateArbitration('not a payload', META))

    assert.instanceOf(error, TurnValidationError)
  })

  test('names the step it rejected', async ({ assert }) => {
    const error = await reject(() => validateNarration({}, META))

    /**
     * Carried so the turn log and the player message can tell an arbitration
     * rejection from a narration one.
     */
    assert.equal(error.step, 'narration')
  })
})
