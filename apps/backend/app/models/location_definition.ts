import World from '#models/world'
import Scenario from '#models/scenario'
import { LocationDefinitionSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class LocationDefinition extends LocationDefinitionSchema {
  static table = 'location_definitions'

  @belongsTo(() => World)
  declare world: BelongsTo<typeof World>

  /** Null for a world definition. */
  @belongsTo(() => Scenario)
  declare scenario: BelongsTo<typeof Scenario>
}
