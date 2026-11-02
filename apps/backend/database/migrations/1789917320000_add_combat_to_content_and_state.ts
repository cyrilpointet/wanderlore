import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The combat of BRP (roadmap, Phase 10), in the content and in the state of
 * a game.
 *
 * Content: an item stops blows while worn (`armor`); a weapon says what it is
 * (`kind`) rather than the skill it is wielded with — the category of action
 * names it now; a person's combat profile gains their damage modifier and
 * their ordinary armour. What is stored is converted: a weapon's kind is read
 * from how it uses the damage modifier (a firearm none, a thrown weapon half),
 * a profile starts with no modifier and no armour.
 *
 * State, in typed columns — states of the system, not structures of a world:
 * who bleeds, who may still be tended for their last wound, since when the
 * character heals, and a person dying. Games in progress are kept: the
 * character moves to the book's total hit points, wounds taken kept.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('item_definitions', (table) => {
      table.integer('armor').notNullable().defaultTo(0)
      table.check('armor >= 0', [], 'item_definitions_armor_not_negative')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE item_definitions
        SET weapon = (weapon - 'skill') || jsonb_build_object(
          'kind',
          CASE weapon->>'damageModifier'
            WHEN 'none' THEN 'projectile'
            WHEN 'half' THEN 'thrown'
            ELSE 'melee'
          END
        )
        WHERE weapon IS NOT NULL
      `)
      await db.rawQuery(`
        UPDATE npc_definitions
        SET combat = combat || '{"damageModifier": null, "armor": 0}'::jsonb
      `)
    })

    this.schema.alterTable('characters', (table) => {
      /** Bleeding from a blow: a point at each round of combat, until tended or the fight ends. */
      table.boolean('bleeding').notNullable().defaultTo(false)
      /** A wound taken since the last attempt at first aid: one attempt per wound. */
      table.boolean('first_aid_available').notNullable().defaultTo(false)
      /** The game time natural healing counts its weeks from; null at full hit points. */
      table.integer('healing_since').nullable()
    })

    this.schema.alterTable('npc_instances', (table) => {
      table.boolean('bleeding').notNullable().defaultTo(false)
      table.boolean('first_aid_available').notNullable().defaultTo(false)
    })

    /**
     * The round a turn played, every roll in it — the hidden ones of the
     * people included, for whoever reads the log — and the first aid given.
     */
    this.schema.alterTable('turn_log', (table) => {
      table.jsonb('combat_result').nullable()
      table.jsonb('first_aid').nullable()
    })

    /**
     * A person brought to 0 dies at the end of the next turn, unless tended.
     * `IF NOT EXISTS`: `migration:fresh` leaves the type behind, value and all.
     */
    this.schema.raw(`ALTER TYPE npc_status ADD VALUE IF NOT EXISTS 'dying'`)

    this.defer(async (db) => {
      /** Total hit points: the maximum is CON + SIZ, and each wound taken still counts. */
      await db.rawQuery(`
        UPDATE characters
        SET hit_points = hit_points
              + ((characteristics->>'CON')::int + (characteristics->>'SIZ')::int)
              - hit_points_max,
            hit_points_max = (characteristics->>'CON')::int + (characteristics->>'SIZ')::int
      `)
      /** A character already wounded heals from now on. */
      await db.rawQuery(`
        UPDATE characters
        SET healing_since = world_states.game_time
        FROM world_states
        WHERE world_states.session_id = characters.session_id
          AND characters.hit_points < characters.hit_points_max
      `)
    })
  }

  /**
   * The structure, and the values as near as they go back: a weapon's skill
   * is the one its world resolves the matching category with, half hit
   * points the book's ordinary ones, wounds taken kept as far as they fit.
   */
  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE characters
        SET hit_points = GREATEST(
              0,
              hit_points - (hit_points_max
                - CEIL(((characteristics->>'CON')::int + (characteristics->>'SIZ')::int) / 2.0)::int)
            ),
            hit_points_max =
              CEIL(((characteristics->>'CON')::int + (characteristics->>'SIZ')::int) / 2.0)::int
      `)
      await db.rawQuery(`UPDATE npc_instances SET status = 'present' WHERE status = 'dying'`)
      await db.rawQuery(`
        ALTER TYPE npc_status RENAME TO npc_status_with_dying;
        CREATE TYPE npc_status AS ENUM ('present', 'absent', 'dead');
        ALTER TABLE npc_instances ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE npc_instances
          ALTER COLUMN status TYPE npc_status USING status::text::npc_status;
        ALTER TABLE npc_instances ALTER COLUMN status SET DEFAULT 'present';
        DROP TYPE npc_status_with_dying;
      `)
      await db.rawQuery(`
        UPDATE npc_definitions SET combat = combat - 'damageModifier' - 'armor'
      `)
      await db.rawQuery(`
        UPDATE item_definitions
        SET weapon = (weapon - 'kind') || jsonb_build_object(
          'skill',
          COALESCE(
            (
              SELECT associated_skill FROM resolution_rules
              WHERE resolution_rules.world_id = item_definitions.world_id
                AND resolution_rules.action_type = CASE weapon->>'kind'
                  WHEN 'melee' THEN 'melee_combat'
                  ELSE 'ranged_combat'
                END
            ),
            'unknown'
          )
        )
        WHERE weapon IS NOT NULL
      `)
    })

    this.schema.alterTable('turn_log', (table) => {
      table.dropColumn('combat_result')
      table.dropColumn('first_aid')
    })

    this.schema.alterTable('npc_instances', (table) => {
      table.dropColumn('bleeding')
      table.dropColumn('first_aid_available')
    })

    this.schema.alterTable('characters', (table) => {
      table.dropColumn('bleeding')
      table.dropColumn('first_aid_available')
      table.dropColumn('healing_since')
    })

    this.schema.alterTable('item_definitions', (table) => {
      table.dropChecks(['item_definitions_armor_not_negative'])
      table.dropColumn('armor')
    })
  }
}
