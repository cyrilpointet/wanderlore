import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The characteristics a player rolled to create a character (roadmap,
 * Phase 12): seven times four d6, the best three kept, by the backend. One
 * series per player, replaced by every reroll and consumed by the creation —
 * which places nothing but what was rolled.
 */
export default class extends BaseSchema {
  protected tableName = 'character_rolls'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('user_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      /** The seven results, in the order they were rolled. */
      table.jsonb('values').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
