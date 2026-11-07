import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Hidden items, on the model of hidden passages (outside the roadmap,
 * November 2026): a unique item lying in a place from the start may be out of
 * sight (`item_definitions.hidden`), and stays so in a game until it is found
 * (`inventory_items.hidden`). Only a place hides: whoever holds an item knows
 * it is there.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('item_definitions', (table) => {
      table.boolean('hidden').notNullable().defaultTo(false)
      table.check(
        `NOT hidden OR (kind = 'unique' AND initial_holder->>'holder' = 'location')`,
        [],
        'item_definitions_hidden_in_a_place'
      )
    })

    this.schema.alterTable('inventory_items', (table) => {
      table.boolean('hidden').notNullable().defaultTo(false)
      table.check(
        'NOT hidden OR location_instance_id IS NOT NULL',
        [],
        'inventory_items_hidden_in_a_place'
      )
    })
  }

  async down() {
    this.schema.alterTable('inventory_items', (table) => {
      table.dropChecks(['inventory_items_hidden_in_a_place'])
      table.dropColumn('hidden')
    })

    this.schema.alterTable('item_definitions', (table) => {
      table.dropChecks(['item_definitions_hidden_in_a_place'])
      table.dropColumn('hidden')
    })
  }
}
