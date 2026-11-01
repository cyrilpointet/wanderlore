import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A world's rules and ambiance become lore fragments without tags, which go
 * with every turn as the two lists did (roadmap, Phase 8): one source of lore,
 * one way to edit it, one selection. Each sentence becomes a fragment of its
 * own, `rule_01`, `ambiance_01`…, numbered in the order it was written.
 *
 * Down puts back the world fragments without tags of those two kinds into the
 * lists, and leaves every other fragment where it is.
 */
export default class extends BaseSchema {
  protected tableName = 'worlds'

  async up() {
    this.defer(async (db) => {
      for (const kind of ['rule', 'ambiance']) {
        const column = kind === 'rule' ? 'rules' : 'ambiance'

        await db.rawQuery(
          `
          INSERT INTO lore_fragments (world_id, reference, kind, content, created_at, updated_at)
          SELECT w.id, ? || '_' || lpad(sentence.position::text, 2, '0'), ?::lore_fragment_kind,
                 sentence.content, now(), now()
          FROM worlds w,
               jsonb_array_elements_text(w.${column}) WITH ORDINALITY AS sentence(content, position)
          `,
          [kind, kind]
        )
      }
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('rules')
      table.dropColumn('ambiance')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('rules').notNullable().defaultTo('[]')
      table.jsonb('ambiance').notNullable().defaultTo('[]')
    })

    this.defer(async (db) => {
      for (const kind of ['rule', 'ambiance']) {
        const column = kind === 'rule' ? 'rules' : 'ambiance'

        await db.rawQuery(
          `
          UPDATE worlds w
          SET ${column} = moved.sentences
          FROM (
            SELECT world_id, jsonb_agg(content ORDER BY reference) AS sentences
            FROM lore_fragments
            WHERE scenario_id IS NULL AND kind = ?::lore_fragment_kind AND tags = '{}'
            GROUP BY world_id
          ) moved
          WHERE moved.world_id = w.id
          `,
          [kind]
        )
        await db.rawQuery(
          `DELETE FROM lore_fragments WHERE scenario_id IS NULL AND kind = ?::lore_fragment_kind AND tags = '{}'`,
          [kind]
        )
      }
    })
  }
}
