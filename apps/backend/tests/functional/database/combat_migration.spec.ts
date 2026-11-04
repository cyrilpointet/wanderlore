import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'

import { BEFORE_DURABLE_CHARACTERS, migrate, rollBackPast } from '#tests/helpers/migrations'

import {
  createLegacyCharacter,
  createNpcInstance,
  createLegacySession,
  createUser,
  createWorld,
  createWorldState,
} from '#tests/helpers/database'

const MIGRATION = 'database/migrations/1789917320000_add_combat_to_content_and_state'

/** Through the runner, as the other migration specs: `node ace` would rewrite the schema file. */
async function rollBackPastIt() {
  while (await db.from('adonis_schema').where('name', MIGRATION).first()) {
    await migrate({ direction: 'down', step: 1 })
  }
}

/** CON 14 and SIZ 12: 13 hit points before, 26 after. */
const SHEET = { STR: 12, CON: 14, SIZ: 12, INT: 13, POW: 11, DEX: 14, CHA: 12 }

/**
 * A game under way moves to the book's total hit points with its wounds kept,
 * and stored content gains what the round reads.
 *
 * DDL, so no per-test transaction: rows go with their user and their world,
 * and the schema is brought back up whatever happens.
 */
test.group('Migrations | combat', (group) => {
  const users: string[] = []
  const worlds: string[] = []

  group.each.teardown(async () => {
    await db.from('users').whereIn('id', users.splice(0)).delete()
    await db.from('worlds').whereIn('id', worlds.splice(0)).delete()
    await testUtils.db().migrate()
  })

  test('a wounded character keeps their wounds on total hit points, and starts healing', async ({
    assert,
  }) => {
    await rollBackPastIt()

    const userId = await createUser()
    users.push(userId)
    const sessionId = await createLegacySession(userId)
    await createWorldState(sessionId)
    await db.from('world_states').where('session_id', sessionId).update({ game_time: 5000 })
    const characterId = await createLegacyCharacter(sessionId)
    await db
      .from('characters')
      .where('id', characterId)
      .update({ characteristics: JSON.stringify(SHEET), hit_points: 8, hit_points_max: 13 })

    await migrate({ direction: 'up', until: BEFORE_DURABLE_CHARACTERS })

    const after = await db.from('characters').where('id', characterId).firstOrFail()
    assert.equal(after.hit_points_max, 26)
    /** Five points of wounds, before as after. */
    assert.equal(after.hit_points, 21)
    assert.equal(after.healing_since, 5000)
    assert.isFalse(after.bleeding)
    assert.isFalse(after.first_aid_available)
  })

  test('a weapon says what it is, a profile gains a modifier and an armour', async ({ assert }) => {
    await rollBackPastIt()

    const worldId = await createWorld()
    worlds.push(worldId)
    const now = new Date()
    const definition = { world_id: worldId, created_at: now, updated_at: now, kind: 'archetype' }
    const weapon = (damageModifier: string) =>
      JSON.stringify({ skill: 'swordsmanship', damage: '1D6', damageModifier, special: null })
    await db.table('item_definitions').multiInsert([
      {
        ...definition,
        reference: 'rapier',
        labels: { en: 'Rapier' },
        description: 'A blade.',
        equippable: true,
        weapon: weapon('full'),
      },
      {
        ...definition,
        reference: 'javelin',
        labels: { en: 'Javelin' },
        description: 'A spear.',
        equippable: true,
        weapon: weapon('half'),
      },
      {
        ...definition,
        reference: 'pistol',
        labels: { en: 'Pistol' },
        description: 'A gun.',
        equippable: true,
        weapon: weapon('none'),
      },
    ])
    await db.table('npc_definitions').insert({
      ...definition,
      reference: 'guard',
      labels: { en: 'Guard' },
      description: 'A guard.',
      default_disposition: 'neutral',
      combat: JSON.stringify({ skills: {}, hitPointsMax: 12, weapon: 'rapier' }),
    })

    await migrate({ direction: 'up', until: BEFORE_DURABLE_CHARACTERS })

    const items = await db.from('item_definitions').where('world_id', worldId).orderBy('reference')
    assert.deepEqual(
      items.map(({ reference, weapon: profile, armor }) => [
        reference,
        profile.kind,
        'skill' in profile,
        armor,
      ]),
      [
        ['javelin', 'thrown', false, 0],
        ['pistol', 'projectile', false, 0],
        ['rapier', 'melee', false, 0],
      ]
    )
    const guard = await db.from('npc_definitions').where('world_id', worldId).firstOrFail()
    assert.deepEqual(guard.combat, {
      skills: {},
      hitPointsMax: 12,
      weapon: 'rapier',
      damageModifier: null,
      armor: 0,
    })
  })

  test('a rollback brings back half hit points, and a dying person is present again', async ({
    assert,
  }) => {
    /** A game as it stood before characters outlived their games (Phase 12). */
    await rollBackPast('database/migrations/1789917350000_make_characters_durable')
    const userId = await createUser()
    users.push(userId)
    const sessionId = await createLegacySession(userId)
    const characterId = await createLegacyCharacter(sessionId)
    await db
      .from('characters')
      .where('id', characterId)
      .update({ characteristics: JSON.stringify(SHEET), hit_points: 21, hit_points_max: 26 })
    await createNpcInstance(sessionId, 'cardinal_guard_1', {
      definitionReference: 'cardinal_guard',
      status: 'dying',
    })

    await rollBackPastIt()

    const character = await db.from('characters').where('id', characterId).firstOrFail()
    assert.equal(character.hit_points_max, 13)
    assert.equal(character.hit_points, 8)
    const guard = await db.from('npc_instances').where('session_id', sessionId).firstOrFail()
    assert.equal(guard.status, 'present')
    assert.isFalse(await db.connection().schema.hasColumn('characters', 'bleeding'))
    assert.isFalse(await db.connection().schema.hasColumn('item_definitions', 'armor'))
  })
})
