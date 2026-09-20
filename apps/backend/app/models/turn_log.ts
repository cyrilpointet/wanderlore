import Session from '#models/session'
import { belongsTo } from '@adonisjs/lucid/orm'
import { TurnLogSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class TurnLog extends TurnLogSchema {
  /**
   * Singular on purpose — it is a log, not a collection of turns. Without this
   * line Lucid would look for `turn_logs`, and only at query time.
   */
  static table = 'turn_log'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>
}
