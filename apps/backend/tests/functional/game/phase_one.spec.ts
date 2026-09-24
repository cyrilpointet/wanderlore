import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import User from '#models/user'
import TurnLog from '#models/turn_log'
import Session from '#models/session'
import WorldState from '#models/world_state'
import { DiceService } from '#services/dice'
import { LlmError, type LlmErrorCategory } from '#services/llm/errors'
import { LlmGateway } from '#services/llm/gateway'
import { RulesEngine } from '#services/rules/engine'
import { TurnService } from '#services/game/turn_service'
import { THREE_MUSKETEERS } from '#services/game/world'
import { ContentLabels, type ContentKind } from '#services/game/content_labels'
import { FakeLlmProvider, type FakeLlmProviderOptions } from '#tests/helpers/fake_llm_provider'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'
import { useTransaction } from '#tests/helpers/database'
import { playerOf } from '#tests/helpers/turns'
import TestUserSeeder from '#database/seeders/test_user_seeder'
import DemoSessionSeeder from '#database/seeders/demo_session_seeder'

/**
 * The exit criterion of Phase 1, exercised on the seeded game rather than on a
 * fixture built for the occasion: what a developer reaches with curl is what
 * this proves.
 *
 * The model is faked throughout. Checking the real provider is a manual step,
 * deliberately outside the suite.
 */
const ARBITRATION_WITH_ROLL = {
  intent: { type: 'social_dialogue', target: 'treville', summary: 'Presenting the letter' },
  validity: { factual: true, plausibility: 'plausible', justification: 'The letter is carried.' },
  resolution: { mode: 'roll_required', skill_used: 'etiquette', difficulty: 'medium' },
  narration: null,
  effects: null,
  alert: { prompt_injection_suspected: false, out_of_scope: false },
}

const NARRATION = {
  narration: 'Tréville breaks the seal, reads, and looks up at you with new attention.',
  effects: {
    movement: 'hotel_de_treville',
    scenario_flags: ['letter_delivered'],
    hit_points_delta: 0,
  },
}

async function seedGame(): Promise<{ userId: string; sessionId: string }> {
  const client = db.connection()

  await new TestUserSeeder(client).run()
  await new DemoSessionSeeder(client).run()

  const player = await User.findByOrFail('email', 'player@wanderlore.test')
  const session = await Session.query().where('userId', player.id).firstOrFail()

  return { userId: player.id, sessionId: session.id }
}

function buildService(options: FakeLlmProviderOptions, timeoutMs = 1000) {
  const provider = new FakeLlmProvider(options)

  const service = new TurnService(
    new LlmGateway(provider, { requestTimeoutMs: timeoutMs }),
    new RulesEngine(new DiceService(FakeRandomSource.fromFaces([5, 4])))
  )

  return { provider, service, play: playerOf(service) }
}

