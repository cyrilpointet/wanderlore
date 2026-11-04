import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import User from '#models/user'
import Character from '#models/character'
import Profession from '#models/profession'
import WorldState from '#models/world_state'
import CharacterState from '#models/character_state'
import InventoryItem from '#models/inventory_item'
import ItemDefinition from '#models/item_definition'
import NpcDefinition from '#models/npc_definition'
import NpcInstance from '#models/npc_instance'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'
import { seedMusketeers } from '#tests/helpers/content'
import { createScenario, createUser, useTransaction } from '#tests/helpers/database'
import { GASCON } from '#tests/helpers/worlds'

/** The typed test client cannot tell these routes apart, so the body is read untyped. */
function dataOf(response: { body(): unknown }): any {
  return (response.body() as { data: unknown }).data
}

async function userWith(role: 'player' | 'game_master' = 'player'): Promise<User> {
  return User.findOrFail(await createUser({ role }))
}

/** A character of the player in a world, of one of its professions. */
async function characterOf(
  user: User,
  worldId: string,
  profession = 'musketeer'
): Promise<Character> {
  const row = await Profession.query()
    .where('worldId', worldId)
    .where('reference', profession)
    .firstOrFail()

  return Character.create({
    userId: user.id,
    worldId,
    professionId: row.id,
    name: "d'Artagnan",
    gender: 'male',
    characteristics: GASCON,
    skills: { swordsmanship: 60 },
    progression: {},
  })
}

/** A draft of the seeded world, playable or not. */
async function draftOf(worldId: string, playable: boolean): Promise<string> {
  const scenarioId = await createScenario(worldId, { status: 'draft' })

  if (playable) {
    const published = THREE_MUSKETEERS_CONTENT.scenarios[0]

    /**
     * The draft has none of the published scenario's own places: it opens in
     * a place of the world instead.
     */
    await db
      .from('scenarios')
      .where('id', scenarioId)
      .update({
        chapters: JSON.stringify(published.chapters),
        quests: JSON.stringify(published.quests),
        initial_state: JSON.stringify({ ...published.initialState, location: 'hotel_de_treville' }),
      })
  }

  return scenarioId
}

/** What the game screen gets back once the game is started. */
function start(
  client: any,
  user: User,
  character: { id: string },
  scenarioId: string
): Promise<any> {
  return client
    .post(`/api/v1/characters/${character.id}/sessions`)
    .json({ scenarioId })
    .loginAs(user)
    .withCsrfToken()
}

