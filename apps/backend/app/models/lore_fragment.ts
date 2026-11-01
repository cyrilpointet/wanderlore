import World from '#models/world'
import Scenario from '#models/scenario'
import { LoreFragmentSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class LoreFragment extends LoreFragmentSchema {
  static table = 'lore_fragments'

  @belongsTo(() => World)
  declare world: BelongsTo<typeof World>

  /** Null for a world fragment. */
  @belongsTo(() => Scenario)
  declare scenario: BelongsTo<typeof Scenario>
}
