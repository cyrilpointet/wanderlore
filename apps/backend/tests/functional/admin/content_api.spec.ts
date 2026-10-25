import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'

import User from '#models/user'
import { seedMusketeers } from '#tests/helpers/content'
import {
  createCharacter,
  createNpcInstance,
  createSession,
  createTurn,
  createUser,
  createWorld,
  useTransaction,
} from '#tests/helpers/database'

const ADMIN = '/api/v1/admin'

/** The body of a response, read untyped: the typed client cannot tell these routes apart. */
function bodyOf(response: { body(): unknown }): any {
  return response.body()
}

async function gameMaster(): Promise<User> {
  return User.findOrFail(await createUser({ role: 'game_master' }))
}

/** Requests as a game master, CSRF token included on mutations. */
function as(client: ApiClient, user: User) {
  return {
    get: (path: string) => client.get(`${ADMIN}${path}`).loginAs(user),
    post: (path: string, body: object) =>
      client.post(`${ADMIN}${path}`).json(body).loginAs(user).withCsrfToken(),
    patch: (path: string, body: object) =>
      client.patch(`${ADMIN}${path}`).json(body).loginAs(user).withCsrfToken(),
    delete: (path: string) => client.delete(`${ADMIN}${path}`).loginAs(user).withCsrfToken(),
  }
}

const NEW_WORLD = {
  reference: 'baker_street',
  labels: { en: 'Baker Street', fr: 'Baker Street' },
  narrativeTone: 'London, 1890: fog, gaslight and deduction.',
  rules: ['There is no magic.'],
  ambiance: ['Fog rolls along the Thames.'],
  skills: [
    {
      reference: 'deduction',
      labels: { en: 'Deduction' },
      category: 'mental',
      baseChance: { characteristic: 'INT', multiplier: 2 },
    },
  ],
  resources: [{ reference: 'shillings', labels: { en: 'Shillings' } }],
  glossary: [{ reference: 'scotland_yard', labels: { en: 'Scotland Yard' } }],
}

const GUARD = {
  reference: 'constable',
  labels: { en: 'Constable' },
  description: 'A London policeman on his beat.',
  kind: 'archetype',
  generic: false,
  defaultDisposition: 'neutral',
  combat: { skills: { deduction: 30 }, hitPointsMax: 9, weapon: null },
}

/** A game in the seeded world whose character has a score in `persuasion`. */
async function gameInMusketeers() {
  const content = await seedMusketeers()
  const sessionId = await createSession(await createUser(), content)
  const characterId = await createCharacter(sessionId)
  await db
    .from('characters')
    .where('id', characterId)
    .update({ skills: JSON.stringify({ persuasion: 45 }) })

  return { ...content, sessionId }
}

