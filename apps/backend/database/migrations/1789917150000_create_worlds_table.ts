import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A world: the context bible every game played in it shares. Its catalogues
 * of people, places and items live in tables of their own, its scenarios
 * too.
 *
 * Lists without identity of their own — attributes, skills, resources, rules,
 * ambiance, glossary — stay in jsonb: they are read and written whole, with
 * the world. Display names are by language, in `labels`, English required.
 */
export default class extends BaseSchema {
  protected tableName = 'worlds'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))

      /** Stable English reference, immutable once created. */
      table.string('reference').notNullable().unique()
      table.jsonb('labels').notNullable()

      /** One line, handed to both arbitration and narration. */
      table.text('narrative_tone').notNullable()

      /** Phrases: rules for arbitration, ambiance for narration. */
      table.jsonb('rules').notNullable().defaultTo('[]')
      table.jsonb('ambiance').notNullable().defaultTo('[]')

      table.jsonb('attributes').notNullable().defaultTo('[]')
      table.jsonb('skills').notNullable().defaultTo('[]')
      table.jsonb('resources').notNullable().defaultTo('[]')

      /** Proper names that are no entity of the game, and their translations. */
      table.jsonb('glossary').notNullable().defaultTo('[]')

      /** Who wrote it. Null for content the seeder owns. */
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
