import User from '#models/user'
import Scenario from '#models/scenario'
import NpcDefinition from '#models/npc_definition'
import ItemDefinition from '#models/item_definition'
import ResolutionRule from '#models/resolution_rule'
import LocationDefinition from '#models/location_definition'
import { WorldSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class World extends WorldSchema {
  static table = 'worlds'

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare author: BelongsTo<typeof User>

  @hasMany(() => Scenario)
  declare scenarios: HasMany<typeof Scenario>

  /** World and scenario definitions alike: filter on `scenarioId` for one level. */
  @hasMany(() => NpcDefinition)
  declare npcDefinitions: HasMany<typeof NpcDefinition>

  @hasMany(() => LocationDefinition)
  declare locationDefinitions: HasMany<typeof LocationDefinition>

  @hasMany(() => ItemDefinition)
  declare itemDefinitions: HasMany<typeof ItemDefinition>

  @hasMany(() => ResolutionRule)
  declare resolutionRules: HasMany<typeof ResolutionRule>
}