test.group('Content API | worlds', (group) => {
  useTransaction(group)

  test('creates a world, owned by its author', async ({ client, assert }) => {
    const author = await gameMaster()

    const response = await as(client, author).post('/worlds', NEW_WORLD)

    response.assertStatus(201)
    const world = bodyOf(response).data
    assert.equal(world.reference, 'baker_street')
    assert.deepEqual(world.skills, NEW_WORLD.skills)
    const row = await db.from('worlds').where('id', world.id).firstOrFail()
    assert.equal(row.created_by, author.id)
  })

  test('refuses a reference already taken', async ({ client, assert }) => {
    const user = await gameMaster()
    await as(client, user).post('/worlds', NEW_WORLD)

    const response = await as(client, user).post('/worlds', NEW_WORLD)

    response.assertStatus(409)
    assert.equal(bodyOf(response).error.code, 'reference_taken')
  })

  test('refuses an invalid payload, naming the field at fault', async ({ client, assert }) => {
    const user = await gameMaster()

    const noEnglish = await as(client, user).post('/worlds', {
      ...NEW_WORLD,
      labels: { fr: 'Baker Street' },
    })
    const badReference = await as(client, user).post('/worlds', {
      ...NEW_WORLD,
      reference: 'Baker Street',
    })
    const twice = await as(client, user).post('/worlds', {
      ...NEW_WORLD,
      skills: [...NEW_WORLD.skills, ...NEW_WORLD.skills],
    })
    const uncategorised = await as(client, user).post('/worlds', {
      ...NEW_WORLD,
      skills: [{ ...NEW_WORLD.skills[0], category: 'magic', baseChance: 150 }],
    })

    for (const [response, field] of [
      [noEnglish, 'labels.en'],
      [badReference, 'reference'],
      [twice, 'skills'],
      [uncategorised, 'skills.0.category'],
      [uncategorised, 'skills.0.baseChance'],
    ] as const) {
      response.assertStatus(422)
      assert.include(
        bodyOf(response).errors.map((error: { field: string }) => error.field),
        field
      )
    }
  })

  test('edits a world, never its reference', async ({ client, assert }) => {
    const user = await gameMaster()
    const { data: world } = bodyOf(await as(client, user).post('/worlds', NEW_WORLD))

    const edited = await as(client, user).patch(`/worlds/${world.id}`, {
      reference: 'baker_street',
      narrativeTone: 'London, 1895.',
    })
    const renamed = await as(client, user).patch(`/worlds/${world.id}`, {
      reference: 'whitechapel',
    })

    edited.assertStatus(200)
    assert.equal(bodyOf(edited).data.narrativeTone, 'London, 1895.')
    renamed.assertStatus(422)
    assert.equal(bodyOf(renamed).error.code, 'reference_immutable')
  })

  test('keeps a skill a character of a game still has', async ({ client, assert }) => {
    const { worldId } = await gameInMusketeers()
    const user = await gameMaster()
    const { data: world } = bodyOf(await as(client, user).get(`/worlds/${worldId}`))
    const without = (reference: string) =>
      world.skills.filter((skill: { reference: string }) => skill.reference !== reference)

    const refused = await as(client, user).patch(`/worlds/${worldId}`, {
      skills: without('persuasion'),
    })
    const accepted = await as(client, user).patch(`/worlds/${worldId}`, {
      skills: without('scholarship'),
    })

    refused.assertStatus(409)
    assert.equal(bodyOf(refused).error.code, 'content_in_use')
    assert.deepEqual(bodyOf(refused).error.details, { kind: 'skill', references: ['persuasion'] })
    accepted.assertStatus(200)
  })

  test('deletes a world no game was played in, and only that', async ({ client }) => {
    const { worldId } = await gameInMusketeers()
    const user = await gameMaster()
    const { data: unplayed } = bodyOf(await as(client, user).post('/worlds', NEW_WORLD))

    const response1 = await as(client, user).delete(`/worlds/${worldId}`)

    response1.assertStatus(409)
    const response2 = await as(client, user).delete(`/worlds/${unplayed.id}`)
    response2.assertStatus(204)
  })
})

test.group('Content API | categories of action', (group) => {
  useTransaction(group)

  test('creates, edits and deletes a category', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const created = await as(client, user).post(`/worlds/${worldId}/action-types`, {
      actionType: 'deducing',
      description: 'Working out what happened from clues.',
      associatedSkill: 'deduction',
    })
    created.assertStatus(201)
    const { id } = bodyOf(created).data

    const edited = await as(client, user).patch(`/action-types/${id}`, {
      description: 'Reasoning from clues.',
    })
    assert.equal(bodyOf(edited).data.description, 'Reasoning from clues.')

    const duplicate = await as(client, user).post(`/worlds/${worldId}/action-types`, {
      actionType: 'deducing',
      description: 'Again.',
      associatedSkill: 'deduction',
    })
    duplicate.assertStatus(409)

    const response3 = await as(client, user).delete(`/action-types/${id}`)

    response3.assertStatus(204)
  })

  test('resolves a category by a skill or a characteristic, exactly one', async ({
    client,
    assert,
  }) => {
    const user = await gameMaster()
    const worldId = await createWorld()
    const post = (fields: Record<string, unknown>) =>
      as(client, user).post(`/worlds/${worldId}/action-types`, {
        actionType: 'trusting_luck',
        description: 'Hoping chance favours you.',
        ...fields,
      })

    const neither = await post({})
    const both = await post({ associatedSkill: 'deduction', associatedCharacteristic: 'POW' })
    const characteristic = await post({ associatedCharacteristic: 'POW' })

    for (const refused of [neither, both]) {
      refused.assertStatus(422)
      assert.equal(bodyOf(refused).error.code, 'one_resolution')
    }
    characteristic.assertStatus(201)
    assert.include(bodyOf(characteristic).data, {
      associatedSkill: null,
      associatedCharacteristic: 'POW',
    })

    /** Switching to a skill means letting go of the characteristic. */
    const { id } = bodyOf(characteristic).data
    const kept = await as(client, user).patch(`/action-types/${id}`, {
      associatedSkill: 'deduction',
    })
    const switched = await as(client, user).patch(`/action-types/${id}`, {
      associatedSkill: 'deduction',
      associatedCharacteristic: null,
    })

    kept.assertStatus(422)
    switched.assertStatus(200)
    assert.include(bodyOf(switched).data, {
      associatedSkill: 'deduction',
      associatedCharacteristic: null,
    })
  })

  test('keeps a category a logged roll resolved', async ({ client, assert }) => {
    const { worldId, sessionId } = await gameInMusketeers()
    const user = await gameMaster()
    const turnId = await createTurn(sessionId)
    await db
      .from('turn_log')
      .where('id', turnId)
      .update({
        roll_result: JSON.stringify({ actionType: 'melee_combat', skill: 'swordsmanship' }),
      })
    const rule = await db
      .from('resolution_rules')
      .where({ world_id: worldId, action_type: 'melee_combat' })
      .firstOrFail()

    const response = await as(client, user).delete(`/action-types/${rule.id}`)

    response.assertStatus(409)
    assert.deepEqual(bodyOf(response).error.details.references, ['melee_combat'])
  })
})

