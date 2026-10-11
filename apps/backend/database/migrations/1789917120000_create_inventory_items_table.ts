import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Items as they exist in one game, wherever they are: with the character, in
 * the hands of someone, or left in a place. A row is an instance of an item
 * definition and holds nothing but the state of that instance — labels,
 * descriptions and modifiers stay on the definition, in the world.
 */
export default class extends BaseSchema {
  protected tableName = 'inventory_items'

  async up() {
    /**
     * `migration:fresh` drops tables but leaves native enum types behind, so
     * the type is created defensively rather than by `createTable`.
     */
    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE item_state AS ENUM ('carried', 'equipped', 'gone');
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
       * The holder: three real foreign keys rather than a type and an id,
       * which nothing could check. Exactly one of them is set (see below).
       */
      table
        .uuid('character_id')
        .nullable()
        .references('id')
        .inTable('characters')
        .onDelete('CASCADE')
      table
        .uuid('npc_instance_id')
        .nullable()
        .references('id')
        .inTable('npc_instances')
        .onDelete('CASCADE')
      table
        .uuid('location_instance_id')
        .nullable()
        .references('id')
        .inTable('location_instances')
        .onDelete('CASCADE')

      /**
       * Stable within the game whoever holds the item: the reference itself
       * for a unique item, the reference and a number the backend picks for a
       * copy of an archetype (`rapier_2`). Null for a stack, which is told
       * apart by its holder and its definition.
       */
      table.string('handle').nullable()
      table.string('definition_reference').notNullable()

      /** Short English description of an improvised item, for the narrator only. */
      table.text('descriptor').nullable()

      /** Always 1 for a copy; how many for a stack; 0 once gone. */
      table.integer('quantity').notNullable().defaultTo(1)

      table
        .enum('state', ['carried', 'equipped', 'gone'], {
          useNative: true,
          enumName: 'item_state',
          existingType: true,
        })
        .notNullable()
        .defaultTo('carried')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.unique(['session_id', 'handle'])
    })

    this.schema.raw(`
      ALTER TABLE inventory_items
        ADD CONSTRAINT inventory_items_one_holder
          CHECK (num_nonnulls(character_id, npc_instance_id, location_instance_id) = 1 OR state = 'gone'),
        ADD CONSTRAINT inventory_items_quantity
          CHECK (CASE WHEN state = 'gone' THEN quantity = 0 ELSE quantity >= 1 END),
        ADD CONSTRAINT inventory_items_equipped_by_character
          CHECK (state <> 'equipped' OR character_id IS NOT NULL)
    `)

    /** A stack: one row per holder and per definition, whatever its quantity. */
    for (const holder of ['character_id', 'npc_instance_id', 'location_instance_id']) {
      this.schema.raw(`
        CREATE UNIQUE INDEX inventory_items_stack_per_${holder}
          ON inventory_items (${holder}, definition_reference)
          WHERE handle IS NULL AND ${holder} IS NOT NULL
      `)
    }
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS item_state')
  }
}
