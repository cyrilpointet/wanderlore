import { test } from '@japa/runner'

import { CHARACTER, LOCATION, extracted, npc } from '#tests/helpers/turns'
import {
  TurnValidationError,
  type ValidationMeta,
  validateArbitration,
  validateExtraction,
} from '#services/game/turn_validator'

const META: ValidationMeta = {
  actionTypes: ['melee_combat', 'social_persuasion'],
  npcHandles: ['royal_guard_1', 'treville'],
  reachableLocations: [],
  locations: ['paris', 'louvre', 'france'],
  locationArchetypes: ['tavern', 'town'],
  npcDefinitions: ['treville', 'royal_guard', 'commoner'],
  itemsInScene: ['letter_to_treville', 'rapier', 'rapier_1'],
  /** The character's letter, sword and shot, the guard's dagger, a rope in the room. */
  sceneItems: [
    {
      item: 'letter_to_treville',
      definition: 'letter_to_treville',
      holder: { holder: 'character' },
      quantity: 1,
    },
    { item: 'rapier_1', definition: 'rapier', holder: { holder: 'character' }, quantity: 1 },
    { item: 'lead_shot', definition: 'lead_shot', holder: { holder: 'character' }, quantity: 6 },
    {
      item: 'dagger_1',
      definition: 'dagger',
      holder: { holder: 'npc', handle: 'royal_guard_1' },
      quantity: 1,
    },
    { item: 'rope_1', definition: 'rope', holder: { holder: 'location' }, quantity: 1 },
  ],
  creatableItems: [
    'improvised_weapon',
    'common_sword',
    'food',
    'lead_shot',
    'queens_diamond_studs',
  ],
  itemKinds: [
    { reference: 'letter_to_treville', unique: true, stackable: false, equippable: false },
    { reference: 'queens_diamond_studs', unique: true, stackable: false, equippable: false },
    { reference: 'rapier', unique: false, stackable: false, equippable: true },
    { reference: 'dagger', unique: false, stackable: false, equippable: true },
    { reference: 'rope', unique: false, stackable: false, equippable: false },
    { reference: 'improvised_weapon', unique: false, stackable: false, equippable: true },
    { reference: 'common_sword', unique: false, stackable: false, equippable: true },
    { reference: 'food', unique: false, stackable: true, equippable: false },
    { reference: 'lead_shot', unique: false, stackable: true, equippable: false },
  ],
  hasLocation: true,
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
    resolution: { mode: 'roll_required', action_type: 'social_persuasion', difficulty: 'average' },
    duration: { label: 'moment', count: null, period: null },
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
          resolution: { mode: 'roll_required', action_type: 'alchemy', difficulty: 'average' },
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
          resolution: { mode: 'roll_required', action_type: 'persuasion', difficulty: 'average' },
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

    assert.deepEqual(output.npcs_entered, [
      { definition: 'commoner', descriptor: 'a washerwoman', name: null },
    ])
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

test.group('Turn validator | manual testing fixes', () => {
  test('a movement with every field null is no movement, not a refusal', async ({ assert }) => {
    const output = await validateExtraction(
      extraction({ movement: { location: null, definition: null, parent: null } }),
      META
    )

    assert.isNull(output.movement)
  })

  test('someone entering may carry a name, kept apart from the descriptor', async ({ assert }) => {
    const output = await validateExtraction(
      extraction({
        npcs_entered: [{ definition: 'commoner', descriptor: 'a stout innkeeper', name: 'Jean' }],
      }),
      META
    )

    assert.deepEqual(output.npcs_entered, [
      { definition: 'commoner', descriptor: 'a stout innkeeper', name: 'Jean' },
    ])
  })

  test('an entry sent without a name is a nameless one', async ({ assert }) => {
    const output = await validateExtraction(
      extraction({ npcs_entered: [{ definition: 'commoner', descriptor: 'a porter' }] }),
      META
    )

    assert.isNull(output.npcs_entered[0].name)
  })

  test('an aside to the game master is never a roll', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        arbitration({
          intent: { type: 'out_of_character', target: null, summary: 'Asks where Meung lies' },
        }),
        META
      )
    )

    assert.include(fields(error), 'resolution.mode')
  })
})

