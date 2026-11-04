import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import User from '#models/user'
import Character from '#models/character'
import CharacterRoll from '#models/character_roll'
import { seedMusketeers } from '#tests/helpers/content'
import { createScenario, createUser, createWorld, useTransaction } from '#tests/helpers/database'

/**
 * Creating a character (roadmap, Phase 12): the series rolled by the
 * backend, rolled again at will, previewed without writing anything, and
 * consumed by the creation.
 */

function bodyOf(response: { body(): unknown }): any {
  return response.body()
}

async function userWith(role: 'player' | 'game_master' = 'player'): Promise<User> {
  return User.findOrFail(await createUser({ role }))
}

/** A series known in advance, rather than the dice's. */
async function seriesOf(user: User, values = [13, 14, 6, 13, 12, 16, 14]) {
  await CharacterRoll.query().where('userId', user.id).delete()

  return CharacterRoll.create({ userId: user.id, values })
}

/** Each result to the characteristic of the same rank: STR the first, CHA the last. */
const IN_ORDER = { STR: 0, CON: 1, SIZ: 2, INT: 3, POW: 4, DEX: 5, CHA: 6 }

function draft(worldId: string, overrides: Record<string, unknown> = {}): any {
  return {
    worldId,
    placement: IN_ORDER,
    profession: 'musketeer',
    professionalPoints: { swordsmanship: 40, athletics: 20 },
    personalPoints: { persuasion: 30 },
    name: "  d'Artagnan  ",
    gender: 'male',
    ...overrides,
  }
}

test.group('Creating a character | the series', (group) => {
  useTransaction(group)

  test('seven times 3D6, rolled again at will: each roll replaces the last', async ({
    client,
    assert,
  }) => {
    const player = await userWith()

    const first = await client.post('/api/v1/character-rolls').loginAs(player).withCsrfToken()
    const second = await client.post('/api/v1/character-rolls').loginAs(player).withCsrfToken()

    first.assertStatus(201)
    const roll = bodyOf(second).data
    assert.lengthOf(roll.values, 7)
    for (const [index, value] of roll.values.entries()) {
      assert.isAtLeast(value, 3)
      assert.isAtMost(value, 18)
      /** Three d6 for each result, adding up to it. */
      assert.lengthOf(roll.dice[index], 3)
      assert.equal(
        roll.dice[index].reduce((total: number, face: number) => total + face, 0),
        value
      )
    }
    const rows = await CharacterRoll.query().where('userId', player.id)
    assert.deepEqual(
      rows.map(({ id }) => id),
      [roll.id]
    )
  })
})

test.group('Creating a character | the worlds', (group) => {
  useTransaction(group)

  test('a player creates characters in the worlds they have a scenario to play in', async ({
    client,
    assert,
  }) => {
    await seedMusketeers()
    const empty = await createWorld()
    const drafted = await createWorld()
    await createScenario(drafted, { status: 'draft' })

    const asPlayer = bodyOf(await client.get('/api/v1/worlds').loginAs(await userWith())).data
    const asMaster = bodyOf(
      await client.get('/api/v1/worlds').loginAs(await userWith('game_master'))
    ).data

    const ids = (worlds: { id: string }[]) => worlds.map(({ id }) => id)
    assert.includeMembers(
      asPlayer.map(({ reference }: { reference: string }) => reference),
      ['three_musketeers', 'lovecraft_mythos']
    )
    assert.notInclude(ids(asPlayer), empty)
    assert.notInclude(ids(asPlayer), drafted)
    assert.include(ids(asMaster), drafted)
  })

  test('what creating a character in a world takes', async ({ client, assert }) => {
    const { worldId } = await seedMusketeers()

    const response = await client
      .get(`/api/v1/worlds/${worldId}/creation`)
      .loginAs(await userWith())

    response.assertStatus(200)
    const creation = bodyOf(response).data
    assert.equal(creation.powerLevel, 'heroic')
    assert.equal(creation.professionalPoints, 325)
    assert.equal(creation.skillCap, 90)
    const musketeer = creation.professions.find(
      ({ reference }: { reference: string }) => reference === 'musketeer'
    )
    assert.equal(musketeer.label, 'Musketeer')
    assert.deepInclude(musketeer.skills, { reference: 'swordsmanship', label: 'Swordsmanship' })
    assert.deepInclude(musketeer.startingItems, {
      item: { reference: 'rapier', label: 'Rapier' },
      quantity: 1,
      equipped: true,
    })
  })

  test('a world without a scenario to play reads as missing', async ({ client }) => {
    const empty = await createWorld()

    const response = await client.get(`/api/v1/worlds/${empty}/creation`).loginAs(await userWith())

    response.assertStatus(404)
  })
})

