import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Every game is played in a world, from one of its scenarios.
 *
 * No data carried over, on purpose: only development and test games exist,
 * and they are recreated rather than mapped onto content that was not in the
 * database when they started. The migration refuses to run while games
 * exist, rather than deleting them behind the developer's back.
 */
export default class extends BaseSchema {
  protected tableName = 'sessions'

  async up() {
    this.defer(async (db) => {
      const [{ total }] = await db.from(this.tableName).count('* as total')

      if (Number(total) > 0) {
        throw new Error(
          `${total} game(s) exist, and a game now needs a world and a scenario. ` +
            'Delete them first with "node ace game:reset --no-seed", then migrate and seed again.'
        )
      }
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('world_id').notNullable().references('id').inTable('worlds').onDelete('RESTRICT')
      table.uuid('scenario_id').notNullable()

      /**
       * The scenario has to belong to the game's world. Restrict: content a
       * game was played with cannot be deleted from under it.
       */
      table
        .foreign(['scenario_id', 'world_id'])
        .references(['id', 'world_id'])
        .inTable('scenarios')
        .onDelete('RESTRICT')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['scenario_id', 'world_id'])
      table.dropForeign(['world_id'])
      table.dropColumn('scenario_id')
      table.dropColumn('world_id')
    })
  }
}
