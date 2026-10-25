import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import User from '#models/user'
import Session from '#models/session'
import TurnLog from '#models/turn_log'
import Character from '#models/character'
import WorldState from '#models/world_state'
import { THREE_MUSKETEERS, GASCON } from '#tests/helpers/worlds'
import { improviseLocation, visitUniqueLocation } from '#services/game/locations'
import { createUser, useTransaction } from '#tests/helpers/database'
import { seedMusketeers } from '#tests/helpers/content'
import { createItem, destroyItem, equipItem } from '#services/game/inventory'
import { enterScene } from '#services/game/npcs'

/**
 * The routes the front reads a game through. Built on fixtures rather than on
 * a played turn: what is under test is what leaves the backend, not how the
 * pipeline wrote it.
 */
/**
 * The typed test client cannot tell these routes apart from a path built by
 * interpolation, so the body is read untyped and asserted field by field.
 */
function dataOf(response: { body(): unknown }): any {
  return (response.body() as { data: unknown }).data
}

async function arrangeGame(userId: string, lastActivityAt = DateTime.now()) {
  const session = await Session.create({
    userId,
    ...(await seedMusketeers()),
    status: 'in_progress',
    currentChapter: 'the_road_to_paris',
    lastActivityAt,
  })

  await Character.create({
    sessionId: session.id,
    name: "d'Artagnan",
    characteristics: GASCON,
    skills: { persuasion: 45, swordsmanship: 60 },
    resources: { purse: 15 },
    progression: {},
    hitPoints: 8,
    hitPointsMax: 10,
  })

  await visitUniqueLocation(THREE_MUSKETEERS, session.id, 'meung_sur_loire')
  const treville = await visitUniqueLocation(THREE_MUSKETEERS, session.id, 'hotel_de_treville')

  await WorldState.create({
    sessionId: session.id,
    currentLocationId: treville.id,
    activeQuests: [
      { reference: 'deliver_the_letter', step: 1, summary: 'Carry the letter to Tréville.' },
    ],
    narrativeFlags: { letter_read: true },
  })

  return session
}

/** Moves the game into a new improvised place, as the extraction step will. */
async function standIn(
  sessionId: string,
  place: { definition: string; parent: string; name: string | null }
) {
  const instance = await improviseLocation(THREE_MUSKETEERS, sessionId, {
    ...place,
    descriptor: 'a smoky room with low beams',
  })

  await WorldState.query()
    .where('sessionId', sessionId)
    .update({ current_location_id: instance.id })
}

function completedTurn(sessionId: string, turnNumber: number) {
  return TurnLog.create({
    sessionId,
    turnNumber,
    status: 'completed',
    playerInput: `Action ${turnNumber}`,
    language: 'en',
    arbitrationOutput: { resolution: { mode: 'roll_required', action_type: 'social_persuasion' } },
    rollResult: {
      actionType: 'social_persuasion',
      base: { kind: 'skill', skill: 'persuasion', value: 45 },
      baseChance: 45,
      difficulty: 'average',
      appliedModifiers: [],
      chance: 45,
      roll: 8,
      result: 'success',
      degree: 'special',
    },
    narratedText: `Narration ${turnNumber}`,
    appliedEffects: {
      movement: 'hotel_de_treville',
      scenario_flags: ['letter_read'],
      hit_points_delta: -2,
    },
  })
}

/** A failed turn never takes a place in the story, so it holds no number. */
function failedTurn(sessionId: string) {
  return TurnLog.create({
    sessionId,
    turnNumber: null,
    status: 'failed',
    playerInput: 'I brew a potion.',
    language: 'en',
    failure: {
      code: 'turn_validation_failed',
      message: 'Nothing was applied.',
      step: 'arbitration',
      reasons: [{ field: 'resolution.skill_used', rule: 'enum', message: 'Unknown skill.' }],
    },
  })
}

