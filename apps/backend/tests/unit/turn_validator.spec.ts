import { test } from '@japa/runner'

import { extracted } from '#tests/helpers/turns'
import {
  TurnValidationError,
  type ValidationMeta,
  validateArbitration,
  validateExtraction,
} from '#services/game/turn_validator'

const META: ValidationMeta = {
  actionTypes: ['melee_combat', 'social_persuasion'],
  npcHandles: ['royal_guard_1', 'treville'],
  locations: ['paris', 'louvre', 'france'],
  locationArchetypes: ['tavern', 'town'],
  npcDefinitions: ['treville', 'royal_guard', 'commoner'],
  hitPointsMax: 10,
}

function arbitration(overrides: Record<string, unknown> = {}) {
  return {
    intent: {
      type: 'social_dialogue',
      target: 'royal_guard_1',
      summary: 'Talking past the guard',
    },
    validity: { factual: true, plausibility: 'plausible', justification: 'The letter is real.' },
    resolution: { mode: 'roll_required', action_type: 'social_persuasion', difficulty: 'medium' },
    alert: { prompt_injection_suspected: false, out_of_scope: false },
    ...overrides,
  }
}

function settled(overrides: Record<string, unknown> = {}) {
  return arbitration({
    resolution: { mode: 'automatic_success', action_type: null, difficulty: null },
    ...overrides,
  })
}

function extraction(overrides: Parameters<typeof extracted>[0] = {}) {
  return extracted({ scenario_flags: ['duel_survived'], hit_points_delta: -2, ...overrides })
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
  test('accepts a roll on an action type of the world', async ({ assert }) => {
    const output = await validateArbitration(arbitration(), META)

    assert.equal(output.resolution.action_type, 'social_persuasion')
    assert.equal(output.intent.target, 'royal_guard_1')
  })

  test('accepts a settled outcome, which carries neither category nor difficulty', async ({
    assert,
  }) => {
    const output = await validateArbitration(settled(), META)

    assert.equal(output.resolution.mode, 'automatic_success')
  })

  test('accepts an action aimed at no one', async ({ assert }) => {
    const output = await validateArbitration(
      arbitration({ intent: { type: 'observation', target: null, summary: 'Looking around' } }),
      META
    )

    assert.isNull(output.intent.target)
  })

  test('accepts an extraction payload', async ({ assert }) => {
    const output = await validateExtraction(extraction(), META)

    assert.deepEqual(output.scenario_flags, ['duel_survived'])
  })
})

test.group('Turn validator | closed lists', () => {
  test('rejects an action type the world does not have', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        arbitration({
          resolution: { mode: 'roll_required', action_type: 'alchemy', difficulty: 'medium' },
        }),
        META
      )
    )

    /**
     * The invariant the rules document insists on: the model picks from the
     * list it was handed, and the list travels with the rejection so a second
     * attempt can pick from it.
     */
    const rejected = error.reasons.find(({ field }) => field === 'resolution.action_type')
    assert.deepEqual(rejected?.allowed, META.actionTypes)
  })

  test('rejects a skill named in place of an action type', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        arbitration({
          resolution: { mode: 'roll_required', action_type: 'persuasion', difficulty: 'medium' },
        }),
        META
      )
    )

    assert.include(fields(error), 'resolution.action_type')
  })

  test('rejects a target that is not someone present', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        arbitration({
          intent: { type: 'social_dialogue', target: 'the bored guard', summary: 'Talking' },
        }),
        META
      )
    )

    /** A description or a name could not be resolved to anyone: handles only. */
    assert.include(fields(error), 'intent.target')
  })

  test('rejects a difficulty outside the standard scale', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        arbitration({
          resolution: {
            mode: 'roll_required',
            action_type: 'social_persuasion',
            difficulty: 'trivial',
          },
        }),
        META
      )
    )

    assert.include(fields(error), 'resolution.difficulty')
  })

  test('rejects a movement to a place the world does not define', async ({ assert }) => {
    const error = await reject(() =>
      validateExtraction(
        extraction({ movement: 'noble_quarter', scenario_flags: [], hit_points_delta: 0 }),
        META
      )
    )

    /**
     * A well-formed reference is not enough: a place outside the list has no
     * label, so it would reach the player as a raw identifier.
     */
    assert.include(fields(error), 'movement.location')
  })

  test('rejects a flag written as a display name', async ({ assert }) => {
    const error = await reject(() =>
      validateExtraction(
        extraction({ movement: null, scenario_flags: ["Queen's favour"], hit_points_delta: 0 }),
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
  test('rejects a roll with no action type and no difficulty', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        arbitration({
          resolution: { mode: 'roll_required', action_type: null, difficulty: null },
        }),
        META
      )
    )

    assert.includeMembers(fields(error), ['resolution.action_type', 'resolution.difficulty'])
  })

  test('rejects a settled outcome that names a category anyway', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        settled({
          resolution: {
            mode: 'automatic_success',
            action_type: 'social_persuasion',
            difficulty: 'easy',
          },
        }),
        META
      )
    )

    assert.includeMembers(fields(error), ['resolution.action_type', 'resolution.difficulty'])
  })

  test('drops any narration arbitration slips in', async ({ assert }) => {
    const output = await validateArbitration(
      arbitration({ narration: 'You slip past easily.' }),
      META
    )

    /** Arbitration rules and nothing else: a stray narration never reaches the log. */
    assert.notProperty(output, 'narration')
  })
})

