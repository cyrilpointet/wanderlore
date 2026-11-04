import { BaseSchema } from '@adonisjs/lucid/schema'

const GENDERS = ['female', 'male', 'neutral']

/**
 * The character outlives their games (roadmap, Phase 12): the sheet belongs
 * to a player and to a world, and what lasts a single game — hit points,
 * wounds, resources — moves to `character_states`, one row per game. A game
 * names its character, of its own world, and may end in failure.
 *
 * No data carried over, as in Phase 6: only development and test games exist.
 * The migration refuses to run while games exist, rather than deleting them
 * behind the developer's back — and so the characters table, whose rows went
 * with their games, is empty when it runs.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      const [{ total }] = await db.from('sessions').count('* as total')

      if (Number(total) > 0) {
        throw new Error(
          `${total} game(s) exist, and a game is now played by a character of its own. ` +
            'Delete them first with "node ace game:reset --no-seed", then migrate and seed again.'
        )
      }
    })

    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE character_gender AS ENUM (${GENDERS.map((gender) => `'${gender}'`).join(', ')});
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)

    /** Run inside the transaction: the new value is not used before the commit. */
    this.schema.raw(`ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'failed'`)

    this.schema.alterTable('characters', (table) => {
      table.dropForeign(['session_id'])
      table.dropColumn('session_id')
      table.dropColumn('hit_points')
      table.dropColumn('hit_points_max')
      table.dropColumn('bleeding')
      table.dropColumn('first_aid_available')
      table.dropColumn('healing_since')
      table.dropColumn('resources')

      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      /** Restrict: a world characters were made in cannot be deleted from under them. */
      table.uuid('world_id').notNullable().references('id').inTable('worlds').onDelete('RESTRICT')
      table.uuid('profession_id').notNullable()
      table
        .enum('gender', GENDERS, {
          useNative: true,
          enumName: 'character_gender',
          existingType: true,
        })
        .notNullable()
      /** Soft: deleted by the player, it stays in the base with its games. */
      table.timestamp('deleted_at', { useTz: true }).nullable()

      /** The profession has to belong to the character's world. */
      table
        .foreign(['profession_id', 'world_id'])
        .references(['id', 'world_id'])
        .inTable('professions')
        .onDelete('RESTRICT')

      /** Target of the composite key that keeps a game in its character's world. */
      table.unique(['id', 'world_id'])
    })
    /** Chosen by the player, at most 35 characters. */
    this.schema.raw('ALTER TABLE characters ALTER COLUMN name TYPE varchar(35)')

    /** What the character lives through in one game: nothing of it carries to the next. */
    this.schema.createTable('character_states', (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('session_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('sessions')
        .onDelete('CASCADE')
      /**
       * No action rather than restrict: deleting a player removes their games
       * and their characters in one statement, whatever order it takes them in.
       */
      table.uuid('character_id').notNullable().references('id').inTable('characters')
      table.integer('hit_points').notNullable()
      table.integer('hit_points_max').notNullable()
      /** Bleeding from a blow: a point at each round of combat, until tended or the fight ends. */
      table.boolean('bleeding').notNullable().defaultTo(false)
      /** A wound taken since the last attempt at first aid: one attempt per wound. */
      table.boolean('first_aid_available').notNullable().defaultTo(false)
      /** The game time natural healing counts its weeks from; null at full hit points. */
      table.integer('healing_since').nullable()
      table.jsonb('resources').notNullable().defaultTo('{}')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })

    this.schema.alterTable('sessions', (table) => {
      table.uuid('character_id').notNullable()
      /** When the game ended, a success or a failure. */
      table.timestamp('ended_at', { useTz: true }).nullable()

      /** The character has to belong to the game's world; no action, as above. */
      table
        .foreign(['character_id', 'world_id'])
        .references(['id', 'world_id'])
        .inTable('characters')
    })

    /** One game at a time per character: engaged while a game is in progress or paused. */
    this.schema.raw(`
      CREATE UNIQUE INDEX sessions_one_game_per_character
        ON sessions (character_id)
        WHERE status IN ('in_progress', 'paused')
    `)

    /**
     * The character now outlives their games: their stack of an item is one
     * per game, never one for all of them.
     */
    this.schema.raw('DROP INDEX inventory_items_stack_per_character_id')
    this.schema.raw(`
      CREATE UNIQUE INDEX inventory_items_stack_per_character_id
        ON inventory_items (session_id, character_id, definition_reference)
        WHERE handle IS NULL AND character_id IS NOT NULL
    `)

    this.schema.alterTable('scenarios', (table) => table.dropColumn('pregenerated_character'))
  }

  async down() {
    this.defer(async (db) => {
      const [{ total }] = await db.from('characters').count('* as total')

      if (Number(total) > 0) {
        throw new Error(
          `${total} character(s) exist, and a character belonged to a game before. ` +
            'Delete them first, then roll back.'
        )
      }
    })

    this.schema.alterTable('scenarios', (table) => {
      table.jsonb('pregenerated_character').nullable()
    })

    this.schema.raw('DROP INDEX inventory_items_stack_per_character_id')
    this.schema.raw(`
      CREATE UNIQUE INDEX inventory_items_stack_per_character_id
        ON inventory_items (character_id, definition_reference)
        WHERE handle IS NULL AND character_id IS NOT NULL
    `)

    this.schema.raw('DROP INDEX sessions_one_game_per_character')
    this.schema.alterTable('sessions', (table) => {
      table.dropForeign(['character_id', 'world_id'])
      table.dropColumn('character_id')
      table.dropColumn('ended_at')
    })

    /** An enum value cannot be dropped: the type is rebuilt without it. */
    this.schema.raw(`
      ALTER TYPE session_status RENAME TO session_status_old;
      CREATE TYPE session_status AS ENUM ('in_progress', 'paused', 'completed');
      ALTER TABLE sessions ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE sessions
        ALTER COLUMN status TYPE session_status USING status::text::session_status;
      ALTER TABLE sessions ALTER COLUMN status SET DEFAULT 'in_progress';
      DROP TYPE session_status_old;
    `)

    this.schema.dropTable('character_states')

    this.schema.raw('ALTER TABLE characters ALTER COLUMN name TYPE varchar(255)')
    this.schema.alterTable('characters', (table) => {
      table.dropUnique(['id', 'world_id'])
      table.dropForeign(['profession_id', 'world_id'])
      table.dropForeign(['world_id'])
      table.dropForeign(['user_id'])
      table.dropColumn('deleted_at')
      table.dropColumn('gender')
      table.dropColumn('profession_id')
      table.dropColumn('world_id')
      table.dropColumn('user_id')

      table
        .uuid('session_id')
        .notNullable()
        .references('id')
        .inTable('sessions')
        .onDelete('CASCADE')
      table.integer('hit_points').notNullable()
      table.integer('hit_points_max').notNullable()
      table.boolean('bleeding').notNullable().defaultTo(false)
      table.boolean('first_aid_available').notNullable().defaultTo(false)
      table.integer('healing_since').nullable()
      table.jsonb('resources').notNullable().defaultTo('{}')
    })
    this.schema.raw('DROP TYPE IF EXISTS character_gender')
  }
}