test.group('GET /sessions', (group) => {
  useTransaction(group)

  test("lists the player's games only, most recently played first", async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    const older = await arrangeGame(player.id, DateTime.now().minus({ days: 2 }))
    const newer = await arrangeGame(player.id)
    await arrangeGame(await createUser())

    const response = await client.get('/api/v1/sessions').loginAs(player)

    response.assertStatus(200)
    const games = dataOf(response)

    assert.deepEqual(
      games.map((game: { id: string }) => game.id),
      [newer.id, older.id]
    )
  })

  test('gives each card its labels and hit points', async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    await arrangeGame(player.id)

    const response = await client.get('/api/v1/sessions').loginAs(player)
    const [game] = dataOf(response)

    assert.deepEqual(game.world, { reference: 'three_musketeers', label: 'The Three Musketeers' })
    assert.deepEqual(game.chapter, { reference: 'the_road_to_paris', label: 'The Road to Paris' })
    assert.equal(game.status, 'in_progress')
    assert.deepEqual(game.character, { name: "d'Artagnan", hitPoints: 8, hitPointsMax: 10 })
  })

  test('refuses an anonymous request', async ({ client }) => {
    const response = await client.get('/api/v1/sessions')

    response.assertStatus(401)
  })
})

test.group('GET /sessions/:id', (group) => {
  useTransaction(group)

  test('gives the full sheet, labelled and in world order', async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)

    const response = await client.get(`/api/v1/sessions/${session.id}`).loginAs(player)

    response.assertStatus(200)
    const { character } = dataOf(response)

    /** The seven of BRP, always in the same order, labelled by the front. */
    assert.deepEqual(character.characteristics, [
      { reference: 'STR', value: 13 },
      { reference: 'CON', value: 14 },
      { reference: 'SIZ', value: 12 },
      { reference: 'INT', value: 13 },
      { reference: 'POW', value: 12 },
      { reference: 'DEX', value: 16 },
      { reference: 'CHA', value: 14 },
    ])
    assert.deepEqual(character.skills, [
      { reference: 'swordsmanship', label: 'Swordsmanship', value: 60, category: 'combat' },
      { reference: 'persuasion', label: 'Persuasion', value: 45, category: 'communication' },
    ])
    assert.deepEqual(character.resources, [{ reference: 'purse', label: 'Purse', value: 15 }])
  })

  test("shows the character's inventory, labelled, without what items are worth", async ({
    client,
    assert,
  }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)
    const character = await Character.findByOrFail('sessionId', session.id)
    const holder = { type: 'character' as const, id: character.id }
    const make = (definition: string, quantity = 1, descriptor: string | null = null) =>
      createItem(THREE_MUSKETEERS, session.id, { definition, descriptor, quantity }, holder)

    await make('letter_to_treville')
    const sword = await make('rapier', 1, "his father's old sword")
    await equipItem(THREE_MUSKETEERS, sword)
    await make('lead_shot', 6)
    const stool = await make('improvised_weapon', 1, 'a three-legged stool')
    await destroyItem(THREE_MUSKETEERS, stool, 1)
    /** Someone else's: never on the sheet. */
    const rochefort = await enterScene(THREE_MUSKETEERS, session.id, {
      definition: 'rochefort',
      descriptor: null,
    })
    await createItem(
      THREE_MUSKETEERS,
      session.id,
      { definition: 'dagger', descriptor: null, quantity: 1 },
      { type: 'npc', id: rochefort.id }
    )

    const response = await client.get(`/api/v1/sessions/${session.id}`).loginAs(player)

    response.assertStatus(200)
    const { inventory } = dataOf(response).character
    assert.sameDeepMembers(inventory, [
      {
        handle: 'letter_to_treville',
        item: { reference: 'letter_to_treville', label: 'Letter for M. de Tréville' },
        quantity: 1,
        equipped: false,
      },
      {
        handle: 'rapier_1',
        item: { reference: 'rapier', label: 'Rapier' },
        quantity: 1,
        equipped: true,
      },
      {
        handle: null,
        item: { reference: 'lead_shot', label: 'Lead shot' },
        quantity: 6,
        equipped: false,
      },
    ])
    const body = JSON.stringify(dataOf(response))
    for (const leak of ['modifiers', 'old sword', 'condition']) {
      assert.notInclude(body, leak)
    }
  })

  test('says where the story stands', async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)

    const response = await client.get(`/api/v1/sessions/${session.id}`).loginAs(player)
    const game = dataOf(response)

    assert.deepEqual(game.location, { reference: 'hotel_de_treville', label: 'Hôtel de Tréville' })
    assert.deepEqual(game.activeQuests, [
      {
        reference: 'deliver_the_letter',
        label: 'Deliver the letter',
        summary: 'Carry the letter to Tréville.',
      },
    ])
    assert.isNull(game.pendingTurn)
  })

  test('names an improvised place by its proper name', async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)
    await standIn(session.id, { definition: 'town', parent: 'france', name: 'Orléans' })

    const response = await client.get(`/api/v1/sessions/${session.id}`).loginAs(player)

    assert.deepEqual(dataOf(response).location, { reference: 'town_1', label: 'Orléans' })
  })

  test('names a nameless place by its archetype within its parent', async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)
    await standIn(session.id, { definition: 'tavern', parent: 'meung_sur_loire', name: null })

    const response = await client.get(`/api/v1/sessions/${session.id}`).loginAs(player)
    const { location } = dataOf(response)

    /** The descriptor is English and the narrator's: it never reaches the player. */
    assert.deepEqual(location, { reference: 'tavern_1', label: 'Tavern · Meung-sur-Loire' })
    assert.notInclude(JSON.stringify(dataOf(response)), 'smoky')
  })

  test('never exposes scenario flags', async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)

    const response = await client.get(`/api/v1/sessions/${session.id}`).loginAs(player)

    assert.notInclude(response.text(), 'letter_read')
  })

  test("answers 404 for someone else's game", async ({ client }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(await createUser())

    const response = await client.get(`/api/v1/sessions/${session.id}`).loginAs(player)

    /**
     * Not a 403: telling an intruder that a game exists but is not theirs
     * leaks more than refusing to acknowledge it at all.
     */
    response.assertStatus(404)
  })

  test('answers 404 for a malformed id rather than a database error', async ({ client }) => {
    const player = await User.findOrFail(await createUser())

    const response = await client.get('/api/v1/sessions/not-a-uuid').loginAs(player)

    response.assertStatus(404)
  })
})

