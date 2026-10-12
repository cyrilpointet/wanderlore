import World from '#models/world'
import { belongsTo } from '@adonisjs/lucid/orm'
import { ResolutionRuleSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class ResolutionRule extends ResolutionRuleSchema {
  static table = 'resolution_rules'

  @belongsTo(() => World)
  declare world: BelongsTo<typeof World>
}