test.group('Phase 1 | the seeded game is playable', (group) => {
  useTransaction(group)

  test('the demo character only knows skills the world defines', async ({ assert }) => {
    const { sessionId } = await seedGame()
    const session = await Session.query().where('id', sessionId).preload('characters').firstOrFail()

    /**
     * The closed list the validator enforces is only true if the seeded
     * character respects it too.
     */
    const known = THREE_MUSKETEERS.skills.map((skill) => skill.reference)
    assert.containsSubset(known, Object.keys(session.characters[0].skills))
  })

  test('every content reference of the seeded game has a label', async ({ assert }) => {
    const { sessionId } = await seedGame()
    const session = await Session.query()
      .where('id', sessionId)
      .preload('characters')
      .preload('worldState')
      .firstOrFail()
    const [character] = session.characters
    const labels = new ContentLabels(THREE_MUSKETEERS)

    /**
     * What the game view will show: a reference the world cannot label would
     * fail that view outright rather than reach the player raw.
     */
    const references: [ContentKind, string][] = [
      ['chapter', session.currentChapter!],
      ...Object.keys(character.attributes).map((ref): [ContentKind, string] => ['attribute', ref]),
      ...Object.keys(character.skills).map((ref): [ContentKind, string] => ['skill', ref]),
      ...Object.keys(character.resources).map((ref): [ContentKind, string] => ['resource', ref]),
      ...session.worldState.visitedLocations.map((location): [ContentKind, string] => [
        'location',
        location.reference as string,
      ]),
      ...session.worldState.activeQuests.map((quest): [ContentKind, string] => [
        'quest',
        quest.reference as string,
      ]),
    ]

    for (const [kind, reference] of references) {
      assert.doesNotThrow(() => labels.of(kind, reference), `${kind} "${reference}"`)
    }
  })

  test('a full turn updates the world and logs what it cost', async ({ assert }) => {
    const { userId, sessionId } = await seedGame()
    const { play } = buildService({ jsonSequence: [ARBITRATION_WITH_ROLL, NARRATION] })

    const result = await play({
      sessionId,
      userId,
      playerInput: 'I present my father’s letter to Monsieur de Tréville.',
    })

    assert.equal(result.narratedText, NARRATION.narration)

    const world = await WorldState.query().where('sessionId', sessionId).firstOrFail()
    assert.propertyVal(world.narrativeFlags, 'letter_delivered', true)
    assert.deepEqual(world.visitedLocations.at(-1), { reference: 'hotel_de_treville' })

    const turn = await TurnLog.query().where('sessionId', sessionId).firstOrFail()
    assert.equal(turn.language, 'en')
    assert.equal(turn.turnNumber, 1)
    assert.lengthOf(turn.llmUsage!, 2)
    assert.isNotNull(turn.rollResult)
  })

  test('the recent buffer carries the previous turn into the next one', async ({ assert }) => {
    const { userId, sessionId } = await seedGame()

    await buildService({ jsonSequence: [ARBITRATION_WITH_ROLL, NARRATION] }).play({
      sessionId,
      userId,
      playerInput: 'I present the letter.',
    })

    const next = buildService({ jsonSequence: [ARBITRATION_WITH_ROLL, NARRATION] })
    await next.play({ sessionId, userId, playerInput: 'I ask about my father.' })

    /**
     * Without it the game master would forget the previous exchange, which is
     * the whole point of keeping a buffer before long-term memory exists.
     */
    assert.include(next.provider.requests[0].userMessage, 'I present the letter.')
    assert.include(next.provider.requests[0].userMessage, NARRATION.narration)
  })
})

test.group('Phase 1 | every failure is differentiated', (group) => {
  useTransaction(group)

  const cases: [LlmErrorCategory, FakeLlmProviderOptions][] = [
    ['provider_unreachable', { error: httpish('provider_unreachable') }],
    ['provider_http_error', { error: httpish('provider_http_error') }],
    ['invalid_output', { raw: 'Certainly! Here is your turn.' }],
  ]

  for (const [category, options] of cases) {
    test(`surfaces ${category} without applying anything`, async ({ assert }) => {
      const { userId, sessionId } = await seedGame()
      const { play } = buildService(options)

      const error = await play({ sessionId, userId, playerInput: 'I present the letter.' })
        .then(() => null)
        .catch((caught) => caught)

      assert.instanceOf(error, LlmError)
      assert.equal(error.category, category)

      const world = await WorldState.query().where('sessionId', sessionId).firstOrFail()
      assert.deepEqual(world.narrativeFlags, {})
    })
  }

  test('surfaces a timeout when the model runs past the deadline', async ({ assert }) => {
    const { userId, sessionId } = await seedGame()
    const { play } = buildService({ delayMs: 200, json: ARBITRATION_WITH_ROLL }, 20)

    const error = await play({ sessionId, userId, playerInput: 'I present the letter.' })
      .then(() => null)
      .catch((caught) => caught)

    assert.instanceOf(error, LlmError)
    assert.equal(error.category, 'timeout')
  })

  test('logs a failed turn so it can be debugged', async ({ assert }) => {
    const { userId, sessionId } = await seedGame()
    const { play } = buildService({ raw: 'not json at all' })

    await play({ sessionId, userId, playerInput: 'I present the letter.' }).catch(() => {})

    const turn = await TurnLog.query().where('sessionId', sessionId).firstOrFail()

    assert.equal(turn.playerInput, 'I present the letter.')
    assert.isNull(turn.narratedText)
    assert.isNull(turn.arbitrationOutput)
  })
})

/**
 * The adapter is what normally maps a vendor failure onto a category, so a
 * double reproduces the shape the gateway forwards untouched.
 */
function httpish(category: LlmErrorCategory): LlmError {
  return new LlmError(category, `simulated ${category}`, { step: 'arbitration', provider: 'fake' })
}
