import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { MigrationRunner } from '@adonisjs/lucid/migration'
import testUtils from '@adonisjs/core/services/test_utils'

import { countRows, createSession, createUser } from '#tests/helpers/database'

const MIGRATION =
  'database/migrations/1789917090000_replace_visited_locations_with_current_location'

/**
 * Driven through the runner itself rather than through `node ace`: the
 * commands regenerate `database/schema.ts`, the runner does not.
 */
async function migrate(options: { direction: 'up' } | { direction: 'down'; step: number }) {
  const runner = new MigrationRunner(db, app, options)
  await runner.run()

  if (runner.error) {
    throw runner.error
  }
}

/**
 * Back to just before the migration under test, whatever came after it.
 *
 * One file at a time: the runner only counts `step` within the latest batch,
 * and a migration run from the command line lands in a batch of its own.
 */
async function rollBackPastIt() {
  while (await db.from('adonis_schema').where('name', MIGRATION).first()) {
    await migrate({ direction: 'down', step: 1 })
  }
}

const JANUARY = new Date('2026-01-01T00:00:00Z')

function minutesLater(minutes: number): Date {
  return new Date(JANUARY.getTime() + minutes * 60_000)
}

async function insertPlace(
  sessionId: string,
  handle: string,
  createdAt: Date,
  parentReference: string | null = null
): Promise<string> {
  const [row] = await db
    .table('location_instances')
    .insert({
      session_id: sessionId,
      handle,
      definition_reference: parentReference === null ? handle : handle.replace(/_\d+$/, ''),
      parent_reference: parentReference,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .returning('id')

  return row.id
}

function worldStateOf(sessionId: string) {
  return db.from('world_states').where('session_id', sessionId).firstOrFail()
}

/**
 * Games played before the migration keep where they stand and where they have
 * been, and a rollback gives them back in the old shape.
 *
 * DDL, so no per-test transaction: rows are removed through their user, and
 * the schema is brought back up whatever happens.
 */
test.group('Migrations | current location', (group) => {
  const users: string[] = []

  async function gameOf(): Promise<string> {
    const userId = await createUser()
    users.push(userId)

    return createSession(userId)
  }

  /**
   * Puts the latest migration in a batch of its own, as `node ace
   * migration:run` does after adding one: rolling back must reach the
   * migration under test across batches, not only within the last one.
   */
  group.each.setup(async () => {
    await migrate({ direction: 'down', step: 1 })
    await migrate({ direction: 'up' })
  })

  group.each.teardown(async () => {
    await testUtils.db().migrate()
    await db.from('users').whereIn('id', users.splice(0)).delete()
  })

  test('turns the places already visited into instances', async ({ assert }) => {
    await rollBackPastIt()

    const travelled = await gameOf()
    const unplaced = await gameOf()

    for (const [sessionId, visited] of [
      [travelled, ['meung_sur_loire', 'paris', 'meung_sur_loire']],
      [unplaced, []],
    ] as const) {
      await db.table('world_states').insert({
        session_id: sessionId,
        visited_locations: JSON.stringify(visited.map((reference) => ({ reference }))),
        created_at: JANUARY,
        updated_at: JANUARY,
      })
    }

    await migrate({ direction: 'up' })

    const places = await db
      .from('location_instances')
      .where('session_id', travelled)
      .orderBy('created_at', 'asc')
    const state = await worldStateOf(travelled)
    const unplacedState = await worldStateOf(unplaced)

    /** One instance per place, in the order of the first visit. */
    assert.deepEqual(
      places.map((place) => [place.handle, place.definition_reference, place.parent_reference]),
      [
        ['meung_sur_loire', 'meung_sur_loire', null],
        ['paris', 'paris', null],
      ]
    )
    /** The last place visited is where the game stands, back in Meung. */
    assert.equal(state.current_location_id, places[0].id)

    assert.isNull(unplacedState.current_location_id)
  })

  test('a rollback rebuilds the list, where the game stands last', async ({ assert }) => {
    const returned = await gameOf()
    const meung = await insertPlace(returned, 'meung_sur_loire', minutesLater(1))
    await insertPlace(returned, 'paris', minutesLater(2))

    const improvised = await gameOf()
    await insertPlace(improvised, 'meung_sur_loire', minutesLater(1))
    const tavern = await insertPlace(improvised, 'tavern_1', minutesLater(2), 'paris')

    for (const [sessionId, current] of [
      [returned, meung],
      [improvised, tavern],
    ]) {
      await db.table('world_states').insert({
        session_id: sessionId,
        current_location_id: current,
        created_at: JANUARY,
        updated_at: JANUARY,
      })
    }

    await rollBackPastIt()

    const [returnedState, improvisedState] = await Promise.all([
      worldStateOf(returned),
      worldStateOf(improvised),
    ])

    /** Came back to Meung: it has to be last again to read as current. */
    assert.deepEqual(returnedState.visited_locations, [
      { reference: 'meung_sur_loire' },
      { reference: 'paris' },
      { reference: 'meung_sur_loire' },
    ])
    /** The old shape has no improvised place: the tavern gives way to its parent. */
    assert.deepEqual(improvisedState.visited_locations, [
      { reference: 'meung_sur_loire' },
      { reference: 'paris' },
    ])

    await migrate({ direction: 'up' })

    /** Up again: the instances the rollback left behind are reused, not duplicated. */
    assert.equal(await countRows('location_instances', { session_id: returned }), 2)
    const restored = await worldStateOf(returned)
    assert.equal(restored.current_location_id, meung)
  })
})