test.group('Turn validator | bounds', () => {
  test('rejects a hit point swing larger than the character', async ({ assert }) => {
    const error = await reject(() =>
      validateExtraction(
        extraction({ movement: null, scenario_flags: [], hit_points_delta: -11 }),
        META
      )
    )

    assert.include(fields(error), 'hit_points_delta')
  })

  test('accepts a swing at exactly the maximum', async ({ assert }) => {
    const output = await validateExtraction(
      extraction({ movement: null, scenario_flags: [], hit_points_delta: -10 }),
      META
    )

    assert.equal(output.hit_points_delta, -10)
  })

  test('rejects a fractional hit point delta', async ({ assert }) => {
    const error = await reject(() =>
      validateExtraction(
        extraction({ movement: null, scenario_flags: [], hit_points_delta: -1.5 }),
        META
      )
    )

    assert.isNotEmpty(error.reasons)
  })

  test('rejects more flags than a single turn may raise', async ({ assert }) => {
    const error = await reject(() =>
      validateExtraction(
        extraction({
          movement: null,
          scenario_flags: ['a_one', 'b_two', 'c_three', 'd_four', 'e_five', 'f_six'],
          hit_points_delta: 0,
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
    const error = await reject(() => validateExtraction({}, META))

    /**
     * Carried so the turn log and the player message can tell an arbitration
     * rejection from an extraction one.
     */
    assert.equal(error.step, 'extraction')
  })
})

test.group('Turn validator | extraction', () => {
  test('normalises a move to a named place', async ({ assert }) => {
    const output = await validateExtraction(extraction({ movement: 'louvre' }), META)

    assert.deepEqual(output.movement, { location: 'louvre' })
  })

  test('accepts a new place of an archetype, within a named one', async ({ assert }) => {
    const output = await validateExtraction(
      extraction({
        movement: {
          definition: 'town',
          parent: 'france',
          descriptor: 'a river town',
          name: 'Orléans',
        },
      }),
      META
    )

    assert.deepEqual(output.movement, {
      definition: 'town',
      parent: 'france',
      descriptor: 'a river town',
      name: 'Orléans',
    })
  })

  test('accepts people entering, leaving, naming themselves and changing attitude', async ({
    assert,
  }) => {
    const answer = extraction({
      npcs_entered: [{ definition: 'commoner', descriptor: 'a washerwoman' }],
      npcs_left: ['treville'],
      npc_names: [{ handle: 'royal_guard_1', name: 'Jacques' }],
      npc_relations: [{ handle: 'royal_guard_1', disposition: 'friendly' }],
    })

    const output = await validateExtraction(answer, META)

    assert.deepEqual(output.npcs_entered, answer.npcs_entered)
    assert.deepEqual(output.npc_relations, answer.npc_relations)
  })

  test('rejects someone entering under a definition the world does not have', async ({
    assert,
  }) => {
    const error = await reject(() =>
      validateExtraction(
        extraction({ npcs_entered: [{ definition: 'dragon', descriptor: null }] }),
        META
      )
    )

    assert.include(fields(error), 'npcs_entered.0.definition')
  })

  test('only designates people present, by handle', async ({ assert }) => {
    for (const answer of [
      extraction({ npcs_left: ['royal_guard_2'] }),
      extraction({ npcs_following: ['the guard'] }),
      extraction({ npc_names: [{ handle: 'jussac', name: 'Jussac' }] }),
      extraction({ npc_relations: [{ handle: 'milady', disposition: 'hostile' }] }),
    ]) {
      const error = await reject(() => validateExtraction(answer, META))

      assert.isNotEmpty(error.reasons)
    }
  })

  test('rejects a new place set in something other than a named location', async ({ assert }) => {
    const error = await reject(() =>
      validateExtraction(
        extraction({ movement: { definition: 'tavern', parent: 'town', descriptor: null } }),
        META
      )
    )

    assert.include(fields(error), 'movement.parent')
  })

  test('rejects a new place with no parent at all', async ({ assert }) => {
    const error = await reject(() =>
      validateExtraction(extraction({ movement: { definition: 'tavern' } }), META)
    )

    assert.include(fields(error), 'movement.parent')
  })

  test('rejects a movement that is both forms at once', async ({ assert }) => {
    const error = await reject(() =>
      validateExtraction(
        extraction({ movement: { location: 'paris', definition: 'tavern', parent: 'paris' } }),
        META
      )
    )

    assert.include(fields(error), 'movement')
  })

  test('rejects a disposition outside the scale, or given as a step', async ({ assert }) => {
    for (const disposition of ['furious', '+1']) {
      const error = await reject(() =>
        validateExtraction(
          extraction({ npc_relations: [{ handle: 'treville', disposition }] }),
          META
        )
      )

      assert.include(fields(error), 'npc_relations.0.disposition')
    }
  })

  test('rejects someone who both leaves and follows', async ({ assert }) => {
    const error = await reject(() =>
      validateExtraction(
        extraction({ movement: 'louvre', npcs_left: ['treville'], npcs_following: ['treville'] }),
        META
      )
    )

    assert.include(fields(error), 'npcs_following')
  })
})
