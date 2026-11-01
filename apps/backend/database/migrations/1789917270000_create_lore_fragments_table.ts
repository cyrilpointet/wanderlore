import { BaseSchema } from '@adonisjs/lucid/schema'

const KIND = ['rule', 'ambiance', 'fact']

/**
 * What a world or a scenario tells the model beyond what it knows natively
 * (roadmap, Phase 8): a few sentences each, sent only when the scene touches
 * what they are tagged with, and only to the step they serve.
 *
 * The shape of the catalogues — a world fragment, or a scenario fragment that
 * replaces the world fragment of the same reference — without names: a
 * fragment is never shown to the player.
 */
export default class extends BaseSchema {
  protected tableName = 'lore_fragments'

  async up() {
    /**
     * Which step a fragment goes to: `rule` arbitration, `ambiance` narration,
     * `fact` both.
     */
    this.schema.raw(`
      DO $$ BEGIN
        CREATE TYPE lore_fragment_kind AS ENUM ('rule', 'ambiance', 'fact');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `)

    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').notNullable().primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('world_id').notNullable().references('id').inTable('worlds').onDelete('CASCADE')

      /** Null for a world fragment. */
      table.uuid('scenario_id').nullable()

      /** Stable English reference: what a scenario overrides it by. Immutable. */
      table.string('reference').notNullable()

      table
        .enum('kind', KIND, { useNative: true, enumName: 'lore_fragment_kind', existingType: true })
        .notNullable()

      /** A few sentences of English for the model, never translated nor shown. */
      table.text('content').notNullable()

      /**
       * References of the places, people and items whose presence in the scene
       * sends it. None: always sent.
       */
      table.specificType('tags', 'text[]').notNullable().defaultTo('{}')

      /** Arbitration only: what the story knows and the character must not learn from the narrator. */
      table.boolean('secret').notNullable().defaultTo(false)

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      /** The scenario has to belong to the fragment's world. */
      table
        .foreign(['scenario_id', 'world_id'])
        .references(['id', 'world_id'])
        .inTable('scenarios')
        .onDelete('CASCADE')

      /** Ambiance goes to the narrator only: a secret one would go nowhere. */
      table.check(`not (secret and kind = 'ambiance')`, [], 'lore_fragments_ambiance_not_secret')
    })

    /** Unique among the world fragments, and among the fragments of each scenario. */
    this.schema.raw(
      `CREATE UNIQUE INDEX lore_fragments_world_reference_unique ON lore_fragments (world_id, reference) WHERE scenario_id IS NULL`
    )
    this.schema.raw(
      `CREATE UNIQUE INDEX lore_fragments_scenario_reference_unique ON lore_fragments (scenario_id, reference) WHERE scenario_id IS NOT NULL`
    )
    this.schema.raw(`CREATE INDEX lore_fragments_tags_index ON lore_fragments USING GIN (tags)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS lore_fragment_kind')
  }
}
