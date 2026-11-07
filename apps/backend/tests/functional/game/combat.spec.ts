import { test } from '@japa/runner'
import { playAs } from '#tests/helpers/characters'
import db from '@adonisjs/lucid/services/db'

import CharacterState from '#models/character_state'
import Session from '#models/session'
import NpcInstance from '#models/npc_instance'
import WorldState from '#models/world_state'
import { DiceService } from '#services/dice'
import { LlmGateway } from '#services/llm/gateway'
import { RulesEngine } from '#services/rules/engine'
import { TurnService } from '#services/game/turn_service'
import { toMessage } from '#services/game/turn_events'
import { MemoryQueue } from '#services/queue/drivers/memory_queue'
import { FakeLlmProvider, streamed } from '#tests/helpers/fake_llm_provider'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'
import { FakeClock } from '#tests/helpers/fake_clock'
import { extracted, playerOf } from '#tests/helpers/turns'
import { RecordingTurnEvents } from '#tests/helpers/recording_turn_events'
import { seedMusketeers } from '#tests/helpers/content'
import {
  createLocationInstance,
  createSession,
  createUser,
  useTransaction,
} from '#tests/helpers/database'
import { GASCON } from '#tests/helpers/worlds'

/**
 * A round of combat played end to end (roadmap, Phase 10): arbitration names
 * the opponent, the backend rolls the blows — the people's out of sight —
 * the narration stages labels, and the turn applies hit points, deaths and
 * time. The dice are forced, face by face, in the order the round rolls them.
 */

const RULING = {
  intent: { type: 'attack', target: 'cardinal_guard_1', summary: 'Lunging at the guard' },
  validity: { factual: true, plausibility: 'plausible', justification: 'A duel in the street.' },
  resolution: { mode: 'roll_required', action_type: 'melee_combat', difficulty: 'average' },
  duration: { label: 'minutes', count: null, period: null },
  combat: {
    opponent: 'cardinal_guard_1',
    character_attacks: true,
    parry_possible: true,
    dodge_possible: true,
    defense_modifiers: [],
    opponent_aware: true,
    riposte_possible: true,
    opponent_defense_modifiers: [],
  },
  alert: { prompt_injection_suspected: false, out_of_scope: false },
}

/** Narration, then an extraction that reads a wound into the text: a round ignores it. */
const STAGED = [streamed('Steel rings on steel.'), extracted({ hit_points_delta: -3 })]

const SETTLED = {
  ...RULING,
  intent: { type: 'wait', target: null, summary: 'Catching one’s breath' },
  resolution: { mode: 'automatic_success', action_type: null, difficulty: null },
  duration: { label: 'moment', count: null, period: null },
  combat: { ...RULING.combat, opponent: null },
}

async function arrangeDuel(
  guard: Partial<{ hitPoints: number; status: 'present' | 'dying' }> = {}
) {
  const content = await seedMusketeers()
  const userId = await createUser()
  const sessionId = await createSession(userId, content)
  const placeId = await createLocationInstance(sessionId, 'paris', { definitionReference: 'paris' })
  const { character } = await playAs(sessionId, {
    name: "d'Artagnan",
    skills: { swordsmanship: 60 },
    characteristics: GASCON,
    resources: {},
    hitPoints: 26,
    hitPointsMax: 26,
  })
  await WorldState.create({
    sessionId,
    activeQuests: [],
    narrativeFlags: {},
    currentLocationId: placeId,
    gameTime: 1000,
  })
  const now = new Date()
  await db.table('inventory_items').insert({
    session_id: sessionId,
    character_id: character.id,
    definition_reference: 'rapier',
    handle: 'rapier_1',
    quantity: 1,
    state: 'equipped',
    created_at: now,
    updated_at: now,
  })
  await NpcInstance.create({
    sessionId,
    handle: 'cardinal_guard_1',
    definitionReference: 'cardinal_guard',
    descriptor: 'a guard with a scar',
    disposition: 'hostile',
    status: guard.status ?? 'present',
    hitPoints: guard.hitPoints ?? 13,
    locationInstanceId: placeId,
    firstAidAvailable: guard.status === 'dying',
  })

  return { userId, sessionId, characterId: character.id }
}