test.group('New game | starting', (group) => {
  useTransaction(group)

  test('starts the story with the character, at full hit points, equipped by their profession and the scenario', async ({
    client,
    assert,
  }) => {
    const { worldId, scenarioId } = await seedMusketeers()
    const player = await userWith()
    const character = await characterOf(player, worldId)

    const response = await start(client, player, character, scenarioId)

    response.assertStatus(201)
    const game = dataOf(response)

    assert.equal(game.status, 'in_progress')
    assert.equal(game.characterId, character.id)
    assert.deepEqual(game.scenario, { id: scenarioId, title: 'The Stolen Seal' })
    assert.deepEqual(game.world, { reference: 'three_musketeers', label: 'The Three Musketeers' })
    assert.deepEqual(game.chapter, { reference: 'the_guards_house', label: "The Guards' House" })
    assert.deepEqual(game.location, {
      reference: 'rue_du_cherche_midi',
      label: 'Rue du Cherche-Midi',
    })
    assert.deepEqual(
      game.activeQuests.map(({ reference }: { reference: string }) => reference),
      ['recover_the_seal']
    )
    assert.equal(game.character.name, "d'Artagnan")
    assert.equal(game.character.gender, 'male')
    assert.deepEqual(game.character.profession, { reference: 'musketeer', label: 'Musketeer' })
    /** Derived from the sheet, the book's total hit points: CON 14 and SIZ 12 make 26. */
    assert.equal(game.character.hitPoints, 26)
    assert.equal(game.character.hitPointsMax, 26)
    /** The profession's purse, and nothing from the scenario. */
    assert.deepEqual(game.character.resources, [{ reference: 'purse', label: 'Purse', value: 10 }])
    assert.isNull(game.pendingTurn)

    const items = await InventoryItem.query()
      .where('sessionId', game.id)
      .orderBy('definitionReference')
    assert.deepEqual(
      items.map(({ definitionReference, state, characterId }) => [
        definitionReference,
        state,
        characterId,
      ]),
      [
        ['document', 'carried', character.id],
        ['musketeer_tabard', 'equipped', character.id],
        ['rapier', 'equipped', character.id],
        ['rope', 'carried', character.id],
      ]
    )
  })

  test('adds the resources of the profession and of the scenario', async ({ client, assert }) => {
    const { worldId, scenarioId } = await seedMusketeers()
    await db
      .from('scenarios')
      .where('id', scenarioId)
      .update({ starting_kit: JSON.stringify({ items: [], resources: { purse: 5 } }) })
    const player = await userWith()
    const character = await characterOf(player, worldId, 'valet')

    const response = await start(client, player, character, scenarioId)

    response.assertStatus(201)
    const state = await CharacterState.findByOrFail('sessionId', dataOf(response).id)
    /** The valet's 2 and the scenario's 5. */
    assert.deepEqual(state.resources, { purse: 7 })
  })

  test("a scenario's definition overrides the item of the same reference a profession gives", async ({
    client,
    assert,
  }) => {
    const { worldId, scenarioId } = await seedMusketeers()
    const tabard = THREE_MUSKETEERS_CONTENT.items.find(
      ({ reference }) => reference === 'musketeer_tabard'
    )!
    await ItemDefinition.create({
      ...tabard,
      worldId,
      scenarioId,
      labels: { en: 'Torn tabard' },
    })
    const player = await userWith()

    const response = await start(client, player, await characterOf(player, worldId), scenarioId)

    response.assertStatus(201)
    assert.include(
      dataOf(response).character.inventory.map(
        ({ item }: { item: { label: string } }) => item.label
      ),
      'Torn tabard'
    )
  })

  test('knows from the start the names the scenario says the character knows', async ({
    client,
    assert,
  }) => {
    const { worldId, scenarioId } = await seedMusketeers()
    const row = await db.from('scenarios').where('id', scenarioId).firstOrFail()
    await db
      .from('scenarios')
      .where('id', scenarioId)
      .update({ initial_state: JSON.stringify({ ...row.initial_state, knownNpcs: ['treville'] }) })
    const player = await userWith()

    const response = await start(client, player, await characterOf(player, worldId), scenarioId)

    response.assertStatus(201)
    const state = await WorldState.findByOrFail('sessionId', dataOf(response).id)
    assert.deepEqual(state.knownNpcs, ['treville'])
  })

  test('whoever waits where the story starts is there from the first turn', async ({
    client,
    assert,
  }) => {
    const { worldId, scenarioId } = await seedMusketeers()
    await NpcDefinition.create({
      worldId,
      scenarioId,
      reference: 'night_watchman',
      labels: { en: 'The night watchman' },
      description: 'A watchman with a lantern, walking the rue du Cherche-Midi.',
      kind: 'unique',
      generic: false,
      defaultDisposition: 'neutral',
      combat: { skills: {}, hitPointsMax: 10, weapon: null, damageModifier: null, armor: 0 },
      initialLocation: 'rue_du_cherche_midi',
      schedule: [],
    })
    const player = await userWith()

    const response = await start(client, player, await characterOf(player, worldId), scenarioId)

    response.assertStatus(201)
    const watchman = await NpcInstance.query()
      .where('sessionId', dataOf(response).id)
      .where('handle', 'night_watchman')
      .preload('location')
      .firstOrFail()
    assert.equal(watchman.status, 'present')
    assert.equal(watchman.location.handle, 'rue_du_cherche_midi')
  })

  test('opens the clock at the time and on the date the story starts', async ({
    client,
    assert,
  }) => {
    const { worldId, scenarioId } = await seedMusketeers()
    const player = await userWith()

    const response = await start(client, player, await characterOf(player, worldId), scenarioId)

    const game = await WorldState.findByOrFail('sessionId', dataOf(response).id)

    /** 23:00 on the first day, the second of June 1625. */
    assert.equal(game.gameTime, 23 * 3600)
    assert.equal(game.startDate, '1625-06-02')
  })

  test('a story with no date keeps none, and editing the scenario leaves a game alone', async ({
    client,
    assert,
  }) => {
    const { worldId } = await seedMusketeers()
    const draft = await draftOf(worldId, true)
    const master = await userWith('game_master')

    /** A draft written with the defaults of the table: 08:00, no date. */
    const response = await start(client, master, await characterOf(master, worldId), draft)

    await db.from('scenarios').where('id', draft).update({ start_time: '21:30' })

    const game = await WorldState.findByOrFail('sessionId', dataOf(response).id)
    assert.equal(game.gameTime, 8 * 3600)
    assert.isNull(game.startDate)
  })

  test('a player cannot start a draft: it reads as missing', async ({ client }) => {
    const { worldId } = await seedMusketeers()
    const draft = await draftOf(worldId, true)
    const player = await userWith()

    const response = await start(client, player, await characterOf(player, worldId), draft)

    response.assertStatus(404)
  })

  test('a game master can try a draft out', async ({ client }) => {
    const { worldId } = await seedMusketeers()
    const draft = await draftOf(worldId, true)
    const master = await userWith('game_master')

    const response = await start(client, master, await characterOf(master, worldId), draft)

    response.assertStatus(201)
  })

  test('a draft without its starting state cannot be played yet', async ({ client, assert }) => {
    const { worldId } = await seedMusketeers()
    const draft = await draftOf(worldId, false)
    const master = await userWith('game_master')

    const response = await start(client, master, await characterOf(master, worldId), draft)

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

  test('a scenario of another world reads as missing', async ({ client }) => {
    const { scenarioId } = await seedMusketeers()
    const mythos = await db.from('worlds').where('reference', 'lovecraft_mythos').firstOrFail()
    const player = await userWith()

    const response = await start(
      client,
      player,
      await characterOf(player, mythos.id, 'professor'),
      scenarioId
    )

    response.assertStatus(404)
  })

  test("someone else's character reads as missing", async ({ client }) => {
    const { worldId, scenarioId } = await seedMusketeers()
    const owner = await userWith()

    const response = await start(
      client,
      await userWith(),
      await characterOf(owner, worldId),
      scenarioId
    )

    response.assertStatus(404)
  })

  test('refuses something that is not a scenario id', async ({ client }) => {
    const { worldId } = await seedMusketeers()
    const player = await userWith()

    const response = await start(client, player, await characterOf(player, worldId), 'paris')

    response.assertStatus(422)
  })
})
