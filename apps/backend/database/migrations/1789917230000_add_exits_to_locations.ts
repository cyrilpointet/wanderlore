import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Networks of places (Phase 7): a manor, a dungeon, a maze, gone through room
 * by room.
 *
 * A unique place may declare its exits, each leading to another unique place
 * — once, on one side, both ways unless one-way — and say whether it is an
 * entrance, where its network opens onto the places travelled to freely. An
 * archetype has neither: an improvised place is never part of a network.
 *
 * What a game learnt of its passages — a hidden one found, a locked one
 * opened — is kept per game, one row per passage whose state changed, shared
 * by both ways through it.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('location_definitions', (table) => {
      /** `{ to, passage, backPassage, hidden, requires, oneWay, duration }`, read by the backend. */
      table.jsonb('exits').notNullable().defaultTo('[]')
      table.boolean('entrance').notNullable().defaultTo(false)

      table.check(
        `kind = 'unique' or (exits = '[]'::jsonb and not entrance)`,
        [],
        'location_definitions_archetype_without_exits'
      )
    })

    this.schema.createTable('passage_states', (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('session_id')
        .notNullable()
        .references('id')
        .inTable('sessions')
        .onDelete('CASCADE')

      /**
       * The passage as its definition declares it: the place that declares
       * it, and the place it leads to. At most one passage joins two places,
       * so the pair names it whichever way it is gone through.
       */
      table.string('from_reference').notNullable()
      table.string('to_reference').notNullable()

      /** When the game found it, if it was hidden; null while it is not found. */
      table.timestamp('discovered_at', { useTz: true }).nullable()

      /** When the game opened it, if it was locked; null while it is not. */
      table.timestamp('unlocked_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.unique(['session_id', 'from_reference', 'to_reference'])
    })
  }

  async down() {
    this.schema.dropTable('passage_states')

    this.schema.alterTable('location_definitions', (table) => {
      table.dropChecks(['location_definitions_archetype_without_exits'])
      table.dropColumn('entrance')
      table.dropColumn('exits')
    })
  }
}
