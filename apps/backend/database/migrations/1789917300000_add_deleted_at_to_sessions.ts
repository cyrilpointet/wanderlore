import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * When the player removed the game from their list. A soft delete: the game,
 * its turns and what they cost stay in the base, and the content it was
 * played with stays undeletable. Null for a game still listed.
 */
export default class extends BaseSchema {
  protected tableName = 'sessions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('deleted_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('deleted_at')
    })
  }
}