test.group('Turn validator | contextual modifiers', () => {
  function withModifiers(modifiers: unknown) {
    return arbitration({
      resolution: {
        mode: 'roll_required',
        action_type: 'social_persuasion',
        difficulty: 'average',
        contextual_modifiers: modifiers,
      },
    })
  }

  test('accepts up to three labelled circumstances', async ({ assert }) => {
    const modifiers = [
      { source: 'favorable_reputation', effect: 'major_bonus' },
      { source: 'late_hour', effect: 'minor_penalty' },
      { source: 'pouring_rain', effect: 'minor_penalty' },
    ]

    const output = await validateArbitration(withModifiers(modifiers), META)

    assert.deepEqual(output.resolution.contextual_modifiers, modifiers)
  })

  test('reads a missing list as no circumstance', async ({ assert }) => {
    const output = await validateArbitration(arbitration(), META)

    assert.deepEqual(output.resolution.contextual_modifiers, [])
  })

  test('refuses a fourth circumstance', async ({ assert }) => {
    const four = ['a', 'b', 'c', 'd'].map((letter) => ({
      source: `circumstance_${letter}`,
      effect: 'minor_bonus',
    }))

    const error = await reject(() => validateArbitration(withModifiers(four), META))

    assert.include(fields(error), 'resolution.contextual_modifiers')
  })

  test('refuses a value where a label belongs', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(withModifiers([{ source: 'favorable_reputation', effect: 3 }]), META)
    )

    assert.include(fields(error), 'resolution.contextual_modifiers.0.effect')
  })

  test('refuses a source that is not a stable reference', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        withModifiers([{ source: 'The guard likes him', effect: 'minor_bonus' }]),
        META
      )
    )

    assert.include(fields(error), 'resolution.contextual_modifiers.0.source')
  })

  test('refuses an item passed off as a circumstance', async ({ assert }) => {
    /** The backend counts the letter from the inventory; priced here too, it would count twice. */
    const byDefinition = await reject(() =>
      validateArbitration(
        withModifiers([{ source: 'letter_to_treville', effect: 'major_bonus' }]),
        META
      )
    )
    const byHandle = await reject(() =>
      validateArbitration(withModifiers([{ source: 'rapier_1', effect: 'minor_bonus' }]), META)
    )

    assert.deepEqual([byDefinition.reasons[0].rule, byHandle.reasons[0].rule], ['item', 'item'])
  })

  test('drops the circumstances of an outcome settled without a roll', async ({ assert }) => {
    const output = await validateArbitration(
      settled({
        resolution: {
          mode: 'automatic_success',
          action_type: null,
          difficulty: null,
          contextual_modifiers: [{ source: 'favorable_reputation', effect: 'minor_bonus' }],
        },
      }),
      META
    )

    assert.deepEqual(output.resolution.contextual_modifiers, [])
  })
})

