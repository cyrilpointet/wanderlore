import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'

import User from '#models/user'
import { seedMusketeers } from '#tests/helpers/content'
import {
  characterOf,
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
  combat: {
    skills: { deduction: 30 },
    hitPointsMax: 9,
    weapon: null,
    damageModifier: null,
    armor: 0,
  },
  initialLocation: null,
  schedule: [],
}

/** A game in the seeded world whose character has a score in `persuasion`. */
async function gameInMusketeers() {
  const content = await seedMusketeers()
  const sessionId = await createSession(await createUser(), content)
  const characterId = await characterOf(sessionId)
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

  test('checks the starting kit written by hand, field by field', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()
    const { data: scenario } = bodyOf(
      await as(client, user).post(`/worlds/${worldId}/scenarios`, {
        reference: 'the_speckled_band',
        labels: { en: 'The Speckled Band' },
      })
    )

    const response = await as(client, user).patch(`/scenarios/${scenario.id}`, {
      startingKit: {
        items: [{ definition: 'Revolver', descriptor: null, quantity: 0, equipped: false }],
        resources: { money: 'plenty' },
      },
    })

    response.assertStatus(422)
    const fields = bodyOf(response).errors.map((error: { field: string }) => error.field)
    assert.include(fields, 'startingKit.items.0.definition')
    assert.include(fields, 'startingKit.items.0.quantity')
    assert.include(fields, 'startingKit.resources.money')
  })

  test('keeps a chapter a game stands in', async ({ client, assert }) => {
    const { scenarioId, sessionId } = await gameInMusketeers()
    await db.from('sessions').where('id', sessionId).update({ current_chapter: 'the_guards_house' })
    const user = await gameMaster()

    const response = await as(client, user).patch(`/scenarios/${scenarioId}`, { chapters: [] })

    response.assertStatus(409)
    assert.deepEqual(bodyOf(response).error.details, {
      kind: 'chapter',
      references: ['the_guards_house'],
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

  test('only knows its catalogues', async ({ client }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response6 = await as(client, user).get(`/worlds/${worldId}/factions`)

    response6.assertStatus(404)
  })
})

/** A fact about a place of the world, for the arbiter and the narrator alike. */
const RUMOUR = {
  reference: 'fog_of_whitechapel',
  kind: 'fact',
  content: 'Nobody in Whitechapel talks to a constable after dark.',
  tags: ['whitechapel'],
  secret: false,
}

const WHITECHAPEL = {
  reference: 'whitechapel',
  labels: { en: 'Whitechapel' },
  description: 'A crowded East End parish of lodging houses and pubs.',
  kind: 'unique',
  parent: null,
}

test.group('Content API | lore', (group) => {
  useTransaction(group)

  test('creates, edits and deletes a fragment', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()
    await as(client, user).post(`/worlds/${worldId}/locations`, WHITECHAPEL)

    const created = await as(client, user).post(`/worlds/${worldId}/lore`, RUMOUR)
    created.assertStatus(201)
    const fragment = bodyOf(created).data
    assert.containsSubset(fragment, { ...RUMOUR, scenarioId: null })
    assert.notProperty(fragment, 'labels')

    const edited = await as(client, user).patch(`/lore/${fragment.id}`, { secret: true })
    assert.isTrue(bodyOf(edited).data.secret)

    const listed = await as(client, user).get(`/worlds/${worldId}/lore`)
    assert.lengthOf(bodyOf(listed).data, 1)

    /** No game names a fragment: deleting one never breaks a game. */
    const deleted = await as(client, user).delete(`/lore/${fragment.id}`)
    deleted.assertStatus(204)
  })

  test('takes a fragment sent with every turn from its kind and content alone', async ({
    client,
    assert,
  }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/lore`, {
      reference: 'gaslight',
      kind: 'ambiance',
      content: 'Gas lamps hiss in the fog.',
    })

    response.assertStatus(201)
    assert.containsSubset(bodyOf(response).data, { tags: [], secret: false })
  })

  test('refuses a tag that names nothing of the world', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/lore`, RUMOUR)

    response.assertStatus(422)
    assert.deepEqual(bodyOf(response).error, {
      code: 'unknown_tag',
      message: '"whitechapel" is no place, person or item of this world.',
      details: { field: 'tags', references: ['whitechapel'] },
    })
  })

  test('lets a scenario fragment be tagged with what the scenario defines', async ({ client }) => {
    const user = await gameMaster()
    const worldId = await createWorld()
    const { data: scenario } = bodyOf(
      await as(client, user).post(`/worlds/${worldId}/scenarios`, {
        reference: 'the_speckled_band',
        labels: { en: 'The Speckled Band' },
      })
    )
    await as(client, user).post(`/scenarios/${scenario.id}/locations`, WHITECHAPEL)

    const atWorldLevel = await as(client, user).post(`/worlds/${worldId}/lore`, RUMOUR)
    const inScenario = await as(client, user).post(`/scenarios/${scenario.id}/lore`, RUMOUR)

    atWorldLevel.assertStatus(422)
    inScenario.assertStatus(201)
  })

  test('refuses a secret ambiance, created or edited', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()
    const ambiance = { reference: 'gaslight', kind: 'ambiance', content: 'Gas lamps hiss.' }

    const created = await as(client, user).post(`/worlds/${worldId}/lore`, {
      ...ambiance,
      secret: true,
    })
    const { data: fragment } = bodyOf(
      await as(client, user).post(`/worlds/${worldId}/lore`, ambiance)
    )
    const edited = await as(client, user).patch(`/lore/${fragment.id}`, { secret: true })

    created.assertStatus(422)
    assert.equal(bodyOf(created).error.code, 'secret_ambiance')
    edited.assertStatus(422)
  })

  test('refuses a fragment to a player', async ({ client }) => {
    const player = await User.findOrFail(await createUser())
    const worldId = await createWorld()

    const response = await as(client, player).post(`/worlds/${worldId}/lore`, {
      reference: 'gaslight',
      kind: 'ambiance',
      content: 'Gas lamps hiss.',
    })

    response.assertStatus(403)
  })
})

