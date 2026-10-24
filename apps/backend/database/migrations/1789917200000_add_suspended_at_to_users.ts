import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A suspended account can neither sign in nor go on with a session it already
 * had; its games are kept for when it is reactivated. Null: active.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('suspended_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('suspended_at')
    })
  }
}