test.group('Content API | scenarios', (group) => {
  useTransaction(group)

  test('creates a scenario as a draft, whatever is asked', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/scenarios`, {
      reference: 'the_speckled_band',
      labels: { en: 'The Speckled Band' },
      status: 'published',
    })

    response.assertStatus(201)
    assert.equal(bodyOf(response).data.status, 'draft')
    assert.deepEqual(bodyOf(response).data.chapters, [])
  })

  test('checks the pregenerated character written by hand, field by field', async ({
    client,
    assert,
  }) => {
    const user = await gameMaster()
    const worldId = await createWorld()
    const { data: scenario } = bodyOf(
      await as(client, user).post(`/worlds/${worldId}/scenarios`, {
        reference: 'the_speckled_band',
        labels: { en: 'The Speckled Band' },
      })
    )

    const response = await as(client, user).patch(`/scenarios/${scenario.id}`, {
      pregeneratedCharacter: {
        name: 'Dr Watson',
        characteristics: { STR: 11, CON: 12, SIZ: 13, INT: 14, POW: 12, DEX: 11 },
        skills: { deduction: 250 },
        resources: {},
        items: [],
      },
    })

    response.assertStatus(422)
    const fields = bodyOf(response).errors.map((error: { field: string }) => error.field)
    assert.include(fields, 'pregeneratedCharacter.characteristics.CHA')
    assert.include(fields, 'pregeneratedCharacter.skills.deduction')
  })

  test('keeps a chapter a game stands in', async ({ client, assert }) => {
    const { scenarioId, sessionId } = await gameInMusketeers()
    await db
      .from('sessions')
      .where('id', sessionId)
      .update({ current_chapter: 'the_road_to_paris' })
    const user = await gameMaster()

    const response = await as(client, user).patch(`/scenarios/${scenarioId}`, { chapters: [] })

    response.assertStatus(409)
    assert.deepEqual(bodyOf(response).error.details, {
      kind: 'chapter',
      references: ['the_road_to_paris'],
    })
  })

  test('deletes a scenario no game was started from, and only that', async ({ client }) => {
    const { worldId, scenarioId } = await gameInMusketeers()
    const user = await gameMaster()
    const { data: unplayed } = bodyOf(
      await as(client, user).post(`/worlds/${worldId}/scenarios`, {
        reference: 'another_story',
        labels: { en: 'Another story' },
      })
    )

    const response4 = await as(client, user).delete(`/scenarios/${scenarioId}`)

    response4.assertStatus(409)
    const response5 = await as(client, user).delete(`/scenarios/${unplayed.id}`)
    response5.assertStatus(204)
  })
})

test.group('Content API | catalogues', (group) => {
  useTransaction(group)

  test('creates a definition at world level, and overrides it in a scenario', async ({
    client,
    assert,
  }) => {
    const user = await gameMaster()
    const worldId = await createWorld()
    const { data: scenario } = bodyOf(
      await as(client, user).post(`/worlds/${worldId}/scenarios`, {
        reference: 'the_speckled_band',
        labels: { en: 'The Speckled Band' },
      })
    )

    const world = await as(client, user).post(`/worlds/${worldId}/npcs`, GUARD)
    const override = await as(client, user).post(`/scenarios/${scenario.id}/npcs`, {
      ...GUARD,
      description: 'A constable of the Surrey constabulary.',
    })
    const twice = await as(client, user).post(`/scenarios/${scenario.id}/npcs`, GUARD)

    world.assertStatus(201)
    assert.isNull(bodyOf(world).data.scenarioId)
    override.assertStatus(201)
    assert.equal(bodyOf(override).data.scenarioId, scenario.id)
    twice.assertStatus(409)

    const listed = await as(client, user).get(`/scenarios/${scenario.id}/npcs`)
    assert.lengthOf(bodyOf(listed).data, 1)
  })

  test('checks the modifiers of an item, field by field', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/items`, {
      reference: 'magnifying_glass',
      labels: { en: 'Magnifying glass' },
      description: 'A brass lens.',
      kind: 'archetype',
      generic: false,
      stackable: false,
      equippable: false,
      modifiers: [{ target: 'skill', value: 1, condition: 'owned', description: 'Sharper eyes' }],
      initialHolder: null,
    })

    response.assertStatus(422)
    assert.include(
      bodyOf(response).errors.map((error: { field: string }) => error.field),
      'modifiers.0.skill'
    )
  })

  test('edits a definition, never its reference', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()
    const { data: npc } = bodyOf(await as(client, user).post(`/worlds/${worldId}/npcs`, GUARD))

    const edited = await as(client, user).patch(`/npcs/${npc.id}`, {
      defaultDisposition: 'unfriendly',
    })
    const renamed = await as(client, user).patch(`/npcs/${npc.id}`, { reference: 'bobby' })

    assert.equal(bodyOf(edited).data.defaultDisposition, 'unfriendly')
    renamed.assertStatus(422)
  })

  test('keeps a definition a game made someone of', async ({ client, assert }) => {
    const { worldId, sessionId } = await gameInMusketeers()
    await createNpcInstance(sessionId, 'athos')
    const user = await gameMaster()
    const athos = await db
      .from('npc_definitions')
      .where({ world_id: worldId, reference: 'athos' })
      .firstOrFail()
    const porthos = await db
      .from('npc_definitions')
      .where({ world_id: worldId, reference: 'porthos' })
      .firstOrFail()

    const refused = await as(client, user).delete(`/npcs/${athos.id}`)
    const accepted = await as(client, user).delete(`/npcs/${porthos.id}`)

    refused.assertStatus(409)
    assert.deepEqual(bodyOf(refused).error.details, { kind: 'npc', references: ['athos'] })
    accepted.assertStatus(204)
  })

  test('only knows the three catalogues', async ({ client }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response6 = await as(client, user).get(`/worlds/${worldId}/factions`)

    response6.assertStatus(404)
  })
})

