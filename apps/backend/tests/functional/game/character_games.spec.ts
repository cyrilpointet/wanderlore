import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import User from '#models/user'
import Session from '#models/session'
import Character from '#models/character'
import Profession from '#models/profession'
import { seedMusketeers } from '#tests/helpers/content'
import { createScenario, createTurn, createUser, useTransaction } from '#tests/helpers/database'
import { GASCON } from '#tests/helpers/worlds'

/**
 * The games of a character (roadmap, Phase 12): one at a time, given up when
 * the player chooses, tried again when failed, never again when won; and
 * what the player may delete of them.
 */

/** The status a request answers with. */
async function statusOf(request: PromiseLike<{ status(): number }>): Promise<number> {
  const response = await request

  return response.status()
}
function bodyOf(response: { body(): unknown }): any {
  return response.body()
}

async function userWith(role: 'player' | 'game_master' = 'player'): Promise<User> {
  return User.findOrFail(await createUser({ role }))
}

async function characterOf(user: User, worldId: string, name = "d'Artagnan") {
  const profession = await Profession.query()
    .where('worldId', worldId)
    .where('reference', 'musketeer')
    .firstOrFail()

  return Character.create({
    userId: user.id,
    worldId,
    professionId: profession.id,
    name,
    gender: 'male',
    characteristics: GASCON,
    skills: {},
    progression: {},
  })
}

async function arrange() {
  const content = await seedMusketeers()
  const player = await userWith()
  const character = await characterOf(player, content.worldId)

  return { ...content, player, character }
}

function start(client: any, user: User, characterId: string, scenarioId: string) {
  return client
    .post(`/api/v1/characters/${characterId}/sessions`)
    .json({ scenarioId })
    .loginAs(user)
    .withCsrfToken()
}

function abandon(client: any, user: User, sessionId: string) {
  return client.post(`/api/v1/sessions/${sessionId}/abandon`).loginAs(user).withCsrfToken()
}

test.group('A character’s games | one at a time', (group) => {
  useTransaction(group)

  test('a character in a game cannot start another', async ({ client, assert }) => {
    const { player, character, scenarioId } = await arrange()
    await start(client, player, character.id, scenarioId)

    const response = await start(client, player, character.id, scenarioId)

    response.assertStatus(409)
    assert.equal(bodyOf(response).error.code, 'character_engaged')
  })

  test('a failed scenario is tried again in a new game, the failed one kept closed', async ({
    client,
    assert,
  }) => {
    const { player, character, scenarioId } = await arrange()
    const first = bodyOf(await start(client, player, character.id, scenarioId)).data
    assert.equal(await statusOf(abandon(client, player, first.id)), 200)

    const response = await start(client, player, character.id, scenarioId)

    response.assertStatus(201)
    assert.notEqual(bodyOf(response).data.id, first.id)
    const failed = await Session.findOrFail(first.id)
    assert.equal(failed.status, 'failed')
  })

  test('a completed scenario is neither offered nor played again', async ({ client, assert }) => {
    const { player, character, scenarioId } = await arrange()
    const game = bodyOf(await start(client, player, character.id, scenarioId)).data
    await db.from('sessions').where('id', game.id).update({ status: 'completed' })

    const response = await start(client, player, character.id, scenarioId)
    const page = await client.get(`/api/v1/characters/${character.id}`).loginAs(player)

    response.assertStatus(409)
    assert.equal(bodyOf(response).error.code, 'scenario_completed')
    assert.notInclude(
      bodyOf(page).data.scenarios.map(({ id }: { id: string }) => id),
      scenarioId
    )
  })
})

