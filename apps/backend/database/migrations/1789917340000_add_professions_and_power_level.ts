import { BaseSchema } from '@adonisjs/lucid/schema'

const POWER_LEVELS = ['normal', 'heroic', 'epic', 'superhuman']

/**
 * What creating a character needs from the content (roadmap, Phase 12): the
 * power level of a world, the professions a player picks from, and what a
 * scenario gives the character on top of their profession's equipment.
 *
 * The pregenerated character stays until the character becomes durable, in
 * the next migration. Nothing of a game in progress changes.
 */
export default class extends BaseSchema {
  async up() {
    /**
     * `migration:fresh` drops tables but leaves native enum types behind, so
     * the type is created defensively rather than by `alterTable`.
     */
    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE power_level AS ENUM (${POWER_LEVELS.map((level) => `'${level}'`).join(', ')});
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)

    this.schema.alterTable('worlds', (table) => {
      /** The book's level of a world: what a character is made with. */
      table
        .enum('power_level', POWER_LEVELS, {
          useNative: true,
          enumName: 'power_level',
          existingType: true,
        })
        .notNullable()
        .defaultTo('normal')
    })

    /** The professions of a world. No scenario overrides them: one holds for the whole world. */
    this.schema.createTable('professions', (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('world_id').notNullable().references('id').inTable('worlds').onDelete('CASCADE')
      table.string('reference', 64).notNullable()
      table.jsonb('labels').notNullable()
      /** One line of English, shown at creation and read by arbitration and the narrator. */
      table.text('description').notNullable()
      /** References of world skills: the only ones the professional points go to. */
      table.jsonb('skills').notNullable().defaultTo('[]')
      /** Items of the world, given at the start of every game. */
      table.jsonb('starting_items').notNullable().defaultTo('[]')
      /** Values by reference of a world resource, added to the scenario's. */
      table.jsonb('starting_resources').notNullable().defaultTo('{}')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.unique(['world_id', 'reference'])
      /** Target of the composite key that keeps a character in their profession's world. */
      table.unique(['id', 'world_id'])
    })

    this.schema.alterTable('scenarios', (table) => {
      /** What the scenario gives the character as a game starts, besides their profession's. */
      table.jsonb('starting_kit').notNullable().defaultTo('{"items": [], "resources": {}}')
    })
  }

  async down() {
    this.schema.alterTable('scenarios', (table) => table.dropColumn('starting_kit'))
    this.schema.dropTable('professions')
    this.schema.alterTable('worlds', (table) => table.dropColumn('power_level'))
    this.schema.raw('DROP TYPE IF EXISTS power_level')
  }
}
