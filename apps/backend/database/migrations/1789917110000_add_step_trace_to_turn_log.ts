import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Gives every step of the separated pipeline its place in the log: the
 * extraction step (E) gets a column of its own, and an output rejected by
 * validation stays on record even when a second attempt succeeds.
 */
export default class extends BaseSchema {
  protected tableName = 'turn_log'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      /** Validated output of the extraction step, as proposed — not as applied. */
      table.jsonb('extraction_output').nullable()

      /**
       * Each structured output refused by validation: its step, attempt
       * number, the output itself and why it was refused. A column of its own
       * rather than a field of each step's output: what was refused is by
       * definition off schema, and the rejection rate is read from here.
       * Its tokens stay in `llm_usage`, tagged with the same step and attempt,
       * so the cost of a turn is never counted twice.
       */
      table.jsonb('rejected_attempts').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('rejected_attempts')
      table.dropColumn('extraction_output')
    })
  }
}
