import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Why a game ended (roadmap, Phase 12, conditions of the end of a game): won
 * by an event of the scenario, lost by one, lost by the character's death, or
 * given up by the player. Set with `ended_at`, and only then.
 *
 * Games already over keep their outcome: a failed one was given up — the only
 * way a game could fail until now — and a completed one won. One over without
 * an end date takes its last update.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE end_reason AS ENUM ('victory', 'defeat', 'death', 'abandoned');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)

    this.schema.alterTable('sessions', (table) => {
      table
        .enum('end_reason', ['victory', 'defeat', 'death', 'abandoned'], {
          useNative: true,
          enumName: 'end_reason',
          existingType: true,
        })
        .nullable()
    })

    /** Filled in before the constraints, which every game over has to meet. */
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE sessions
        SET ended_at = COALESCE(ended_at, last_activity_at),
            end_reason = CASE status WHEN 'completed' THEN 'victory' ELSE 'abandoned' END::end_reason
        WHERE status IN ('completed', 'failed')
      `)
      await db.rawQuery(`
        ALTER TABLE sessions
          ADD CONSTRAINT sessions_end_reason_with_end
            CHECK ((ended_at IS NULL) = (end_reason IS NULL)),
          ADD CONSTRAINT sessions_end_reason_matches_status
            CHECK (end_reason IS NULL OR (end_reason = 'victory') = (status = 'completed'))
      `)
    })
  }

  async down() {
    this.schema.alterTable('sessions', (table) => {
      table.dropChecks(['sessions_end_reason_with_end', 'sessions_end_reason_matches_status'])
      table.dropColumn('end_reason')
    })
    this.schema.raw('DROP TYPE IF EXISTS end_reason')
  }
}
