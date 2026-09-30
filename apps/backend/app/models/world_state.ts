import Session from '#models/session'
import LocationInstance from '#models/location_instance'
import { belongsTo } from '@adonisjs/lucid/orm'
import { WorldStateSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class WorldState extends WorldStateSchema {
  static table = 'world_states'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>

  /** Where the game stands: always an instance, whatever kind of place it is. */
  @belongsTo(() => LocationInstance, { foreignKey: 'currentLocationId' })
  declare currentLocation: BelongsTo<typeof LocationInstance>
}
