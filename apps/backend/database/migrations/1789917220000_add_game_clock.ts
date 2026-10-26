import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The game clock (Phase 7): fictional time the backend keeps, with no bearing
 * on the real one.
 *
 * A scenario says when its story opens: a time of day, always, and a
 * Gregorian date when it has one. A game copies both when it starts, as it
 * copies the initial state — editing the scenario afterwards never shifts a
 * game under way — then counts its time in seconds since midnight of its
 * first day. The log keeps the clock on both sides of each turn, and the
 * duration arbitration proposed.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('scenarios', (table) => {
      /** To the minute. 08:00 fills the scenarios written before it existed. */
      table.time('start_time').notNullable().defaultTo('08:00')
      table.date('start_date').nullable()
    })

    this.schema.alterTable('world_states', (table) => {
      /** Seconds since midnight of the game's first day. */
      table.integer('game_time').notNullable().defaultTo(0)
      table.date('start_date').nullable()
    })

    /**
     * Games already under way start their clock at the opening of their
     * scenario, whatever turns they played: their time was never kept.
     */
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE world_states ws
        SET game_time = extract(epoch FROM scenario.start_time)::integer,
            start_date = scenario.start_date
        FROM sessions session
        JOIN scenarios scenario ON scenario.id = session.scenario_id
        WHERE session.id = ws.session_id
      `)
    })

    this.schema.alterTable('turn_log', (table) => {
      /** Null for a turn that never got as far as arbitration, and before Phase 7. */
      table.integer('game_time_before').nullable()
      table.integer('game_time_after').nullable()

      /** The label arbitration proposed, with its count or its period. */
      table.jsonb('duration').nullable()
    })
  }

  async down() {
    this.schema.alterTable('turn_log', (table) => {
      table.dropColumn('duration')
      table.dropColumn('game_time_after')
      table.dropColumn('game_time_before')
    })

    this.schema.alterTable('world_states', (table) => {
      table.dropColumn('start_date')
      table.dropColumn('game_time')
    })

    this.schema.alterTable('scenarios', (table) => {
      table.dropColumn('start_date')
      table.dropColumn('start_time')
    })
  }
}
