import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Worlds now have a table: a rule names its world by foreign key instead of
 * by reference.
 *
 * The rows are content the seeder owns, not game data, so they are dropped
 * rather than carried over — there is no world row to point them at yet.
 * `node ace db:seed` writes them back.
 */
export default class extends BaseSchema {
  protected tableName = 'resolution_rules'

  async up() {
    this.defer(async (db) => {
      await db.from(this.tableName).delete()
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['world_reference', 'action_type'])
      table.dropColumn('world_reference')

      table.uuid('world_id').notNullable().references('id').inTable('worlds').onDelete('CASCADE')

      /** Also the index resolution looks rows up by. */
      table.unique(['world_id', 'action_type'])
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.from(this.tableName).delete()
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['world_id', 'action_type'])
      table.dropForeign(['world_id'])
      table.dropColumn('world_id')

      table.string('world_reference').notNullable()
      table.unique(['world_reference', 'action_type'])
    })
  }
}
