import User from '#models/user'
import World from '#models/world'
import NpcDefinition from '#models/npc_definition'
import ItemDefinition from '#models/item_definition'
import LocationDefinition from '#models/location_definition'
import { ScenarioSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class Scenario extends ScenarioSchema {
  static table = 'scenarios'

  @belongsTo(() => World)
  declare world: BelongsTo<typeof World>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare author: BelongsTo<typeof User>

  /** The scenario's own definitions, overriding or adding to the world's. */
  @hasMany(() => NpcDefinition)
  declare npcDefinitions: HasMany<typeof NpcDefinition>

  @hasMany(() => LocationDefinition)
  declare locationDefinitions: HasMany<typeof LocationDefinition>

  @hasMany(() => ItemDefinition)
  declare itemDefinitions: HasMany<typeof ItemDefinition>
}
