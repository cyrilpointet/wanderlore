import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The objects of the world become rows of `inventory_items` held by a place or
 * a person, so `world_objects` goes: two lists of the same things would only
 * drift apart.
 *
 * Nothing is carried over. The column only ever held the demo game's letter,
 * which the seeder now puts in the character's inventory.
 */
export default class extends BaseSchema {
  protected tableName = 'world_states'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('world_objects')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('world_objects').notNullable().defaultTo('[]')
    })
  }
}