test.group('GET /sessions/:id/turns', (group) => {
  useTransaction(group)

  test('returns completed turns only, oldest first', async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)
    await completedTurn(session.id, 2)
    await failedTurn(session.id)
    await completedTurn(session.id, 1)

    const response = await client.get(`/api/v1/sessions/${session.id}/turns`).loginAs(player)

    response.assertStatus(200)

    /** A failed turn is logged, but it is not part of the story. */
    assert.deepEqual(
      dataOf(response).map((turn: { turnNumber: number }) => turn.turnNumber),
      [1, 2]
    )
  })

  test('shows the roll qualitatively and the effects with labels', async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)
    await completedTurn(session.id, 1)

    const response = await client.get(`/api/v1/sessions/${session.id}/turns`).loginAs(player)
    const [turn] = dataOf(response)

    assert.equal(turn.playerInput, 'Action 1')
    assert.equal(turn.narration, 'Narration 1')
    /** No item weighed, none changed. */
    assert.deepEqual(turn.roll, {
      skill: { reference: 'persuasion', label: 'Persuasion' },
      characteristic: null,
      result: 'success',
      degree: 'special',
      items: [],
    })
    assert.deepEqual(turn.effects, {
      hitPointsDelta: -2,
      movement: { reference: 'hotel_de_treville', label: 'Hôtel de Tréville' },
      items: [],
    })
  })

  test('names the items that weighed on a roll, never their value', async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)
    const turn = await completedTurn(session.id, 1)
    turn.rollResult = {
      ...turn.rollResult,
      appliedModifiers: [
        { source: 'contextual', origin: 'favorable_reputation', value: 1 },
        { source: 'item', origin: 'letter_to_treville', value: 1 },
      ],
    }
    await turn.save()

    const response = await client.get(`/api/v1/sessions/${session.id}/turns`).loginAs(player)
    const [read] = dataOf(response)

    assert.deepEqual(read.roll.items, [
      { reference: 'letter_to_treville', label: 'Letter for M. de Tréville' },
    ])
    assert.notInclude(JSON.stringify(read), 'favorable_reputation')
    assert.notInclude(JSON.stringify(read), 'appliedModifiers')
  })

  test("tells what happened to the character's items, and with whom", async ({
    client,
    assert,
  }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)
    const turn = await completedTurn(session.id, 1)
    const rochefort = {
      holder: 'npc',
      handle: 'rochefort',
      definitionReference: 'rochefort',
      name: null,
    }
    const guard = {
      holder: 'npc',
      handle: 'cardinal_guard_1',
      definitionReference: 'cardinal_guard',
      name: 'Bernajoux',
    }
    turn.appliedEffects = {
      ...turn.appliedEffects,
      items: {
        created: [
          { item: 'food', definition: 'food', quantity: 2, holder: { holder: 'character' } },
        ],
        transferred: [
          {
            item: 'letter_to_treville',
            definition: 'letter_to_treville',
            quantity: 1,
            from: { holder: 'character' },
            to: rochefort,
          },
          {
            item: 'common_sword_1',
            definition: 'common_sword',
            quantity: 1,
            from: guard,
            to: { holder: 'character' },
          },
          /** Between others: not the player's business. */
          { item: 'dagger_1', definition: 'dagger', quantity: 1, from: rochefort, to: guard },
        ],
        destroyed: [
          {
            item: 'lead_shot',
            definition: 'lead_shot',
            quantity: 1,
            holder: { holder: 'character' },
          },
        ],
        equipped: [{ item: 'common_sword_1', definition: 'common_sword' }],
        unequipped: [],
      },
    }
    await turn.save()

    const response = await client.get(`/api/v1/sessions/${session.id}/turns`).loginAs(player)
    const [read] = dataOf(response)

    assert.deepEqual(read.effects.items, [
      {
        change: 'gained',
        item: { reference: 'food', label: 'Food' },
        quantity: 2,
        counterpart: null,
      },
      {
        change: 'lost',
        item: { reference: 'letter_to_treville', label: 'Letter for M. de Tréville' },
        quantity: 1,
        counterpart: { reference: 'rochefort', label: 'Rochefort' },
      },
      {
        change: 'gained',
        item: { reference: 'common_sword', label: 'Sword' },
        quantity: 1,
        counterpart: { reference: 'cardinal_guard_1', label: 'Bernajoux' },
      },
      {
        change: 'used_up',
        item: { reference: 'lead_shot', label: 'Lead shot' },
        quantity: 1,
        counterpart: null,
      },
      {
        change: 'equipped',
        item: { reference: 'common_sword', label: 'Sword' },
        quantity: 1,
        counterpart: null,
      },
    ])
  })

  test('never exposes the dice, the threshold, the total or the flags', async ({
    client,
    assert,
  }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)
    await completedTurn(session.id, 1)

    const response = await client.get(`/api/v1/sessions/${session.id}/turns`).loginAs(player)
    const body = response.text()

    for (const leak of ['baseChance', '"chance"', 'letter_read']) {
      assert.notInclude(body, leak)
    }
  })

  test("answers 404 for someone else's game", async ({ client }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(await createUser())
    await completedTurn(session.id, 1)

    const response = await client.get(`/api/v1/sessions/${session.id}/turns`).loginAs(player)

    response.assertStatus(404)
  })
})