function buildService(answers: unknown[], faces: number[]) {
  const provider = new FakeLlmProvider({ jsonSequence: answers })
  const events = new RecordingTurnEvents()
  const service = new TurnService(
    new LlmGateway(provider, { requestTimeoutMs: 1000 }),
    new RulesEngine(new DiceService(FakeRandomSource.fromFaces(faces))),
    new MemoryQueue(),
    events,
    new FakeClock()
  )

  return { provider, service, events, play: playerOf(service) }
}

const guardOf = (sessionId: string, handle = 'cardinal_guard_1') =>
  NpcInstance.query().where('sessionId', sessionId).where('handle', handle).firstOrFail()

/** The character's rolls as the player is sent them, in order. */
function rollsSent(events: RecordingTurnEvents) {
  return events.recorded.map(({ event }) => event).filter((event) => event.type === 'roll_resolved')
}

test.group('Combat | a round', (group) => {
  useTransaction(group)

  test('a blow lands and the riposte is parried: only the guard is hurt', async ({ assert }) => {
    const { userId, sessionId, characterId } = await arrangeDuel()
    /**
     * The attack 20 (success), the guard's parry 90 (failure), the rapier 4
     * and the Gascon's +1D4 2, less the guard's buff coat 1; then the guard's
     * riposte 30 (success) and the character's parry 50 (success).
     */
    const { play, events, provider } = buildService([RULING, ...STAGED], [20, 90, 4, 2, 30, 50])

    const turn = await play({ sessionId, userId, playerInput: 'I lunge at the guard.' })

    assert.equal(turn.status, 'completed')
    const guard = await guardOf(sessionId)
    assert.equal(guard.hitPoints, 13 - 6)
    /** The round is the backend's: the wound extraction read counts for nothing. */
    const character = await CharacterState.findByOrFail('characterId', characterId)
    assert.equal(character.hitPoints, 26)

    const sent = rollsSent(events)
    assert.lengthOf(sent, 2)
    assert.deepEqual(sent[0].type === 'roll_resolved' && sent[0].combat, {
      role: 'attack',
      opponent: { reference: 'cardinal_guard_1', label: "Cardinal's Guard", rank: null },
      outcome: 'hit',
      damage: { weapon: 5, modifier: 2, armor: 1, total: 6, effect: null },
    })
    assert.deepEqual(sent[1].type === 'roll_resolved' && sent[1].combat, {
      role: 'defense',
      opponent: { reference: 'cardinal_guard_1', label: "Cardinal's Guard", rank: null },
      defense: 'parry',
      outcome: 'avoided',
    })

    /** Twelve seconds, whatever arbitration proposed. */
    assert.equal(turn.gameTimeAfter! - turn.gameTimeBefore!, 12)

    /** The narrator is told the round in labels: no roll, no damage, no hit points. */
    const narration = JSON.parse(provider.requests[1].userMessage.split('\n\n')[1])
    assert.deepEqual(narration.resolution_to_narrate.combat.character_blow, {
      landed: true,
      degree: 'success',
      met_with: 'parry',
      wound: 'light',
      effect: null,
      fumble: null,
      defender_fumble: null,
    })
    assert.notInclude(JSON.stringify(narration.resolution_to_narrate.combat), '"total"')
  })

  test('the riposte lands: the character is hurt, and never sent the guard’s roll', async ({
    assert,
  }) => {
    const { userId, sessionId, characterId } = await arrangeDuel()
    /** The attack 80 (failure); the riposte 20, the character's parry 80, the rapier 3. */
    const { play, events } = buildService([RULING, ...STAGED], [80, 20, 80, 3])

    await play({ sessionId, userId, playerInput: 'I lunge at the guard.' })

    const character = await CharacterState.findByOrFail('characterId', characterId)
    assert.equal(character.hitPoints, 26 - 4)
    const guard = await guardOf(sessionId)
    assert.equal(guard.hitPoints, 13)

    const sent = rollsSent(events)
    assert.deepEqual(
      sent.map((event) => event.type === 'roll_resolved' && event.combat?.outcome),
      ['missed', 'struck']
    )
    /** Never the guard's own roll: 20 is only in the log. */
    assert.notInclude(
      sent.map((event) => event.type === 'roll_resolved' && event.resolution.roll),
      20
    )
  })

  test('an archetype attacked first is brought in under the handle the round gave', async ({
    assert,
  }) => {
    const { userId, sessionId } = await arrangeDuel()
    const struck = {
      ...RULING,
      combat: { ...RULING.combat, opponent: 'commoner' },
    }
    /**
     * The attack 20; the commoner's dodge — bare hands do not parry — 90;
     * the rapier 4 and the modifier 2, no armour; then the draw 1 of 2 — the
     * commoner, then the hostile guard — and their riposte at their untrained
     * 15 misses on 50.
     */
    const { play, events } = buildService([struck, ...STAGED], [20, 90, 4, 2, 1, 50])

    await play({ sessionId, userId, playerInput: 'I strike the passer-by.' })

    /** Named by their archetype before the turn gives them an instance. */
    const [attack] = rollsSent(events)
    assert.deepEqual(attack.type === 'roll_resolved' && attack.combat?.opponent, {
      reference: 'commoner_1',
      label: 'Commoner',
      rank: null,
    })

    const commoner = await guardOf(sessionId, 'commoner_1')
    assert.equal(commoner.status, 'present')
    assert.equal(commoner.hitPoints, 10 - 7)
  })

  test('another hostile present strikes back in the place of the one attacked', async ({
    assert,
  }) => {
    const { userId, sessionId, characterId } = await arrangeDuel()
    const struck = { ...RULING, combat: { ...RULING.combat, opponent: 'commoner' } }
    /**
     * The attack 20, the commoner's dodge 90, the rapier 4 and the modifier 2;
     * the draw 2 of 2 falls on the guard: his riposte 20, the character's
     * parry 80 fails, the rapier 3 + 1.
     */
    const { play, events, provider } = buildService(
      [struck, ...STAGED],
      [20, 90, 4, 2, 2, 20, 80, 3]
    )

    await play({ sessionId, userId, playerInput: 'I strike the passer-by.' })

    const character = await CharacterState.findByOrFail('characterId', characterId)
    assert.equal(character.hitPoints, 26 - 4)
    const commoner = await guardOf(sessionId, 'commoner_1')
    assert.equal(commoner.hitPoints, 10 - 7)

    /** The character's defence is against the guard, not the one they struck. */
    const sent = rollsSent(events)
    assert.deepEqual(
      sent.map((event) => event.type === 'roll_resolved' && event.combat?.opponent.reference),
      ['commoner_1', 'cardinal_guard_1']
    )

    const narration = JSON.parse(provider.requests[1].userMessage.split('\n\n')[1])
    assert.equal(narration.resolution_to_narrate.combat.opponent, 'commoner_1')
    assert.equal(narration.resolution_to_narrate.combat.opponent_blow_by, 'cardinal_guard_1')
  })

  test('the fumble of another hostile who struck back hurts them', async ({ assert }) => {
    const { userId, sessionId } = await arrangeDuel()
    const struck = { ...RULING, combat: { ...RULING.combat, opponent: 'commoner' } }
    /**
     * As before; the guard's riposte fumbles on 100, table 80: he cuts himself
     * with his rapier, 3 + 1 less his coat.
     */
    const { play } = buildService([struck, ...STAGED], [20, 90, 4, 2, 2, 100, 80, 3])

    await play({ sessionId, userId, playerInput: 'I strike the passer-by.' })

    const guard = await guardOf(sessionId)
    assert.equal(guard.hitPoints, 13 - 3)
    assert.isTrue(guard.firstAidAvailable)
    assert.equal(guard.status, 'present')
  })

  test('brought to 0, a person is dying, and dies at the end of the next turn', async ({
    assert,
  }) => {
    const { userId, sessionId } = await arrangeDuel({ hitPoints: 3 })
    /** The attack 20, the guard's parry 90, 6 through the coat: no riposte from the dying. */
    const { play } = buildService(
      [RULING, ...STAGED, SETTLED, streamed('Silence.'), extracted()],
      [20, 90, 4, 2]
    )

    await play({ sessionId, userId, playerInput: 'I lunge at the guard.' })
    const fallen = await guardOf(sessionId)
    assert.equal(fallen.status, 'dying')

    await play({ sessionId, userId, playerInput: 'I catch my breath.' })
    await fallen.refresh()
    assert.equal(fallen.status, 'dead')
  })

  test('first aid keeps a dying person alive', async ({ assert }) => {
    const { userId, sessionId } = await arrangeDuel({ hitPoints: -1, status: 'dying' })
    const tending = {
      ...SETTLED,
      intent: { type: 'first_aid', target: 'cardinal_guard_1', summary: 'Binding the wound' },
      resolution: { mode: 'roll_required', action_type: 'first_aid', difficulty: 'average' },
    }
    /** 20 against an untrained First Aid of 30, then 2 on the 1D3. */
    const { play } = buildService([tending, streamed('He breathes.'), extracted()], [20, 2])

    await play({ sessionId, userId, playerInput: 'I bind his wound.' })

    const guard = await guardOf(sessionId)
    assert.equal(guard.status, 'present')
    assert.equal(guard.hitPoints, 1)
    assert.isFalse(guard.firstAidAvailable)
  })

  test('brought to 0, the character dies: the game fails with the round', async ({ assert }) => {
    const { userId, sessionId, characterId } = await arrangeDuel()
    await CharacterState.query().where('characterId', characterId).update({ hitPoints: 3 })
    const attacked = {
      ...SETTLED,
      combat: {
        ...RULING.combat,
        character_attacks: false,
        parry_possible: false,
        dodge_possible: false,
      },
    }
    /** No attack of their own; the guard's riposte 20, nothing to meet it with, the rapier 6. */
    const { play, provider } = buildService([attacked, ...STAGED], [20, 6])

    const turn = await play({ sessionId, userId, playerInput: 'I stand there.' })

    const character = await CharacterState.findByOrFail('characterId', characterId)
    const game = await Session.findOrFail(sessionId)
    assert.equal(character.hitPoints, 0)
    assert.deepEqual([game.status, game.endReason], ['failed', 'death'])
    assert.isNotNull(game.endedAt)
    assert.deepEqual(turn.gameEnd, { reason: 'death', event: null, discarded: [] })
    /** Twelve seconds: no hour out of the fight for the dead. */
    assert.equal(turn.gameTimeAfter! - turn.gameTimeBefore!, 12)
    /** The narrator tells the fall, never the death. */
    const narration = provider.requests.find(({ step }) => step === 'narration')!
    assert.include(narration.userMessage, '"character_state":"out"')
  })

  test('a shot at a guard who never sees it coming: no defence, no riposte', async ({ assert }) => {
    const { userId, sessionId, characterId } = await arrangeDuel()
    const now = new Date()
    await db.table('inventory_items').insert({
      session_id: sessionId,
      character_id: characterId,
      definition_reference: 'pistol',
      handle: 'pistol_1',
      quantity: 1,
      state: 'carried',
      created_at: now,
      updated_at: now,
    })
    const ambush = {
      ...RULING,
      resolution: { mode: 'roll_required', action_type: 'ranged_combat', difficulty: 'average' },
      combat: { ...RULING.combat, opponent_aware: false, riposte_possible: false },
    }
    /** The shot 5 — no dodge rolled — the pistol 4 + 1, less the guard's coat. */
    const { play, events, provider } = buildService([ambush, ...STAGED], [5, 4])

    await play({ sessionId, userId, playerInput: 'From the doorway, I fire at his back.' })

    const guard = await guardOf(sessionId)
    assert.equal(guard.hitPoints, 13 - 4)
    /** One roll only: the character's shot. Nothing came back at them. */
    assert.lengthOf(rollsSent(events), 1)
    const character = await CharacterState.findByOrFail('characterId', characterId)
    assert.equal(character.hitPoints, 26)

    const narration = JSON.parse(provider.requests[1].userMessage.split('\n\n')[1])
    const { combat } = narration.resolution_to_narrate
    assert.isTrue(combat.opponent_caught_unaware)
    assert.isNull(combat.character_blow.met_with)
    assert.isNull(combat.opponent_blow)
  })

  test('a unique person whose name the character does not know is sent as a rank', async ({
    assert,
  }) => {
    const { userId, sessionId } = await arrangeDuel()
    const guard = await guardOf(sessionId)
    await NpcInstance.create({
      sessionId,
      handle: 'rochefort',
      definitionReference: 'rochefort',
      descriptor: 'a gentleman with a scar on his temple',
      disposition: 'hostile',
      status: 'present',
      hitPoints: 14,
      locationInstanceId: guard.locationInstanceId,
      firstAidAvailable: false,
    })
    const duel = {
      ...RULING,
      intent: { ...RULING.intent, target: 'rochefort' },
      combat: { ...RULING.combat, opponent: 'rochefort' },
    }
    /**
     * The attack 80 (failure); the draw 1 of 2 — Rochefort, then the guard —
     * falls on him: his riposte 20, the character's parry 50 holds.
     */
    const { play, events } = buildService([duel, ...STAGED], [80, 1, 20, 50])

    await play({ sessionId, userId, playerInput: 'I lunge at the gentleman.' })

    const unknown = { reference: 'rochefort', label: null, rank: 1 }
    assert.deepEqual(
      rollsSent(events).map((event) => event.type === 'roll_resolved' && event.combat?.opponent),
      [unknown, unknown]
    )

    /** Read back with the turn, the same: the name never reaches the player. */
    const completed = events.recorded.find(({ event }) => event.type === 'turn_completed')!
    const message = toMessage(completed.ref, completed.event) as {
      turn: { rolls: { combat: { opponent: unknown } }[] }
    }
    assert.deepEqual(
      message.turn.rolls.map(({ combat }) => combat.opponent),
      [unknown, unknown]
    )
    assert.notInclude(JSON.stringify(message), 'Rochefort')
  })
})

