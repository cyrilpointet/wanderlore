import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Which lore fragments each step of a turn was sent, by reference (roadmap,
 * Phase 8): `{ arbitration, narration }`, a step the turn did not reach
 * being null. Null for a turn that never got to arbitration, and for every
 * turn played before.
 */
export default class extends BaseSchema {
  protected tableName = 'turn_log'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('lore_sent').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('lore_sent')
    })
  }
}
