import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Deadlines and events (roadmap, Phase 11): the world moving on with the game
 * clock, without the player.
 *
 * Content: a scenario declares the flags extraction picks from and the events
 * its story holds; a unique person may keep a schedule; a place may change
 * with the time of day. A passage blocked by the time of day lives in its
 * exit, in the jsonb it already is.
 *
 * State: what became of each event in a game, the notes an event left on a
 * place, a passage blocked by an event, and what an event placed where the
 * game has never been — waiting for its first visit. Games in progress are
 * kept: nothing of theirs changes.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('scenarios', (table) => {
      /** The closed list of flags extraction may set: reference and what it means, in English. */
      table.jsonb('flags').notNullable().defaultTo('[]')
      table.jsonb('events').notNullable().defaultTo('[]')
    })

    this.schema.alterTable('npc_definitions', (table) => {
      /** Where a unique person is, period by period; none for an archetype. */
      table.jsonb('schedule').notNullable().defaultTo('[]')
      table.check(
        `kind = 'unique' OR schedule = '[]'::jsonb`,
        [],
        'npc_definitions_schedule_unique_only'
      )
    })

    this.schema.alterTable('location_definitions', (table) => {
      /** What the place is like at some periods of the day, added to its description. */
      table.jsonb('period_notes').notNullable().defaultTo('[]')
    })

    this.schema.alterTable('passage_states', (table) => {
      /** Shut by an event — a rockfall, a barricade — until another clears it. */
      table.timestamp('blocked_at', { useTz: true }).nullable()
    })

    this.schema.alterTable('world_states', (table) => {
      /**
       * What an event placed in a place never visited, or with a person never
       * met: neither has an instance to hold it yet. Brought into being with
       * them.
       */
      table.jsonb('pending_place_effects').notNullable().defaultTo('[]')
    })

    this.schema.alterTable('turn_log', (table) => {
      /** The events the turn set off, when each fell, and what cut the turn short or ended a wait. */
      table.jsonb('events_fired').nullable()
    })

    /**
     * One row per event a game armed, set off or saw cancelled. The times are
     * game times, in seconds since midnight of the first day.
     */
    this.schema.createTable('event_states', (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('session_id')
        .notNullable()
        .references('id')
        .inTable('sessions')
        .onDelete('CASCADE')
      table.string('event_reference', 64).notNullable()
      /** When its conditions first held, for an event that falls a while after. */
      table.integer('armed_at').nullable()
      table.integer('fired_at').nullable()
      /** When an `unless` of it held as it fell due: it never happens. */
      table.integer('cancelled_at').nullable()
      /** The turn it fell in. */
      table.integer('turn_number').nullable()
      /** Whether the character was there to see it. */
      table.boolean('witnessed').notNullable().defaultTo(false)
      /** Whether a narration has told it: an event of the state is told on the turn after. */
      table.boolean('told').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.unique(['session_id', 'event_reference'])
    })

    /** What an event changed in the look of a place: one note per place at most. */
    this.schema.createTable('place_notes', (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('session_id')
        .notNullable()
        .references('id')
        .inTable('sessions')
        .onDelete('CASCADE')
      /** A unique place, by reference: a note holds even where the game has never been. */
      table.string('location_reference', 64).notNullable()
      table.text('note').notNullable()
      table.string('event_reference', 64).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.unique(['session_id', 'location_reference'])
    })
  }

  async down() {
    this.schema.dropTable('place_notes')
    this.schema.dropTable('event_states')
    this.schema.alterTable('turn_log', (table) => table.dropColumn('events_fired'))
    this.schema.alterTable('world_states', (table) => table.dropColumn('pending_place_effects'))
    this.schema.alterTable('passage_states', (table) => table.dropColumn('blocked_at'))
    this.schema.alterTable('location_definitions', (table) => table.dropColumn('period_notes'))
    this.schema.alterTable('npc_definitions', (table) => {
      table.dropChecks(['npc_definitions_schedule_unique_only'])
      table.dropColumn('schedule')
    })
    this.schema.alterTable('scenarios', (table) => {
      table.dropColumn('flags')
      table.dropColumn('events')
    })
  }
}
