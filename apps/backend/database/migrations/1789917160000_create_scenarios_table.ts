import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A scenario: the story a game is started from, in one world. It carries
 * the pregenerated character and the state a new game starts in, so starting
 * a game is a copy (character creation comes in Phase 10).
 *
 * A scenario is a `draft` until it is published, and only a published one is
 * offered to players.
 */
export default class extends BaseSchema {
  protected tableName = 'scenarios'

  async up() {
    /**
     * `migration:fresh` drops tables but leaves native enum types behind, so
     * the type is created defensively rather than by `createTable`.
     */
    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE scenario_status AS ENUM ('draft', 'published');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)

    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('world_id').notNullable().references('id').inTable('worlds').onDelete('CASCADE')

      /** Stable English reference, immutable once created, unique in its world. */
      table.string('reference').notNullable()
      table.jsonb('labels').notNullable()
      table.text('synopsis').notNullable().defaultTo('')

      table
        .enum('status', ['draft', 'published'], {
          useNative: true,
          enumName: 'scenario_status',
          existingType: true,
        })
        .notNullable()
        .defaultTo('draft')

      /** Ordered `{ reference, labels }`; progression conditions come later. */
      table.jsonb('chapters').notNullable().defaultTo('[]')
      table.jsonb('quests').notNullable().defaultTo('[]')

      /** Null while a draft lacks them; publishing requires both. */
      table.jsonb('pregenerated_character').nullable()
      table.jsonb('initial_state').nullable()

      /** Adds to the world's glossary. */
      table.jsonb('glossary').notNullable().defaultTo('[]')

      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.unique(['world_id', 'reference'])

      /**
       * Target of the composite foreign keys that tie a scenario-level row to
       * the world its scenario belongs to: a definition or a game can never
       * name a scenario of another world.
       */
      table.unique(['id', 'world_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS scenario_status')
  }
}
