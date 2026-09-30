import Session from '#models/session'
import { belongsTo } from '@adonisjs/lucid/orm'
import { NpcInstanceSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class NpcInstance extends NpcInstanceSchema {
  static table = 'npc_instances'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>
}
