import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Places as they exist in one game: unique places once visited, improvised
 * places as instances of an archetype. One shape for both, so the current
 * location is always an instance, whatever kind of place it is.
 *
 * Definitions stay in the world definition until Phase 5.
 */
export default class extends BaseSchema {
  protected tableName = 'location_instances'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('session_id')
        .notNullable()
        .references('id')
        .inTable('sessions')
        .onDelete('CASCADE')

      /**
       * The only way the model names an instance: the reference itself for a
       * unique place (`paris`), the reference and a number the backend picks
       * for an archetype (`tavern_2`).
       */
      table.string('handle').notNullable()
      table.string('definition_reference').notNullable()

      /**
       * The unique place an improvised one sits in. Null for a unique place,
       * whose parent is part of its definition.
       */
      table.string('parent_reference').nullable()

      /** Proper name of an improvised place ("Orléans"), shown to the player. */
      table.string('name').nullable()

      /** Short English description, for the narrator only. */
      table.text('descriptor').nullable()

      /** For a unique place, the date of its first visit. */
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.unique(['session_id', 'handle'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