test.group('Creating a character | preview and creation', (group) => {
  useTransaction(group)

  test('the preview works the sheet out and writes nothing', async ({ client, assert }) => {
    const { worldId } = await seedMusketeers()
    const player = await userWith()
    await seriesOf(player)

    const response = await client
      .post('/api/v1/characters/preview')
      .json(draft(worldId))
      .loginAs(player)
      .withCsrfToken()

    response.assertStatus(200)
    const { sheet, issues } = bodyOf(response).data
    assert.deepEqual(issues, [])
    /** A 6 placed in SIZ is raised to 8. */
    assert.equal(sheet.characteristics.SIZ, 8)
    assert.deepEqual(sheet.raised, ['SIZ'])
    assert.deepEqual(sheet.professionalPool, { total: 325, spent: 60, left: 265 })
    assert.deepEqual(sheet.personalPool, { total: 130, spent: 30, left: 100 })
    assert.equal(sheet.hitPoints, 14 + 8)
    assert.equal(
      await db
        .from('characters')
        .where('user_id', player.id)
        .count('* as n')
        .first()
        .then((row) => Number(row.n)),
      0
    )
    assert.isNotNull(await CharacterRoll.findBy('userId', player.id))
  })

  test('creates the character and consumes the series', async ({ client, assert }) => {
    const { worldId } = await seedMusketeers()
    const player = await userWith()
    const roll = await seriesOf(player)

    const response = await client
      .post('/api/v1/characters')
      .json({ ...draft(worldId), rollId: roll.id })
      .loginAs(player)
      .withCsrfToken()

    response.assertStatus(201)
    const character = await Character.query()
      .where('id', bodyOf(response).data.id)
      .preload('profession')
      .firstOrFail()
    assert.equal(character.name, "d'Artagnan")
    assert.equal(character.gender, 'male')
    assert.equal(character.profession.reference, 'musketeer')
    assert.equal(character.worldId, worldId)
    assert.deepEqual(character.characteristics, {
      STR: 13,
      CON: 14,
      SIZ: 8,
      INT: 13,
      POW: 12,
      DEX: 16,
      CHA: 14,
    })
    /** The skills trained only, base chance and points. */
    assert.deepEqual(Object.keys(character.skills).sort(), [
      'athletics',
      'persuasion',
      'swordsmanship',
    ])
    assert.isNull(await CharacterRoll.findBy('userId', player.id))
  })

  test('no series, no character', async ({ client, assert }) => {
    const { worldId } = await seedMusketeers()

    const response = await client
      .post('/api/v1/characters')
      .json({ ...draft(worldId), rollId: crypto.randomUUID() })
      .loginAs(await userWith())
      .withCsrfToken()

    response.assertStatus(422)
    assert.equal(bodyOf(response).error.code, 'no_characteristic_roll')
  })

  test('a series rolled again since refuses the creation', async ({ client, assert }) => {
    const { worldId } = await seedMusketeers()
    const player = await userWith()
    const stale = await seriesOf(player)
    await seriesOf(player)

    const response = await client
      .post('/api/v1/characters')
      .json({ ...draft(worldId), rollId: stale.id })
      .loginAs(player)
      .withCsrfToken()

    response.assertStatus(409)
    assert.equal(bodyOf(response).error.code, 'stale_characteristic_roll')
  })

  test('an invalid draft is refused on the field at fault', async ({ client, assert }) => {
    const { worldId } = await seedMusketeers()
    const player = await userWith()
    const roll = await seriesOf(player)

    const response = await client
      .post('/api/v1/characters')
      .json({
        ...draft(worldId, { professionalPoints: { persuasion: 10 } }),
        rollId: roll.id,
      })
      .loginAs(player)
      .withCsrfToken()

    response.assertStatus(422)
    assert.equal(bodyOf(response).error.code, 'profession_skill_only')
    assert.equal(bodyOf(response).error.details.field, 'professionalPoints.persuasion')
    assert.isNotNull(await CharacterRoll.findBy('userId', player.id))
  })

  test('a player never places someone else’s series', async ({ client, assert }) => {
    const { worldId } = await seedMusketeers()
    const owner = await userWith()
    const roll = await seriesOf(owner)

    const response = await client
      .post('/api/v1/characters')
      .json({ ...draft(worldId), rollId: roll.id })
      .loginAs(await userWith())
      .withCsrfToken()

    response.assertStatus(422)
    assert.equal(bodyOf(response).error.code, 'no_characteristic_roll')
    assert.isNotNull(await CharacterRoll.findBy('userId', owner.id))
  })
})