test.group('GET /sessions/:id/turns/:turnId', (group) => {
  useTransaction(group)

  test('reads a failed turn back with what the player was told', async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)
    const turn = await failedTurn(session.id)

    const response = await client
      .get(`/api/v1/sessions/${session.id}/turns/${turn.id}`)
      .loginAs(player)

    response.assertStatus(200)
    const read = dataOf(response)

    assert.equal(read.status, 'failed')
    assert.isNull(read.narration)

    /** Code and message only: the rejected rules are for whoever debugs it. */
    assert.deepEqual(read.failure, {
      code: 'turn_validation_failed',
      message: 'Nothing was applied.',
    })
  })

  test('reads a completed turn back with its result', async ({ client, assert }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)
    const turn = await completedTurn(session.id, 1)

    const response = await client
      .get(`/api/v1/sessions/${session.id}/turns/${turn.id}`)
      .loginAs(player)
    const read = dataOf(response)

    assert.equal(read.status, 'completed')
    assert.equal(read.narration, 'Narration 1')
    assert.isNull(read.failure)
  })

  test("answers 404 for a turn of someone else's game", async ({ client }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(await createUser())
    const turn = await completedTurn(session.id, 1)

    const response = await client
      .get(`/api/v1/sessions/${session.id}/turns/${turn.id}`)
      .loginAs(player)

    response.assertStatus(404)
  })

  test("answers 404 for a turn of another of the same player's games", async ({ client }) => {
    const player = await User.findOrFail(await createUser())
    const session = await arrangeGame(player.id)
    const other = await arrangeGame(player.id)
    const turn = await completedTurn(other.id, 1)

    const response = await client
      .get(`/api/v1/sessions/${session.id}/turns/${turn.id}`)
      .loginAs(player)

    response.assertStatus(404)
  })
})
