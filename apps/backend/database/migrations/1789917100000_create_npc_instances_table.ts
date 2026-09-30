import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * People as they exist in one game: named characters, archetypes, and the
 * improvised passer-by as an instance of a generic archetype — all in one
 * shape. Definitions stay in the world definition until Phase 5.
 */
export default class extends BaseSchema {
  protected tableName = 'npc_instances'

  async up() {
    /**
     * `migration:fresh` drops tables but leaves native enum types behind, so
     * both types are created defensively rather than by `createTable`.
     */
    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE npc_disposition AS ENUM ('hostile', 'unfriendly', 'neutral', 'friendly', 'allied');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)
    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE npc_status AS ENUM ('present', 'absent', 'dead');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)

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
       * unique character (`treville`), the reference and a number the backend
       * picks for an archetype (`cardinal_guard_2`).
       */
      table.string('handle').notNullable()
      table.string('definition_reference').notNullable()

      /** Proper name learnt during the game ("Jacques"). */
      table.string('name').nullable()

      /** Short English description, telling two instances of an archetype apart. */
      table.text('descriptor').nullable()

      /**
       * A qualitative label, never a score. No default: the initial one is
       * read from the definition.
       */
      table
        .enum('disposition', ['hostile', 'unfriendly', 'neutral', 'friendly', 'allied'], {
          useNative: true,
          enumName: 'npc_disposition',
          existingType: true,
        })
        .notNullable()

      /** Never deleted: someone who leaves the scene goes absent. */
      table
        .enum('status', ['present', 'absent', 'dead'], {
          useNative: true,
          enumName: 'npc_status',
          existingType: true,
        })
        .notNullable()
        .defaultTo('present')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.unique(['session_id', 'handle'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS npc_status')
    this.schema.raw('DROP TYPE IF EXISTS npc_disposition')
  }
}
