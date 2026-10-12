import type { Knex } from 'knex'
import { BaseSchema } from '@adonisjs/lucid/schema'

const KIND = ['unique', 'archetype']

/**
 * The closed catalogues of people, places and items, in one shape: a world
 * definition, or a scenario definition that replaces the world definition of
 * the same reference (architecture, sections 6bis, 6ter and 6quater).
 *
 * One migration for the three: they share the `definition_kind` type, which
 * only the last of them to go may drop.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE definition_kind AS ENUM ('unique', 'archetype');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)

    this.schema.createTable('npc_definitions', (table) => {
      this.definitionColumns(table)

      /** Serves improvised people; a unique never does. */
      table.boolean('generic').notNullable().defaultTo(false)
      table
        .enum('default_disposition', ['hostile', 'unfriendly', 'neutral', 'friendly', 'allied'], {
          useNative: true,
          enumName: 'npc_disposition',
          existingType: true,
        })
        .notNullable()

      /** Skills, maximum hit points and ordinary weapon. Never sent to the model. */
      table.jsonb('combat').notNullable()

      table.check(`kind = 'archetype' or not generic`, [], 'npc_definitions_unique_not_generic')
    })

    this.schema.createTable('location_definitions', (table) => {
      this.definitionColumns(table)

      /** The unique place that contains a unique place; an archetype gets one per instance. */
      table.string('parent').nullable()

      table.check(
        `kind = 'unique' or parent is null`,
        [],
        'location_definitions_archetype_without_parent'
      )
    })

    this.schema.createTable('item_definitions', (table) => {
      this.definitionColumns(table)

      table.boolean('generic').notNullable().defaultTo(false)
      table.boolean('stackable').notNullable().defaultTo(false)
      table.boolean('equippable').notNullable().defaultTo(false)

      /** Fixed modifiers, read by the backend only. */
      table.jsonb('modifiers').notNullable().defaultTo('[]')

      /** The unique character or place that holds a unique item when the game starts. */
      table.jsonb('initial_holder').nullable()

      table.check(
        `kind = 'archetype' or not (generic or stackable)`,
        [],
        'item_definitions_unique_neither_generic_nor_stackable'
      )
      table.check(
        `kind = 'unique' or initial_holder is null`,
        [],
        'item_definitions_archetype_without_holder'
      )
    })

    for (const table of ['npc_definitions', 'location_definitions', 'item_definitions']) {
      /**
       * A reference is unique among the world definitions, and among the
       * definitions of each scenario — a scenario definition may share the
       * reference of a world one: that is how it overrides it.
       */
      this.schema.raw(
        `CREATE UNIQUE INDEX ${table}_world_reference_unique ON ${table} (world_id, reference) WHERE scenario_id IS NULL`
      )
      this.schema.raw(
        `CREATE UNIQUE INDEX ${table}_scenario_reference_unique ON ${table} (scenario_id, reference) WHERE scenario_id IS NOT NULL`
      )
    }
  }

  async down() {
    this.schema.dropTable('item_definitions')
    this.schema.dropTable('location_definitions')
    this.schema.dropTable('npc_definitions')
    this.schema.raw('DROP TYPE IF EXISTS definition_kind')
  }

  private definitionColumns(table: Knex.CreateTableBuilder) {
    table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
    table.uuid('world_id').notNullable().references('id').inTable('worlds').onDelete('CASCADE')

    /** Null for a world definition. */
    table.uuid('scenario_id').nullable()

    /** Stable English reference: what the code, the state and the model use. Immutable. */
    table.string('reference').notNullable()
    table.jsonb('labels').notNullable()

    /** One line of English for the model, never shown to the player. */
    table.text('description').notNullable()

    table
      .enum('kind', KIND, { useNative: true, enumName: 'definition_kind', existingType: true })
      .notNullable()

    table.timestamp('created_at', { useTz: true }).notNullable()
    table.timestamp('updated_at', { useTz: true }).nullable()

    /** The scenario has to belong to the definition's world. */
    table
      .foreign(['scenario_id', 'world_id'])
      .references(['id', 'world_id'])
      .inTable('scenarios')
      .onDelete('CASCADE')
  }
}
