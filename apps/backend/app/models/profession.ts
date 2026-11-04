import World from '#models/world'
import { belongsTo } from '@adonisjs/lucid/orm'
import { ProfessionSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/** A profession of a world, which a player picks for their character. */
export default class Profession extends ProfessionSchema {
  static table = 'professions'

  @belongsTo(() => World)
  declare world: BelongsTo<typeof World>
}
