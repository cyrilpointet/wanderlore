import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import User from '#models/user'
import InventoryItem from '#models/inventory_item'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'
import { seedMusketeers } from '#tests/helpers/content'
import { createScenario, createUser, useTransaction } from '#tests/helpers/database'

const PREGENERATED = THREE_MUSKETEERS_CONTENT.scenarios[0].pregeneratedCharacter!

/** The typed test client cannot tell these routes apart, so the body is read untyped. */
function dataOf(response: { body(): unknown }): any {
  return (response.body() as { data: unknown }).data
}

async function userWith(role: 'player' | 'game_master' = 'player'): Promise<User> {
  return User.findOrFail(await createUser({ role }))
}

/** A draft of the seeded world, playable or not. */
async function draftOf(worldId: string, playable: boolean): Promise<string> {
  const scenarioId = await createScenario(worldId, { status: 'draft' })

  if (playable) {
    const published = THREE_MUSKETEERS_CONTENT.scenarios[0]

    await db
      .from('scenarios')
      .where('id', scenarioId)
      .update({
        chapters: JSON.stringify(published.chapters),
        quests: JSON.stringify(published.quests),
        pregenerated_character: JSON.stringify(published.pregeneratedCharacter),
        initial_state: JSON.stringify(published.initialState),
      })
  }

  return scenarioId
}

test.group('New game | catalogue', (group) => {
  useTransaction(group)

  test('offers a player the published scenarios, with their world', async ({ client, assert }) => {
    const { worldId, scenarioId } = await seedMusketeers()
    await draftOf(worldId, true)

    const response = await client.get('/api/v1/scenarios').loginAs(await userWith())

    response.assertStatus(200)
    const musketeers = dataOf(response).filter(
      ({ world }: { world: { reference: string } }) => world.reference === 'three_musketeers'
    )
    assert.deepEqual(musketeers, [
      {
        id: scenarioId,
        title: 'A Gascon in Paris',
        synopsis: THREE_MUSKETEERS_CONTENT.scenarios[0].synopsis,
        status: 'published',
        world: {
          reference: 'three_musketeers',
          label: 'The Three Musketeers',
          tone: THREE_MUSKETEERS_CONTENT.narrativeTone,
        },
      },
    ])
  })

  test('shows a game master the drafts too', async ({ client, assert }) => {
    const { worldId } = await seedMusketeers()
    const draft = await draftOf(worldId, false)

    const response = await client.get('/api/v1/scenarios').loginAs(await userWith('game_master'))

    assert.include(
      dataOf(response).map(({ id }: { id: string }) => id),
      draft
    )
  })

  test('is for signed-in users only', async ({ client }) => {
    const response = await client.get('/api/v1/scenarios')

    response.assertStatus(401)
  })
})

test.group('New game | starting', (group) => {
  useTransaction(group)

  test('copies the pregenerated character and the state the story starts in', async ({
    client,
    assert,
  }) => {
    const { scenarioId } = await seedMusketeers()

    const response = await client
      .post('/api/v1/sessions')
      .json({ scenarioId })
      .loginAs(await userWith())
      .withCsrfToken()

    response.assertStatus(201)
    const game = dataOf(response)

    assert.equal(game.status, 'in_progress')
    assert.deepEqual(game.world, { reference: 'three_musketeers', label: 'The Three Musketeers' })
    assert.deepEqual(game.chapter, { reference: 'the_road_to_paris', label: 'The Road to Paris' })
    assert.deepEqual(game.location, { reference: 'meung_sur_loire', label: 'Meung-sur-Loire' })
    assert.deepEqual(
      game.activeQuests.map(({ reference }: { reference: string }) => reference),
      ['deliver_the_letter']
    )
    assert.equal(game.character.name, PREGENERATED.name)
    assert.equal(game.character.hitPoints, PREGENERATED.hitPointsMax)
    assert.equal(game.character.hitPointsMax, PREGENERATED.hitPointsMax)
    assert.isNull(game.pendingTurn)

    const items = await InventoryItem.query()
      .where('sessionId', game.id)
      .orderBy('definitionReference')
    assert.deepEqual(
      items.map(({ definitionReference, state, quantity }) => [
        definitionReference,
        state,
        quantity,
      ]),
      [
        ['letter_to_treville', 'carried', 1],
        ['rapier', 'equipped', 1],
      ]
    )
  })

  test('two games of the same scenario are two separate copies', async ({ client, assert }) => {
    const { scenarioId } = await seedMusketeers()
    const player = await userWith()

    for (let game = 0; game < 2; game++) {
      await client.post('/api/v1/sessions').json({ scenarioId }).loginAs(player).withCsrfToken()
    }

    const games = await db.from('sessions').where('user_id', player.id)
    assert.lengthOf(games, 2)
    assert.lengthOf(
      await db.from('characters').whereIn(
        'session_id',
        games.map(({ id }) => id)
      ),
      2
    )
  })

  test('a player cannot start a draft: it reads as missing', async ({ client }) => {
    const { worldId } = await seedMusketeers()
    const draft = await draftOf(worldId, true)

    const response = await client
      .post('/api/v1/sessions')
      .json({ scenarioId: draft })
      .loginAs(await userWith())
      .withCsrfToken()

    response.assertStatus(404)
  })

  test('a game master can try a draft out', async ({ client }) => {
    const { worldId } = await seedMusketeers()
    const draft = await draftOf(worldId, true)

    const response = await client
      .post('/api/v1/sessions')
      .json({ scenarioId: draft })
      .loginAs(await userWith('game_master'))
      .withCsrfToken()

    response.assertStatus(201)
  })

  test('a draft without its character cannot be played yet', async ({ client, assert }) => {
    const { worldId } = await seedMusketeers()
    const draft = await draftOf(worldId, false)

    const response = await client
      .post('/api/v1/sessions')
      .json({ scenarioId: draft })
      .loginAs(await userWith('game_master'))
      .withCsrfToken()

    response.assertStatus(422)
    assert.equal((response.body() as any).error.code, 'scenario_not_playable')
    assert.equal(
      await db
        .from('sessions')
        .count('* as total')
        .first()
        .then((row) => Number(row.total)),
      0
    )
  })

  test('refuses something that is not a scenario id', async ({ client }) => {
    const response = await client
      .post('/api/v1/sessions')
      .json({ scenarioId: 'paris' })
      .loginAs(await userWith())
      .withCsrfToken()

    response.assertStatus(422)
  })
})
