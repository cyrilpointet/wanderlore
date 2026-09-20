import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'turn_log'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      /**
       * Tracked per turn rather than per session: the cost of a turn varies with
       * the language it was generated in, and a session is free to change
       * language between two turns.
       *
       * Deliberately a varchar and not a native enum — the set of supported
       * languages is open, and a tag such as 'pt-BR' must fit. The default
       * backfills the rows written before multi-language exists.
       */
      table.string('language', 8).notNullable().defaultTo('en')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('language')
    })
  }
}
