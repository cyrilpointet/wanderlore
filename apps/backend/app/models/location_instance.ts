import Session from '#models/session'
import InventoryItem from '#models/inventory_item'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import { LocationInstanceSchema } from '#database/schema'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class LocationInstance extends LocationInstanceSchema {
  static table = 'location_instances'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>

  /** What they hold, gone items included: a row is never deleted. */
  @hasMany(() => InventoryItem)
  declare items: HasMany<typeof InventoryItem>
}