test.group('Combat | out of a fight', (group) => {
  useTransaction(group)

  test('a bleeding stops once the fight is over, and a week heals', async ({ assert }) => {
    const { userId, sessionId, characterId } = await arrangeDuel()
    await CharacterState.query()
      .where('characterId', characterId)
      .update({ hitPoints: 20, bleeding: true, healingSince: 1000 })
    const resting = { ...SETTLED, duration: { label: 'days', count: 7, period: null } }
    /** 2 on the week's 1D3. */
    const { play } = buildService([resting, streamed('A week goes by.'), extracted()], [2])

    await play({ sessionId, userId, playerInput: 'I rest for a week.' })

    const character = await CharacterState.findByOrFail('characterId', characterId)
    assert.isFalse(character.bleeding)
    assert.equal(character.hitPoints, 22)
  })

  test('extraction never heals', async ({ assert }) => {
    const { userId, sessionId } = await arrangeDuel()
    const { play } = buildService(
      [SETTLED, streamed('You feel better.'), extracted({ hit_points_delta: 4 })],
      []
    )

    const turn = await play({ sessionId, userId, playerInput: 'I rest.' }).catch(
      (error: unknown) => error
    )

    /** Refused twice: the second attempt is the same healing. */
    assert.instanceOf(turn, Error)
  })
})
