import { BaseSchema } from '@adonisjs/lucid/schema'

const CHARACTERISTICS = ['STR', 'CON', 'SIZ', 'INT', 'POW', 'DEX', 'CHA']

/**
 * The rules become BRP's for every world (Phase 6): the seven characteristics
 * of the system replace the attributes each world declared, a category of
 * action may be resolved by a characteristic instead of a skill, and an item
 * may carry a weapon profile.
 *
 * No data carried over, on purpose. Games are refused, as when worlds came
 * into the database: delete them first. Content is deleted rather than
 * converted — skills in percent, base chances and weapon dice cannot be
 * guessed from the old scale — and `node ace db:seed` writes the seeded
 * worlds back in the new shape.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      const [{ total }] = await db.from('sessions').count('* as total')

      if (Number(total) > 0) {
        throw new Error(
          `${total} game(s) exist, and their sheets are on the old rules. ` +
            'Delete them first with "node ace game:reset --no-seed", then migrate and seed again.'
        )
      }

      /** Scenarios, catalogues and categories of action go with their world. */
      await db.from('worlds').delete()
    })

    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE characteristic AS ENUM (${CHARACTERISTICS.map((name) => `'${name}'`).join(', ')});
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)

    this.schema.alterTable('worlds', (table) => {
      table.dropColumn('attributes')
    })

    this.schema.alterTable('characters', (table) => {
      table.renameColumn('attributes', 'characteristics')
    })

    this.schema.alterTable('resolution_rules', (table) => {
      table.setNullable('associated_skill')
      table
        .enum('associated_characteristic', CHARACTERISTICS, {
          useNative: true,
          enumName: 'characteristic',
          existingType: true,
        })
        .nullable()

      /** A category is resolved by a skill or by a characteristic, never both. */
      table.check(
        'num_nonnulls(associated_skill, associated_characteristic) = 1',
        [],
        'resolution_rules_one_resolution'
      )
    })

    this.schema.alterTable('item_definitions', (table) => {
      /** Skill, damage dice, damage modifier use, special effect. Never sent to the model. */
      table.jsonb('weapon').nullable()
    })
  }

  /**
   * The structure only: games may exist, as when a spec walks the migrations
   * back. A category resolved by a characteristic has no place in the old
   * shape and goes; the values of a sheet are left as they stand.
   */
  async down() {
    this.defer(async (db) => {
      await db.from('resolution_rules').whereNull('associated_skill').delete()
    })

    this.schema.alterTable('item_definitions', (table) => {
      table.dropColumn('weapon')
    })

    this.schema.alterTable('resolution_rules', (table) => {
      table.dropChecks(['resolution_rules_one_resolution'])
      table.dropColumn('associated_characteristic')
      table.dropNullable('associated_skill')
    })

    this.schema.alterTable('characters', (table) => {
      table.renameColumn('characteristics', 'attributes')
    })

    this.schema.alterTable('worlds', (table) => {
      table.jsonb('attributes').notNullable().defaultTo('[]')
    })

    this.schema.raw('DROP TYPE IF EXISTS characteristic')
  }
}
