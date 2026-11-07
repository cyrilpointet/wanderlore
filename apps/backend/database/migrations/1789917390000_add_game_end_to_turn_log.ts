import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The turn that ended a game (roadmap, Phase 12): how it ended — the reason
 * kept, the event that set it off, the ends set aside by priority — and the
 * epilogue told once it was over. Null on every other turn; an epilogue that
 * failed leaves the end without it.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('turn_log', (table) => {
      table.jsonb('game_end').nullable()
      table.text('epilogue').nullable()
      table.check('epilogue IS NULL OR game_end IS NOT NULL', [], 'turn_log_epilogue_with_end')
    })
  }

  async down() {
    this.schema.alterTable('turn_log', (table) => {
      table.dropChecks(['turn_log_epilogue_with_end'])
      table.dropColumn('epilogue')
      table.dropColumn('game_end')
    })
  }
}
