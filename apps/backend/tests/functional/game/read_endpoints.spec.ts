import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import User from '#models/user'
import Session from '#models/session'
import TurnLog from '#models/turn_log'
import Character from '#models/character'
import WorldState from '#models/world_state'
import { createUser, useTransaction } from '#tests/helpers/database'

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
    status: 'in_progress',
    currentChapter: 'the_road_to_paris',
    lastActivityAt,
  })

  await Character.create({
    sessionId: session.id,
    name: "d'Artagnan",
    attributes: { social: 3, physical: 3 },
    skills: { persuasion: 2, swordsmanship: 3 },
    resources: { purse: 15 },
    progression: {},
    hitPoints: 8,
    hitPointsMax: 10,
  })

  await WorldState.create({
    sessionId: session.id,
    activeQuests: [
      { reference: 'deliver_the_letter', step: 1, summary: 'Carry the letter to Tréville.' },
    ],
    narrativeFlags: { letter_read: true },
    visitedLocations: [{ reference: 'meung_sur_loire' }, { reference: 'hotel_de_treville' }],
    worldObjects: [],
  })

  return session
}

function completedTurn(sessionId: string, turnNumber: number) {
  return TurnLog.create({
    sessionId,
    turnNumber,
    status: 'completed',
    playerInput: `Action ${turnNumber}`,
    language: 'en',
    arbitrationOutput: { resolution: { mode: 'roll_required', skill_used: 'persuasion' } },
    rollResult: {
      dice: [6, 5],
      skillValue: 2,
      total: 13,
      threshold: 9,
      margin: 4,
      difficulty: 'medium',
      result: 'success',
      marginLabel: 'comfortable',
    },
    narratedText: `Narration ${turnNumber}`,
    appliedEffects: {
      movement: 'hotel_de_treville',
      scenario_flags: ['letter_read'],
      hit_points_delta: -2,
    },
  })
}

function failedTurn(sessionId: string, turnNumber: number) {
  return TurnLog.create({
    sessionId,
    turnNumber,
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

    assert.deepEqual(character.attributes, [
      { reference: 'physical', label: 'Physical', value: 3 },
      { reference: 'social', label: 'Social', value: 3 },
    ])
    assert.deepEqual(character.skills, [
      { reference: 'swordsmanship', label: 'Swordsmanship', value: 3, attribute: 'physical' },
      { reference: 'persuasion', label: 'Persuasion', value: 2, attribute: 'social' },
    ])
    assert.deepEqual(character.resources, [{ reference: 'purse', label: 'Purse', value: 15 }])
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
    await completedTurn(session.id, 3)
    await failedTurn(session.id, 2)
    await completedTurn(session.id, 1)

    const response = await client.get(`/api/v1/sessions/${session.id}/turns`).loginAs(player)

    response.assertStatus(200)

    /** A failed turn is logged, but it is not part of the story. */
    assert.deepEqual(
      dataOf(response).map((turn: { turnNumber: number }) => turn.turnNumber),
      [1, 3]
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
    assert.deepEqual(turn.roll, {
      skill: { reference: 'persuasion', label: 'Persuasion' },
      result: 'success',
      margin: 'comfortable',
    })
    assert.deepEqual(turn.effects, {
      hitPointsDelta: -2,
      movement: { reference: 'hotel_de_treville', label: 'Hôtel de Tréville' },
    })
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

    for (const leak of ['dice', 'threshold', 'total', 'skillValue', 'letter_read']) {
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
    const turn = await failedTurn(session.id, 1)

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
