import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A failed turn is logged but is not part of the story: the history the player
 * reads must be able to leave it out, and reading a turn back after a lost SSE
 * stream must be able to say why it failed.
 */
export default class extends BaseSchema {
  protected tableName = 'turn_log'

  async up() {
    /**
     * `pending` is declared now although nothing writes it yet: the turn
     * recorded at submission time (KAN-17) needs it, and adding a value to a
     * native enum later cannot be undone in `down()`.
     */
    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE turn_status AS ENUM ('pending', 'completed', 'failed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)

    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('status', ['pending', 'completed', 'failed'], {
          useNative: true,
          enumName: 'turn_status',
          existingType: true,
        })
        .nullable()

      /**
       * What the player was told: the failure code and its message. Kept so a
       * client that missed `turn_failed` reads the same thing back.
       */
      table.jsonb('failure').nullable()
    })

    /**
     * Rows written before this column existed. A completed turn always carries
     * both its narration and its effects; anything short of that failed, for a
     * reason nobody recorded.
     */
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE turn_log
        SET status = CASE
          WHEN narrated_text IS NOT NULL AND applied_effects IS NOT NULL THEN 'completed'::turn_status
          ELSE 'failed'::turn_status
        END
      `)

      await db.rawQuery(`
        UPDATE turn_log
        SET failure = '{"code": "unknown_failure", "message": "This turn could not be played."}'::jsonb
        WHERE status = 'failed'
      `)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropNullable('status')

      /**
       * A failed turn always says why, and only a failed turn does.
       */
      table.check(
        `(status = 'failed') = (failure IS NOT NULL)`,
        [],
        'turn_log_failure_matches_status'
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks('turn_log_failure_matches_status')
      table.dropColumn('failure')
      table.dropColumn('status')
    })

    this.schema.raw('DROP TYPE IF EXISTS turn_status')
  }
}
