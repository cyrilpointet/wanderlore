import Session from '#models/session'
import Character from '#models/character'
import { belongsTo } from '@adonisjs/lucid/orm'
import { CharacterStateSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * What a character lives through in one game: hit points, wounds, resources.
 * Created when the game starts, at full hit points; nothing of it carries to
 * the next game.
 */
export default class CharacterState extends CharacterStateSchema {
  static table = 'character_states'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>

  @belongsTo(() => Character)
  declare character: BelongsTo<typeof Character>
}