test.group('A character’s games | giving up', (group) => {
  useTransaction(group)

  test('abandoning fails the game and closes it', async ({ client, assert }) => {
    const { player, character, scenarioId } = await arrange()
    const game = bodyOf(await start(client, player, character.id, scenarioId)).data

    const response = await abandon(client, player, game.id)

    response.assertStatus(200)
    assert.equal(bodyOf(response).data.status, 'failed')
    assert.isNotNull(bodyOf(response).data.endedAt)
    assert.equal(bodyOf(response).data.endReason, 'abandoned')
    /** Closed, it still reads. */
    assert.equal(await statusOf(client.get(`/api/v1/sessions/${game.id}`).loginAs(player)), 200)
  })

  test('a turn being played holds the abandon off', async ({ client, assert }) => {
    const { player, character, scenarioId } = await arrange()
    const game = bodyOf(await start(client, player, character.id, scenarioId)).data
    await createTurn(game.id, null, { status: 'pending' })

    const response = await abandon(client, player, game.id)

    response.assertStatus(409)
    assert.equal(bodyOf(response).error.code, 'turn_already_in_progress')
    const session = await Session.findOrFail(game.id)
    assert.equal(session.status, 'in_progress')
  })

  test('a closed game cannot be given up again', async ({ client, assert }) => {
    const { player, character, scenarioId } = await arrange()
    const game = bodyOf(await start(client, player, character.id, scenarioId)).data
    await abandon(client, player, game.id)

    const response = await abandon(client, player, game.id)

    response.assertStatus(409)
    assert.equal(bodyOf(response).error.code, 'game_ended')
  })

  test('no turn is played in a closed game', async ({ client, assert }) => {
    const { player, character, scenarioId } = await arrange()
    const game = bodyOf(await start(client, player, character.id, scenarioId)).data
    await abandon(client, player, game.id)

    const response = await client
      .post(`/api/v1/sessions/${game.id}/turns`)
      .json({ playerInput: 'I knock on the door.' })
      .header('Idempotency-Key', crypto.randomUUID())
      .loginAs(player)
      .withCsrfToken()

    response.assertStatus(409)
    assert.equal(bodyOf(response).error.code, 'game_ended')
  })
})

test.group('A character’s games | deleting', (group) => {
  useTransaction(group)

  test('only a failed game is deleted', async ({ client, assert }) => {
    const { player, character, scenarioId } = await arrange()
    const game = bodyOf(await start(client, player, character.id, scenarioId)).data

    const ongoing = await client
      .delete(`/api/v1/sessions/${game.id}`)
      .loginAs(player)
      .withCsrfToken()
    await abandon(client, player, game.id)
    const failed = await client
      .delete(`/api/v1/sessions/${game.id}`)
      .loginAs(player)
      .withCsrfToken()

    ongoing.assertStatus(409)
    assert.equal(bodyOf(ongoing).error.code, 'game_not_failed')
    failed.assertStatus(204)
    assert.equal(await statusOf(client.get(`/api/v1/sessions/${game.id}`).loginAs(player)), 404)
  })

  test('a character in a game cannot be deleted', async ({ client, assert }) => {
    const { player, character, scenarioId } = await arrange()
    await start(client, player, character.id, scenarioId)

    const response = await client
      .delete(`/api/v1/characters/${character.id}`)
      .loginAs(player)
      .withCsrfToken()

    response.assertStatus(409)
    assert.equal(bodyOf(response).error.code, 'character_engaged')
  })

  test('a deleted character goes from the list, with their games', async ({ client, assert }) => {
    const { player, character, scenarioId } = await arrange()
    const game = bodyOf(await start(client, player, character.id, scenarioId)).data
    await abandon(client, player, game.id)

    const response = await client
      .delete(`/api/v1/characters/${character.id}`)
      .loginAs(player)
      .withCsrfToken()

    response.assertStatus(204)
    const list = await client.get('/api/v1/characters').loginAs(player)
    assert.deepEqual(bodyOf(list).data, [])
    assert.equal(
      await statusOf(client.get(`/api/v1/characters/${character.id}`).loginAs(player)),
      404
    )
    assert.equal(await statusOf(client.get(`/api/v1/sessions/${game.id}`).loginAs(player)), 404)
    /** Soft: they stay in the base. */
    const deleted = await Character.findOrFail(character.id)
    assert.isNotNull(deleted.deletedAt)
  })
})