test.group('Content API | access', (group) => {
  useTransaction(group)

  test('refuses every write to a player', async ({ client }) => {
    const player = await User.findOrFail(await createUser())

    const response = await as(client, player).post('/worlds', NEW_WORLD)

    response.assertStatus(403)
  })
})

test.group('Content API | kinds', (group) => {
  useTransaction(group)

  test('refuses what only the other kind of definition may have, on its field', async ({
    client,
    assert,
  }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const genericUnique = await as(client, user).post(`/worlds/${worldId}/npcs`, {
      ...GUARD,
      kind: 'unique',
      generic: true,
    })
    const parentedArchetype = await as(client, user).post(`/worlds/${worldId}/locations`, {
      reference: 'tavern',
      labels: { en: 'Tavern' },
      description: 'A place to drink.',
      kind: 'archetype',
      parent: 'paris',
    })

    for (const [response, field] of [
      [genericUnique, 'generic'],
      [parentedArchetype, 'parent'],
    ] as const) {
      response.assertStatus(422)
      assert.equal(bodyOf(response).error.code, 'kind_mismatch')
      assert.equal(bodyOf(response).error.details.field, field)
    }
  })

  test('checks the definition as edited, not only what is sent', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()
    const created = await as(client, user).post(`/worlds/${worldId}/npcs`, {
      ...GUARD,
      generic: true,
    })

    const response = await as(client, user).patch(`/npcs/${bodyOf(created).data.id}`, {
      kind: 'unique',
    })

    response.assertStatus(422)
    assert.equal(bodyOf(response).error.details.field, 'generic')
  })
})
