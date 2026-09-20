import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sessions'

  async up() {
    /**
     * `migration:fresh` drops tables but leaves native enum types behind, so the
     * type is created defensively rather than by `createTable`.
     */
    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE session_status AS ENUM ('in_progress', 'paused', 'completed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)

    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')

      table
        .enum('status', ['in_progress', 'paused', 'completed'], {
          useNative: true,
          enumName: 'session_status',
          existingType: true,
        })
        .notNullable()
        .defaultTo('in_progress')

      /**
       * Free-form until `scenarios.chapter_structure` exists (Phase 5). The
       * `world_id` / `scenario_id` foreign keys land with that same phase.
       */
      table.string('current_chapter').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('last_activity_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS session_status')
  }
}
