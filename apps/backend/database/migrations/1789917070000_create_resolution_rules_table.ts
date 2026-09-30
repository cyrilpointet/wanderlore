import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Which skill resolves which category of action, per world. Arbitration picks
 * a category from this closed list; the backend derives the skill from it.
 *
 * Slimmed down to what a turn actually reads: no threshold per row (the scale
 * is fixed in code), no modifiers (Phase 4), no scenario (Phase 5).
 */
export default class extends BaseSchema {
  protected tableName = 'resolution_rules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))

      /**
       * A reference, not a foreign key: worlds still live in code until
       * Phase 5, where this becomes `world_id`.
       */
      table.string('world_reference').notNullable()

      /** A varchar, not an enum: the list is each world's own, so open. */
      table.string('action_type').notNullable()
      table.text('description').notNullable()

      /**
       * No foreign key either: skills live in the world definition. A test
       * checks every one of them exists there.
       */
      table.string('associated_skill').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      /** Also the index resolution looks rows up by. */
      table.unique(['world_reference', 'action_type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
