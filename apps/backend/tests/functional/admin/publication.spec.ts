import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import User from '#models/user'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'
import { seedMusketeers } from '#tests/helpers/content'
import { createScenario, createUser, useTransaction } from '#tests/helpers/database'

const PUBLISHED = THREE_MUSKETEERS_CONTENT.scenarios[0]

function bodyOf(response: { body(): unknown }): any {
  return response.body()
}

async function userWith(role: 'player' | 'game_master'): Promise<User> {
  return User.findOrFail(await createUser({ role }))
}

test.group('Publication', (group) => {
  useTransaction(group)

  test('refuses an incomplete scenario, listing everything missing at once', async ({
    client,
    assert,
  }) => {
    const { worldId } = await seedMusketeers()
    const draft = await createScenario(worldId, { status: 'draft' })

    const response = await client
      .post(`/api/v1/admin/scenarios/${draft}/publish`)
      .loginAs(await userWith('game_master'))
      .withCsrfToken()

    response.assertStatus(422)
    assert.equal(bodyOf(response).error.code, 'scenario_incoherent')
    assert.deepEqual(
      bodyOf(response).error.details.issues.map(({ code }: { code: string }) => code),
      ['missing_character', 'missing_initial_state']
    )
    const row = await db.from('scenarios').where('id', draft).firstOrFail()
    assert.equal(row.status, 'draft')
  })

  test('publishes a scenario that holds together, and offers it to players', async ({
    client,
    assert,
  }) => {
    const { worldId } = await seedMusketeers()
    const draft = await createScenario(worldId, { status: 'draft' })
    await db
      .from('scenarios')
      .where('id', draft)
      .update({
        chapters: JSON.stringify(PUBLISHED.chapters),
        quests: JSON.stringify(PUBLISHED.quests),
        pregenerated_character: JSON.stringify(PUBLISHED.pregeneratedCharacter),
        initial_state: JSON.stringify(PUBLISHED.initialState),
      })

    const response = await client
      .post(`/api/v1/admin/scenarios/${draft}/publish`)
      .loginAs(await userWith('game_master'))
      .withCsrfToken()

    response.assertStatus(200)
    assert.equal(bodyOf(response).data.status, 'published')

    const catalogue = await client.get('/api/v1/scenarios').loginAs(await userWith('player'))
    assert.include(
      bodyOf(catalogue).data.map(({ id }: { id: string }) => id),
      draft
    )
  })

  test('back to a draft, a scenario leaves the catalogue', async ({ client, assert }) => {
    const { scenarioId } = await seedMusketeers()

    const response = await client
      .post(`/api/v1/admin/scenarios/${scenarioId}/unpublish`)
      .loginAs(await userWith('game_master'))
      .withCsrfToken()

    response.assertStatus(200)
    const catalogue = await client.get('/api/v1/scenarios').loginAs(await userWith('player'))
    assert.deepEqual(bodyOf(catalogue).data, [])
  })

  test('a published scenario broken since is not played from', async ({ client, assert }) => {
    const { scenarioId } = await seedMusketeers()
    await db
      .from('scenarios')
      .where('id', scenarioId)
      .update({ initial_state: JSON.stringify({ ...PUBLISHED.initialState, location: 'navarre' }) })

    const response = await client
      .post('/api/v1/sessions')
      .json({ scenarioId })
      .loginAs(await userWith('player'))
      .withCsrfToken()

    response.assertStatus(422)
    assert.equal(bodyOf(response).error.code, 'scenario_not_playable')
    assert.deepEqual(bodyOf(response).error.details.issues, [
      { code: 'unknown_location', location: 'initialState.location', reference: 'navarre' },
    ])
  })

  test('is for game masters only', async ({ client }) => {
    const { scenarioId } = await seedMusketeers()

    const response = await client
      .post(`/api/v1/admin/scenarios/${scenarioId}/publish`)
      .loginAs(await userWith('player'))
      .withCsrfToken()

    response.assertStatus(403)
  })
})