test.group('Content API | imports', (group) => {
  useTransaction(group)

  const SCENARIO = {
    reference: 'the_ripper',
    labels: { en: 'The Ripper' },
    locations: [WHITECHAPEL],
    npcs: [GUARD],
    lore: [RUMOUR, { ...RUMOUR, reference: 'beat', tags: ['constable'], kind: 'rule' }],
  }

  test('creates a scenario with its catalogues and its lore, in one go', async ({
    client,
    assert,
  }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/scenarios`, SCENARIO)

    response.assertStatus(201)
    const scenarioId = bodyOf(response).data.id
    const places = bodyOf(await as(client, user).get(`/scenarios/${scenarioId}/locations`)).data
    const lore = bodyOf(await as(client, user).get(`/scenarios/${scenarioId}/lore`)).data
    assert.deepEqual(
      places.map(({ reference }: { reference: string }) => reference),
      ['whitechapel']
    )
    /** What a file leaves out is filled in as a form would. */
    assert.deepEqual(places[0].exits, [])
    assert.deepEqual(
      lore.map(({ reference }: { reference: string }) => reference),
      ['beat', 'fog_of_whitechapel']
    )
  })

  test('creates a world ready to play but for its scenarios, in one go', async ({
    client,
    assert,
  }) => {
    const user = await gameMaster()

    const response = await as(client, user).post('/worlds', {
      ...NEW_WORLD,
      locations: [WHITECHAPEL],
      lore: [RUMOUR],
      actionTypes: [
        {
          actionType: 'investigation',
          description: 'Reading clues and drawing conclusions.',
          associatedSkill: 'deduction',
        },
        {
          actionType: 'feat_of_strength',
          description: 'Forcing, lifting, breaking.',
          associatedCharacteristic: 'STR',
        },
      ],
    })

    response.assertStatus(201)
    const worldId = bodyOf(response).data.id
    const lore = bodyOf(await as(client, user).get(`/worlds/${worldId}/lore`)).data
    const actionTypes = bodyOf(await as(client, user).get(`/worlds/${worldId}/action-types`)).data
    assert.lengthOf(lore, 1)
    assert.sameMembers(
      actionTypes.map(({ actionType }: { actionType: string }) => actionType),
      ['investigation', 'feat_of_strength']
    )
  })

  test('refuses a category of action resolved by neither or both, on its entry', async ({
    client,
    assert,
  }) => {
    const user = await gameMaster()

    const response = await as(client, user).post('/worlds', {
      ...NEW_WORLD,
      actionTypes: [
        { actionType: 'investigation', description: 'Clues.', associatedSkill: 'deduction' },
        { actionType: 'anything', description: 'Whatever.' },
      ],
    })

    response.assertStatus(422)
    assert.deepEqual(bodyOf(response).error.details, { field: 'actionTypes.1' })
    assert.isNull(await db.from('worlds').where('reference', NEW_WORLD.reference).first())
  })

  test('writes nothing when one entry is at fault', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/scenarios`, {
      ...SCENARIO,
      lore: [...SCENARIO.lore, { ...RUMOUR, reference: 'nowhere', tags: ['limehouse'] }],
    })

    response.assertStatus(422)
    assert.deepEqual(bodyOf(response).error.details, {
      field: 'lore.2.tags',
      references: ['limehouse'],
    })
    assert.isNull(await db.from('scenarios').where('world_id', worldId).first())
    assert.isNull(await db.from('location_definitions').where('world_id', worldId).first())
  })

  test('refuses what only the other kind may have, on its entry', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/scenarios`, {
      ...SCENARIO,
      npcs: [GUARD, { ...GUARD, reference: 'inspector', kind: 'unique', generic: true }],
    })

    response.assertStatus(422)
    assert.deepEqual(bodyOf(response).error.details, { field: 'npcs.1.generic' })
  })

  test('names the faulty field of an imported entry', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/scenarios`, {
      ...SCENARIO,
      lore: [{ ...RUMOUR, kind: 'gossip' }],
    })

    response.assertStatus(422)
    assert.include(
      bodyOf(response).errors.map((error: { field: string }) => error.field),
      'lore.0.kind'
    )
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

    const placedArchetype = await as(client, user).post(`/worlds/${worldId}/npcs`, {
      ...GUARD,
      reference: 'watchman',
      initialLocation: 'paris',
      schedule: [],
    })

    for (const [response, field] of [
      [genericUnique, 'generic'],
      [parentedArchetype, 'parent'],
      [placedArchetype, 'initialLocation'],
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

test.group('Content API | time and places', (group) => {
  useTransaction(group)

  async function scenarioOf(client: ApiClient, user: User) {
    const worldId = await createWorld()
    const { data } = bodyOf(
      await as(client, user).post(`/worlds/${worldId}/scenarios`, {
        reference: 'the_speckled_band',
        labels: { en: 'The Speckled Band' },
      })
    )

    return { worldId, scenario: data }
  }

  test('a scenario opens at 08:00 on no date, until told otherwise', async ({ client, assert }) => {
    const user = await gameMaster()
    const { scenario } = await scenarioOf(client, user)

    assert.equal(scenario.startTime, '08:00')
    assert.isNull(scenario.startDate)

    const response = await as(client, user).patch(`/scenarios/${scenario.id}`, {
      startTime: '21:30',
      startDate: '1888-04-02',
    })

    response.assertStatus(200)
    assert.equal(bodyOf(response).data.startTime, '21:30')
    assert.equal(bodyOf(response).data.startDate, '1888-04-02')
  })

  test('refuses a time that is no time of day and a date off the calendar', async ({
    client,
    assert,
  }) => {
    const user = await gameMaster()
    const { scenario } = await scenarioOf(client, user)

    const response = await as(client, user).patch(`/scenarios/${scenario.id}`, {
      startTime: '25:00',
      startDate: '1888-02-30',
    })

    response.assertStatus(422)
    assert.sameMembers(
      bodyOf(response).errors.map((error: { field: string }) => error.field),
      ['startTime', 'startDate']
    )
  })

  test('a named place with its exits and as an entrance', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/locations`, {
      reference: 'baker_street_hall',
      labels: { en: 'The hall' },
      description: 'The hall of 221B.',
      kind: 'unique',
      parent: null,
      entrance: true,
      periodNotes: [],
      exits: [
        {
          to: 'baker_street_sitting_room',
          passage: 'seventeen steps up',
          backPassage: 'the stairs down',
          hidden: false,
          requires: null,
          oneWay: false,
          duration: 'moment',
        },
      ],
    })

    response.assertStatus(201)
    assert.isTrue(bodyOf(response).data.entrance)
    assert.equal(bodyOf(response).data.exits[0].passage, 'seventeen steps up')
  })

  test('checks the exits written by hand, field by field', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/locations`, {
      reference: 'baker_street_hall',
      labels: { en: 'The hall' },
      description: 'The hall of 221B.',
      kind: 'unique',
      parent: null,
      exits: [{ to: 'Sitting Room', passage: '', hidden: 'no', oneWay: false, duration: 'days' }],
    })

    response.assertStatus(422)
    assert.includeMembers(
      bodyOf(response).errors.map((error: { field: string }) => error.field),
      ['exits.0.to', 'exits.0.passage', 'exits.0.hidden', 'exits.0.duration']
    )
  })

  test('an archetype has no exit and is no entrance', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()
    const archetype = {
      reference: 'tavern',
      labels: { en: 'Tavern' },
      description: 'A place to drink.',
      kind: 'archetype',
      parent: null,
    }

    const entrance = await as(client, user).post(`/worlds/${worldId}/locations`, {
      ...archetype,
      entrance: true,
      periodNotes: [],
    })

    entrance.assertStatus(422)
    assert.equal(bodyOf(entrance).error.code, 'kind_mismatch')
    assert.equal(bodyOf(entrance).error.details.field, 'entrance')
  })
})