test.group('A character’s games | the player’s characters', (group) => {
  useTransaction(group)

  test('those in a game first, then by their last activity', async ({ client, assert }) => {
    const { player, character: engaged, worldId, scenarioId } = await arrange()
    const older = await characterOf(player, worldId, 'Athos')
    const newer = await characterOf(player, worldId, 'Porthos')
    await db
      .from('characters')
      .where('id', older.id)
      .update({ created_at: new Date(2026, 0, 1) })
    await db
      .from('characters')
      .where('id', engaged.id)
      .update({ created_at: new Date(2025, 0, 1) })
    await start(client, player, engaged.id, scenarioId)

    const response = await client.get('/api/v1/characters').loginAs(player)

    response.assertStatus(200)
    const cards = bodyOf(response).data
    assert.deepEqual(
      cards.map(({ id }: { id: string }) => id),
      [engaged.id, newer.id, older.id]
    )
    assert.deepEqual(cards[0].profession, { reference: 'musketeer', label: 'Musketeer' })
    assert.deepEqual(cards[0].game.scenario, { id: scenarioId, title: 'The Stolen Seal' })
    assert.equal(cards[0].game.hitPoints, 26)
    assert.isNull(cards[1].game)
  })

  test('a character’s page: their sheet, their game, what they may play', async ({
    client,
    assert,
  }) => {
    const { player, character, worldId, scenarioId } = await arrange()
    const failed = bodyOf(await start(client, player, character.id, scenarioId)).data
    await abandon(client, player, failed.id)

    const response = await client.get(`/api/v1/characters/${character.id}`).loginAs(player)

    response.assertStatus(200)
    const page = bodyOf(response).data
    assert.equal(page.name, "d'Artagnan")
    assert.isFalse(page.engaged)
    assert.isNull(page.game)
    assert.deepEqual(
      page.characteristics.map(({ reference }: { reference: string }) => reference),
      ['STR', 'CON', 'SIZ', 'INT', 'POW', 'DEX', 'CHA']
    )
    assert.deepInclude(page.scenarios, {
      id: scenarioId,
      title: 'The Stolen Seal',
      synopsis: page.scenarios.find(({ id }: { id: string }) => id === scenarioId).synopsis,
      status: 'published',
      failed: true,
    })
    assert.deepEqual(
      page.pastGames.map(({ id, status }: { id: string; status: string }) => [id, status]),
      [[failed.id, 'failed']]
    )
    /** Only the scenarios of their own world. */
    const mythos = await db.from('scenarios').where('reference', 'the_ward_inheritance').first()
    assert.notInclude(
      page.scenarios.map(({ id }: { id: string }) => id),
      mythos?.id
    )
    assert.isString(worldId)
  })

  test('a game master sees the drafts of the world among what a character may play', async ({
    client,
    assert,
  }) => {
    const { worldId } = await seedMusketeers()
    const draft = await createScenario(worldId, { status: 'draft' })
    const master = await userWith('game_master')
    const player = await userWith()
    const theirs = await characterOf(master, worldId)
    const mine = await characterOf(player, worldId)

    const asMaster = await client.get(`/api/v1/characters/${theirs.id}`).loginAs(master)
    const asPlayer = await client.get(`/api/v1/characters/${mine.id}`).loginAs(player)

    assert.include(
      bodyOf(asMaster).data.scenarios.map(({ id }: { id: string }) => id),
      draft
    )
    assert.notInclude(
      bodyOf(asPlayer).data.scenarios.map(({ id }: { id: string }) => id),
      draft
    )
  })

  test('a player neither sees nor touches someone else’s characters', async ({
    client,
    assert,
  }) => {
    const { character } = await arrange()
    const other = await userWith()

    const list = await client.get('/api/v1/characters').loginAs(other)
    const page = await client.get(`/api/v1/characters/${character.id}`).loginAs(other)
    const deletion = await client
      .delete(`/api/v1/characters/${character.id}`)
      .loginAs(other)
      .withCsrfToken()

    assert.deepEqual(bodyOf(list).data, [])
    page.assertStatus(404)
    deletion.assertStatus(404)
  })
})
