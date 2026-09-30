import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The position of a game becomes an instance of `location_instances`, and the
 * instances become the list of places visited. `visited_locations` goes: two
 * lists of the same places would only drift apart.
 */
export default class extends BaseSchema {
  protected tableName = 'world_states'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      /**
       * Nullable: a game may not have been placed anywhere yet. No cascade of
       * its own: an instance only ever goes with its session, which takes the
       * world state along in the same statement.
       */
      table.uuid('current_location_id').nullable().references('id').inTable('location_instances')
    })

    /**
     * Every place a game already went through becomes a unique instance, in
     * the order of its first visit. The rows written so far only ever named
     * unique places: movement was restricted to them.
     *
     * The first visit date is unknown; a microsecond per position keeps the
     * order, which is what the rollback rebuilds the list from.
     *
     * A rollback leaves the instances in place, so a place may already have
     * one: it is kept, never duplicated.
     */
    this.defer(async (db) => {
      await db.rawQuery(`
        INSERT INTO location_instances (session_id, handle, definition_reference, created_at, updated_at)
        SELECT ws.session_id, visited.reference, visited.reference,
               ws.created_at + visited.position * interval '1 microsecond', now()
        FROM world_states ws
        CROSS JOIN LATERAL (
          SELECT entry.value ->> 'reference' AS reference, min(entry.position) AS position
          FROM jsonb_array_elements(ws.visited_locations) WITH ORDINALITY AS entry(value, position)
          WHERE entry.value ->> 'reference' IS NOT NULL
          GROUP BY 1
        ) visited
        ON CONFLICT (session_id, handle) DO NOTHING
      `)

      /** The current location was the last one visited. */
      await db.rawQuery(`
        UPDATE world_states ws
        SET current_location_id = instance.id
        FROM location_instances instance
        WHERE instance.session_id = ws.session_id
          AND instance.handle = ws.visited_locations -> -1 ->> 'reference'
      `)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('visited_locations')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('visited_locations').notNullable().defaultTo('[]')
    })

    /**
     * The previous schema only knows unique places. Improvised ones are
     * dropped from the list; standing in one, the game is put back in its
     * parent.
     */
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE world_states ws
        SET visited_locations = coalesce((
          SELECT jsonb_agg(jsonb_build_object('reference', instance.handle) ORDER BY instance.created_at)
          FROM location_instances instance
          WHERE instance.session_id = ws.session_id AND instance.parent_reference IS NULL
        ), '[]'::jsonb)
      `)

      /** Back to a place visited earlier: it has to be last again to be current. */
      await db.rawQuery(`
        UPDATE world_states ws
        SET visited_locations = ws.visited_locations || jsonb_build_array(
          jsonb_build_object('reference', coalesce(instance.parent_reference, instance.handle))
        )
        FROM location_instances instance
        WHERE instance.id = ws.current_location_id
          AND ws.visited_locations -> -1 ->> 'reference'
            IS DISTINCT FROM coalesce(instance.parent_reference, instance.handle)
      `)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('current_location_id')
    })
  }
}
