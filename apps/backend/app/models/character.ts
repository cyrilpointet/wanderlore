import User from '#models/user'
import World from '#models/world'
import Session from '#models/session'
import Profession from '#models/profession'
import { belongsTo, hasMany, scope } from '@adonisjs/lucid/orm'
import { CharacterSchema } from '#database/schema'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

/**
 * A player's character in a world (roadmap, Phase 12): the sheet, which
 * outlives their games. What lasts a single game — hit points, wounds,
 * resources, items — belongs to that game.
 */
export default class Character extends CharacterSchema {
  static table = 'characters'

  /**
   * The characters still on the player's list. A deleted one stays in the
   * base with their games, but reads everywhere as one that does not exist.
   */
  static listed = scope((query) => {
    query.whereNull('deletedAt')
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => World)
  declare world: BelongsTo<typeof World>

  @belongsTo(() => Profession)
  declare profession: BelongsTo<typeof Profession>

  /** Every game they played, ended or not, deleted ones included. */
  @hasMany(() => Session)
  declare sessions: HasMany<typeof Session>
}
