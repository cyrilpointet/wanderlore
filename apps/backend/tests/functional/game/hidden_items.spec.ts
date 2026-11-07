import { test } from '@japa/runner'
import { playAs } from '#tests/helpers/characters'

import InventoryItem from '#models/inventory_item'
import WorldState from '#models/world_state'
import { DiceService } from '#services/dice'
import { LlmGateway } from '#services/llm/gateway'
import { RulesEngine } from '#services/rules/engine'
import { TurnService } from '#services/game/turn_service'
import { visitUniqueLocation } from '#services/game/locations'
import { MemoryQueue } from '#services/queue/drivers/memory_queue'
import { HOUSE_WORLD } from '#tests/helpers/places'
import { GASCON } from '#tests/helpers/worlds'
import { seedHouse } from '#tests/helpers/content'
import { FakeLlmProvider, streamed } from '#tests/helpers/fake_llm_provider'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'
import { FakeClock } from '#tests/helpers/fake_clock'
import { RecordingTurnEvents } from '#tests/helpers/recording_turn_events'
import { createSession, createUser, useTransaction } from '#tests/helpers/database'
import { CHARACTER, extracted, playerOf } from '#tests/helpers/turns'
import type { AppliedEffects } from '#services/game/prompts/types'

/**
 * Hidden items, on the model of hidden exits: lying unseen in a place until a
 * search finds them — the model replaced.
 */

const SEARCH = {
  intent: { type: 'search', target: null, summary: 'Searching the hall', destination: null },
  validity: { factual: true, plausibility: 'plausible', justification: 'Nothing prevents it.' },
  resolution: { mode: 'automatic_success', action_type: null, difficulty: null },
  duration: { label: 'minutes', count: null, period: null, event: null, npc: null },
  alert: { prompt_injection_suspected: false, out_of_scope: false },
}

function buildService(answers: unknown[]) {
  const provider = new FakeLlmProvider({ jsonSequence: answers })
  const service = new TurnService(
    new LlmGateway(provider, { requestTimeoutMs: 1000 }),
    new RulesEngine(new DiceService(FakeRandomSource.fromFaces([]))),
    new MemoryQueue(),
    new RecordingTurnEvents(),
    new FakeClock()
  )

  return {
    play: playerOf(service),
    messageOf: (step: string) => provider.requests.find((request) => request.step === step)!,
  }
}

/** D'Artagnan in the hall of the house of the specs, the Cardinal's seal hidden there. */
async function arrange() {
  const content = await seedHouse()
  const userId = await createUser()
  const sessionId = await createSession(userId, content)
  await playAs(sessionId, {
    name: "d'Artagnan",
    skills: {},
    characteristics: GASCON,
    resources: {},
    hitPoints: 26,
    hitPointsMax: 26,
  })
  await visitUniqueLocation(HOUSE_WORLD, sessionId, 'house_yard')
  const hall = await visitUniqueLocation(HOUSE_WORLD, sessionId, 'house_hall')
  await WorldState.create({
    sessionId,
    currentLocationId: hall.id,
    activeQuests: [],
    narrativeFlags: {},
    knownNpcs: [],
    gameTime: 10 * 3600,
  })
  const seal = await InventoryItem.create({
    sessionId,
    locationInstanceId: hall.id,
    definitionReference: 'cardinal_seal',
    handle: 'cardinal_seal',
    quantity: 1,
    state: 'carried',
    hidden: true,
  })

  return { userId, sessionId, seal }
}

test.group('Hidden items | a search finds them', (group) => {
  useTransaction(group)

  test('found and picked up in the same turn', async ({ assert }) => {
    const { userId, sessionId, seal } = await arrange()
    const { play, messageOf } = buildService([
      SEARCH,
      streamed('Under a loose flagstone, a seal of red wax and gold.'),
      extracted({
        items_discovered: ['cardinal_seal'],
        items_transferred: [
          {
            item: 'cardinal_seal',
            from: { holder: 'location', handle: null },
            to: CHARACTER,
            quantity: 1,
          },
        ],
      }),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I search the hall.' })

    /** Each step was told it lies there unseen; extraction, apart from what lies in sight. */
    assert.include(messageOf('arbitration').userMessage, '"hidden":true')
    assert.include(messageOf('narration').userMessage, '"hidden":true')
    assert.include(messageOf('extraction').userMessage, '"hidden_items":[{"item":"cardinal_seal"')

    await seal.refresh()
    assert.isFalse(seal.hidden)
    assert.isNotNull(seal.characterId)
    const applied = turn.appliedEffects as AppliedEffects
    assert.deepEqual(applied.items.discovered, [
      { item: 'cardinal_seal', definition: 'cardinal_seal' },
    ])
  })

  test('not found, it cannot be taken: the extraction is sent back once', async ({ assert }) => {
    const { userId, sessionId, seal } = await arrange()
    const takeIt = {
      items_transferred: [
        {
          item: 'cardinal_seal',
          from: { holder: 'location' as const, handle: null },
          to: CHARACTER,
          quantity: 1,
        },
      ],
    }
    const { play } = buildService([
      SEARCH,
      streamed('You pocket a seal.'),
      extracted(takeIt),
      extracted(),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I search the hall.' })

    assert.equal(turn.status, 'completed')
    assert.lengthOf(turn.rejectedAttempts ?? [], 1)
    await seal.refresh()
    const worldState = await WorldState.findByOrFail('sessionId', sessionId)
    assert.isTrue(seal.hidden)
    assert.equal(seal.locationInstanceId, worldState.currentLocationId)
  })
})
