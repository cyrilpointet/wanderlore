import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The hit points of a person in one game, next to the combat profile their
 * definition declares. Set from the profile when they first enter the scene.
 *
 * Nullable: people met before this column existed have none, and read as
 * unhurt. Nothing deals them damage before fights are wired (Phase 9).
 */
export default class extends BaseSchema {
  protected tableName = 'npc_instances'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('hit_points').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('hit_points')
    })
  }
}
