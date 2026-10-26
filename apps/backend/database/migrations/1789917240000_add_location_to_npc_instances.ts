import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Where someone is (Phase 7): the place they were left in, found there again
 * when the player comes back. Null for someone who went off on their own —
 * nobody knows where — and for anyone the game lost track of.
 *
 * People present when the migration runs are where the game stands; those
 * already absent were never placed, and stay nowhere.
 */
export default class extends BaseSchema {
  protected tableName = 'npc_instances'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .uuid('location_instance_id')
        .nullable()
        .references('id')
        .inTable('location_instances')
        .onDelete('SET NULL')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE npc_instances npc
        SET location_instance_id = ws.current_location_id
        FROM world_states ws
        WHERE ws.session_id = npc.session_id AND npc.status = 'present'
      `)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('location_instance_id')
    })
  }
}
