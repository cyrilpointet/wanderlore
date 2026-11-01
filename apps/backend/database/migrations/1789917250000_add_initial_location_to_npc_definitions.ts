import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Where a unique person is when the game starts, if anywhere in particular:
 * the guard of a guardroom, the prisoner of a vault. On the model of an
 * item's initial holder — they come into being in that place, the first time
 * the game visits it.
 *
 * An archetype has none: its people are as many as the story needs, never
 * waiting anywhere in particular.
 */
export default class extends BaseSchema {
  protected tableName = 'npc_definitions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      /** The reference of a unique place. */
      table.string('initial_location').nullable()

      table.check(
        `kind = 'unique' or initial_location is null`,
        [],
        'npc_definitions_archetype_without_initial_location'
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks(['npc_definitions_archetype_without_initial_location'])
      table.dropColumn('initial_location')
    })
  }
}
