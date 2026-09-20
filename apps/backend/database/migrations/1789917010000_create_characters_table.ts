import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'characters'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('session_id')
        .notNullable()
        .references('id')
        .inTable('sessions')
        .onDelete('CASCADE')

      table.string('name').notNullable()

      /**
       * Shapes vary per world, so they stay in jsonb rather than in columns.
       * Which attributes and skills are valid is an application-level check
       * against the world definition (Phase 5), not a schema constraint.
       */
      table.jsonb('attributes').notNullable().defaultTo('{}')
      table.jsonb('skills').notNullable().defaultTo('{}')

      table.integer('hit_points').notNullable()
      table.integer('hit_points_max').notNullable()

      table.jsonb('resources').notNullable().defaultTo('{}')
      table.jsonb('progression').notNullable().defaultTo('{}')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
