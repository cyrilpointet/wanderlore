import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'turn_log'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('session_id')
        .notNullable()
        .references('id')
        .inTable('sessions')
        .onDelete('CASCADE')

      table.integer('turn_number').notNullable()
      table.text('player_input').notNullable()

      /**
       * Nullable: a turn writes them as the pipeline progresses, and a turn that
       * fails mid-pipeline must still leave a readable trace.
       */
      table.jsonb('arbitration_output').nullable()
      table.jsonb('roll_result').nullable()
      table.text('narrated_text').nullable()
      table.jsonb('applied_effects').nullable()
      table.jsonb('alerts').nullable()

      /**
       * Token usage per LLM call of the turn. Feeds the real cost per turn and
       * per session (see roadmap, Phase 1).
       */
      table.jsonb('llm_usage').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()

      /**
       * Recent-buffer lookups read the last N turns of a session.
       */
      table.unique(['session_id', 'turn_number'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
