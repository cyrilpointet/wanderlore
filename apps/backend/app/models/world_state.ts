import Session from '#models/session'
import { belongsTo } from '@adonisjs/lucid/orm'
import { WorldStateSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class WorldState extends WorldStateSchema {
  static table = 'world_states'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>
}