test.group('Turn validator | items', () => {
  const stool = {
    definition: 'improvised_weapon',
    descriptor: 'a three-legged stool',
    quantity: 1,
    holder: CHARACTER,
    equipped: true,
  }

  test('reads items changing hands, coming into being and going, by holder', async ({ assert }) => {
    const effects = await validateExtraction(
      extracted({
        items_created: [stool],
        items_transferred: [
          { item: 'letter_to_treville', from: CHARACTER, to: npc('royal_guard_1'), quantity: 1 },
          { item: 'rope_1', from: LOCATION, to: CHARACTER, quantity: 1 },
          { item: 'lead_shot', from: CHARACTER, to: LOCATION, quantity: 2 },
        ],
        items_destroyed: [{ item: 'lead_shot', holder: CHARACTER, quantity: 1 }],
        items_unequipped: ['rapier_1'],
      }),
      META
    )

    assert.deepEqual(effects.items_created, [{ ...stool, holder: { holder: 'character' } }])
    assert.deepEqual(effects.items_transferred[0], {
      item: 'letter_to_treville',
      from: { holder: 'character' },
      to: { holder: 'npc', handle: 'royal_guard_1' },
      quantity: 1,
    })
    assert.deepEqual(effects.items_destroyed, [
      { item: 'lead_shot', holder: { holder: 'character' }, quantity: 1 },
    ])
    assert.deepEqual(effects.items_unequipped, ['rapier_1'])
  })

  test('refuses an item outside the list it may come from', async ({ assert }) => {
    /** The exit criterion: nothing appears that the list does not hold. */
    const invented = await reject(() =>
      validateExtraction(
        extracted({ items_created: [{ ...stool, definition: 'magic_ring', equipped: false }] }),
        META
      )
    )
    const alreadyHeld = await reject(() =>
      validateExtraction(
        extracted({
          items_created: [{ ...stool, definition: 'letter_to_treville', equipped: false }],
        }),
        META
      )
    )

    assert.include(fields(invented), 'items_created.0.definition')
    assert.include(fields(alreadyHeld), 'items_created.0.definition')
  })

  test('refuses an item its holder does not hold, or a holder out of the scene', async ({
    assert,
  }) => {
    const notHeld = await reject(() =>
      validateExtraction(
        extracted({
          items_transferred: [
            { item: 'dagger_1', from: CHARACTER, to: npc('royal_guard_1'), quantity: 1 },
          ],
        }),
        META
      )
    )
    const absent = await reject(() =>
      validateExtraction(
        extracted({
          items_transferred: [
            { item: 'letter_to_treville', from: CHARACTER, to: npc('rochefort'), quantity: 1 },
          ],
        }),
        META
      )
    )

    assert.include(fields(notHeld), 'items_transferred.0.item')
    assert.deepEqual(notHeld.reasons[0].allowed, ['letter_to_treville', 'rapier_1', 'lead_shot'])
    assert.include(fields(absent), 'items_transferred.0.to')
  })

  test('never moves or uses up more than is held', async ({ assert }) => {
    const error = await reject(() =>
      validateExtraction(
        extracted({
          items_transferred: [{ item: 'lead_shot', from: CHARACTER, to: LOCATION, quantity: 4 }],
          items_destroyed: [{ item: 'lead_shot', holder: CHARACTER, quantity: 3 }],
        }),
        META
      )
    )

    assert.include(fields(error), 'items')
  })

  test('counts a copy one at a time, and changes it once', async ({ assert }) => {
    const many = await reject(() =>
      validateExtraction(extracted({ items_created: [{ ...stool, quantity: 2 }] }), META)
    )
    const twice = await reject(() =>
      validateExtraction(
        extracted({
          items_transferred: [{ item: 'rapier_1', from: CHARACTER, to: LOCATION, quantity: 1 }],
          items_destroyed: [{ item: 'rapier_1', holder: CHARACTER, quantity: 1 }],
        }),
        META
      )
    )

    assert.include(fields(many), 'items_created.0.quantity')
    assert.include(fields(twice), 'items_destroyed.0')
  })

  test('a unique item comes into being once', async ({ assert }) => {
    const studs = { ...stool, definition: 'queens_diamond_studs', equipped: false }

    const error = await reject(() =>
      validateExtraction(extracted({ items_created: [studs, studs] }), META)
    )

    assert.include(fields(error), 'items_created.1')
  })

  test('only the character equips, and only what can be equipped', async ({ assert }) => {
    const givenAway = await reject(() =>
      validateExtraction(
        extracted({
          items_transferred: [{ item: 'rapier_1', from: CHARACTER, to: LOCATION, quantity: 1 }],
          items_equipped: ['rapier_1'],
        }),
        META
      )
    )
    const letter = await reject(() =>
      validateExtraction(extracted({ items_equipped: ['letter_to_treville'] }), META)
    )
    const forSomeoneElse = await reject(() =>
      validateExtraction(
        extracted({ items_created: [{ ...stool, holder: npc('royal_guard_1') }] }),
        META
      )
    )

    assert.include(fields(givenAway), 'items_equipped.0')
    assert.include(fields(letter), 'items_equipped.0')
    assert.include(fields(forSomeoneElse), 'items_created.0.equipped')
  })

  test('an item picked up this turn can be drawn at once', async ({ assert }) => {
    const effects = await validateExtraction(
      extracted({
        items_transferred: [
          { item: 'dagger_1', from: npc('royal_guard_1'), to: CHARACTER, quantity: 1 },
        ],
        items_equipped: ['dagger_1'],
      }),
      META
    )

    assert.deepEqual(effects.items_equipped, ['dagger_1'])
  })

  test('a scene that began nowhere has no place to hold anything', async ({ assert }) => {
    const error = await reject(() =>
      validateExtraction(
        extracted({
          items_transferred: [{ item: 'lead_shot', from: CHARACTER, to: LOCATION, quantity: 1 }],
        }),
        { ...META, hasLocation: false }
      )
    )

    assert.include(fields(error), 'items_transferred.0.to')
  })
})

