import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import { CharacterRollSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * The characteristics a player rolled to create a character: one series per
 * player, replaced by every reroll, consumed by the creation.
 */
export default class CharacterRoll extends CharacterRollSchema {
  static table = 'character_rolls'

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
