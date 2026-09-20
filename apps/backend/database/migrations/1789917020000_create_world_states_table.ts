import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'world_states'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))

      /**
       * One world state per session — the unique constraint enforces the 1:1.
       */
      table
        .uuid('session_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('sessions')
        .onDelete('CASCADE')

      table.jsonb('active_quests').notNullable().defaultTo('[]')
      table.jsonb('narrative_flags').notNullable().defaultTo('{}')
      table.jsonb('visited_locations').notNullable().defaultTo('[]')
      table.jsonb('world_objects').notNullable().defaultTo('[]')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })

    /**
     * Scenario progression is checked against narrative flags on the hot path.
     */
    this.schema.raw(
      'CREATE INDEX world_states_narrative_flags_index ON world_states USING GIN (narrative_flags)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