test.group('Content API | deadlines and events', (group) => {
  useTransaction(group)

  const WATSON_ARRIVES = {
    reference: 'watson_arrives',
    when: { at: { day: 1, period: 'evening', time: null }, conditions: [], delay: null },
    unless: [{ type: 'flag', flag: 'telegram_lost' }],
    place: null,
    description: 'Watson comes back from his rounds.',
    effects: [{ type: 'flag_set', flag: 'watson_home' }],
    interrupts: false,
    foreseeable: [],
  }

  async function scenarioOf(client: ApiClient, user: User) {
    const worldId = await createWorld()
    const { data: scenario } = bodyOf(
      await as(client, user).post(`/worlds/${worldId}/scenarios`, {
        reference: 'the_speckled_band',
        labels: { en: 'The Speckled Band' },
      })
    )

    return { worldId, scenario }
  }

  test('a scenario keeps its flags and its events', async ({ client, assert }) => {
    const user = await gameMaster()
    const { scenario } = await scenarioOf(client, user)
    const flags = [
      { reference: 'telegram_lost', description: 'The telegram never reached Baker Street.' },
      { reference: 'watson_home', description: 'Watson is back at Baker Street.' },
    ]

    const response = await as(client, user).patch(`/scenarios/${scenario.id}`, {
      flags,
      events: [WATSON_ARRIVES],
    })

    response.assertStatus(200)
    assert.deepEqual(bodyOf(response).data.flags, flags)
    assert.deepEqual(bodyOf(response).data.events, [WATSON_ARRIVES])
  })

  test('a scenario imported whole brings its flags, events and schedules', async ({
    client,
    assert,
  }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/scenarios`, {
      reference: 'the_speckled_band',
      labels: { en: 'The Speckled Band' },
      flags: [{ reference: 'watson_home', description: 'Watson is back at Baker Street.' }],
      events: [{ ...WATSON_ARRIVES, unless: [] }],
      npcs: [
        {
          ...GUARD,
          reference: 'mrs_hudson',
          kind: 'unique',
          schedule: [
            {
              periods: ['morning'],
              location: 'kitchen',
              activity: 'makes the breakfast',
              leavesScene: false,
              interrupts: false,
            },
          ],
        },
      ],
    })

    response.assertStatus(201)
    const scenario = bodyOf(response).data
    assert.lengthOf(scenario.events, 1)
    const npcs = bodyOf(await as(client, user).get(`/scenarios/${scenario.id}/npcs`)).data
    assert.equal(npcs[0].schedule[0].activity, 'makes the breakfast')
  })

  test('checks an event written by hand, field by field', async ({ client, assert }) => {
    const user = await gameMaster()
    const { scenario } = await scenarioOf(client, user)

    const response = await as(client, user).patch(`/scenarios/${scenario.id}`, {
      events: [
        {
          ...WATSON_ARRIVES,
          when: { at: { day: 0, period: 'teatime', time: null }, conditions: [], delay: null },
          effects: [{ type: 'summon_lestrade' }],
        },
      ],
    })

    response.assertStatus(422)
    const fields = bodyOf(response).errors.map((error: { field: string }) => error.field)
    assert.include(fields, 'events.0.when.at.day')
    assert.include(fields, 'events.0.when.at.period')
    assert.include(fields, 'events.0.effects.0')
  })

  test('a schedule is for a named person only', async ({ client, assert }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/npcs`, {
      ...GUARD,
      schedule: [
        {
          periods: ['night'],
          location: 'baker_street',
          activity: null,
          leavesScene: false,
          interrupts: false,
        },
      ],
    })

    response.assertStatus(422)
    assert.equal(bodyOf(response).error.code, 'kind_mismatch')
    assert.equal(bodyOf(response).error.details.field, 'schedule')
  })

  test('a place keeps its notes for the time of day, an exit when it is shut', async ({
    client,
    assert,
  }) => {
    const user = await gameMaster()
    const worldId = await createWorld()

    const response = await as(client, user).post(`/worlds/${worldId}/locations`, {
      reference: 'cave_mouth',
      labels: { en: 'The cave mouth' },
      description: 'A dark mouth in the cliff.',
      kind: 'unique',
      parent: null,
      exits: [
        {
          to: 'beach',
          passage: 'a shingle slope',
          backPassage: null,
          hidden: false,
          requires: null,
          oneWay: false,
          duration: null,
          blockedDuring: ['dawn', 'morning'],
          blockedReason: 'the tide fills the slope',
        },
      ],
      entrance: false,
      periodNotes: [{ periods: ['night'], note: 'The wind howls in the cave at night.' }],
    })

    response.assertStatus(201)
    assert.deepEqual(bodyOf(response).data.periodNotes, [
      { periods: ['night'], note: 'The wind howls in the cave at night.' },
    ])
    assert.deepEqual(bodyOf(response).data.exits[0].blockedDuring, ['dawn', 'morning'])
  })
})
