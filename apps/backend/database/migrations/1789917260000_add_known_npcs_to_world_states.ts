import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Whose names the character knows: the unique people the narrator may name
 * (architecture, section 6ter). A scenario gives the ones known from the
 * start; a person who gives their name in play joins them.
 *
 * Games under way already had every unique person they met named by the
 * narrator: those are known. A unique person's handle is their reference.
 */
export default class extends BaseSchema {
  protected tableName = 'world_states'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      /** References of unique people, in the order they became known. */
      table.jsonb('known_npcs').notNullable().defaultTo('[]')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE world_states ws
        SET known_npcs = met.references
        FROM (
          SELECT session_id, jsonb_agg(definition_reference ORDER BY created_at) AS references
          FROM npc_instances
          WHERE handle = definition_reference
          GROUP BY session_id
        ) met
        WHERE met.session_id = ws.session_id
      `)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('known_npcs')
    })
  }
}