test.group('Turn validator | duration', () => {
  test('a label of the scale, as the backend reads it', async ({ assert }) => {
    const output = await validateArbitration(
      arbitration({ duration: { label: 'minutes', count: null, period: null } }),
      META
    )

    assert.deepEqual(output.duration, { label: 'minutes' })
  })

  test('days with their count, a wait with its period', async ({ assert }) => {
    const days = await validateArbitration(
      arbitration({ duration: { label: 'days', count: 3, period: null } }),
      META
    )
    const wait = await validateArbitration(
      arbitration({ duration: { label: 'until', count: null, period: 'night' } }),
      META
    )

    assert.deepEqual(days.duration, { label: 'days', count: 3 })
    assert.deepEqual(wait.duration, { label: 'until', period: 'night' })
  })

  test('a count or a period sent with a label that has none is dropped', async ({ assert }) => {
    const output = await validateArbitration(
      arbitration({ duration: { label: 'hour', count: 2, period: 'dusk' } }),
      META
    )

    assert.deepEqual(output.duration, { label: 'hour' })
  })

  test('rejects a label off the scale', async ({ assert }) => {
    const error = await reject(() =>
      validateArbitration(
        arbitration({ duration: { label: 'fortnight', count: null, period: null } }),
        META
      )
    )

    assert.deepEqual(fields(error), ['duration.label'])
  })

  test('rejects more than a week in a turn, or no day at all', async ({ assert }) => {
    for (const count of [8, 0]) {
      const error = await reject(() =>
        validateArbitration(arbitration({ duration: { label: 'days', count, period: null } }), META)
      )

      assert.deepEqual(fields(error), ['duration.count'])
    }
  })

  test('rejects days without a count and a wait without a period', async ({ assert }) => {
    const days = await reject(() =>
      validateArbitration(
        arbitration({ duration: { label: 'days', count: null, period: null } }),
        META
      )
    )
    const wait = await reject(() =>
      validateArbitration(
        arbitration({ duration: { label: 'until', count: null, period: 'teatime' } }),
        META
      )
    )

    assert.deepEqual(fields(days), ['duration.count'])
    assert.deepEqual(fields(wait), ['duration.period'])
  })

  test('rejects a ruling with no duration', async ({ assert }) => {
    const { duration, ...ruling } = arbitration()

    const error = await reject(() => validateArbitration(ruling, META))

    assert.isDefined(duration)
    assert.deepEqual(fields(error), ['duration'])
  })
})

test.group('Turn validator | destination', () => {
  const IN_A_NETWORK: ValidationMeta = {
    ...META,
    reachableLocations: ['house_yard', 'house_kitchen'],
  }

  const going = (destination: string | null, type = 'movement') =>
    settled({ intent: { type, target: null, summary: 'Going', destination } })

  test('a place the exits reach', async ({ assert }) => {
    const output = await validateArbitration(going('house_kitchen'), IN_A_NETWORK)

    assert.equal(output.intent.destination, 'house_kitchen')
  })

  test('rejects a place the exits do not reach, naming those they do', async ({ assert }) => {
    const error = await reject(() => validateArbitration(going('house_attic'), IN_A_NETWORK))

    assert.deepEqual(fields(error), ['intent.destination'])
    assert.deepEqual(error.reasons[0].allowed, ['house_yard', 'house_kitchen'])
  })

  test('outside a network, a destination times nothing and is dropped', async ({ assert }) => {
    const output = await validateArbitration(going('paris'), META)

    assert.isNull(output.intent.destination)
  })

  test('an aside goes nowhere', async ({ assert }) => {
    const output = await validateArbitration(
      going('house_kitchen', 'out_of_character'),
      IN_A_NETWORK
    )

    assert.isNull(output.intent.destination)
  })

  test('none sent is none', async ({ assert }) => {
    const output = await validateArbitration(settled(), IN_A_NETWORK)

    assert.isNull(output.intent.destination)
  })
})
