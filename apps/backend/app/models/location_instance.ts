import Session from '#models/session'
import { belongsTo } from '@adonisjs/lucid/orm'
import { LocationInstanceSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class LocationInstance extends LocationInstanceSchema {
  static table = 'location_instances'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>
}
