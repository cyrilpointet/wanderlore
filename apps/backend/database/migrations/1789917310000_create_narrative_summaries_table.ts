import { BaseSchema } from '@adonisjs/lucid/schema'

const LEVEL = ['scene', 'global']

/**
 * The long-term memory of a game (roadmap, Phase 9): what happened before the
 * turns sent verbatim, condensed in English by a job that runs off the turn's
 * critical path.
 *
 * Written once and never updated: a new summary of a level supersedes the
 * previous one, which stays for whoever debugs the game.
 */
export default class extends BaseSchema {
  protected tableName = 'narrative_summaries'

  async up() {
    /**
     * `scene` condenses a block of turns; `global` folds the oldest scenes into
     * one rolling summary. No `chapter`: the chapter never changes during a game.
     */
    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE narrative_summary_level AS ENUM ('scene', 'global');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)

    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('session_id')
        .notNullable()
        .references('id')
        .inTable('sessions')
        .onDelete('CASCADE')

      table
        .enum('level', LEVEL, {
          useNative: true,
          enumName: 'narrative_summary_level',
          existingType: true,
        })
        .notNullable()

      /** Always English, whatever the language of the game. */
      table.text('content').notNullable()

      /** The `turn_log.turn_number` range covered, both ends included. */
      table.integer('turn_start').notNullable()
      table.integer('turn_end').notNullable()

      /**
       * The calls that wrote it, as `turn_log.llm_usage` holds a turn's: a
       * summary belongs to no turn, and its cost has to be read somewhere.
       */
      table.jsonb('llm_usage').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable()

      table.check('turn_start >= 1 and turn_start <= turn_end', [], 'narrative_summaries_range')

      /**
       * A range is summarised once: a job run twice for the same game cannot
       * write it twice. Also how the latest summary of a level is found.
       */
      table.unique(['session_id', 'level', 'turn_end'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS narrative_summary_level')
  }
}
