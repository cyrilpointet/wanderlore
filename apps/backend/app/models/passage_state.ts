import Session from '#models/session'
import { belongsTo } from '@adonisjs/lucid/orm'
import { PassageStateSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * What a game learnt of one passage: found, opened. Written through the
 * passage service only (`#services/game/passages`).
 */
export default class PassageState extends PassageStateSchema {
  static table = 'passage_states'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>
}
