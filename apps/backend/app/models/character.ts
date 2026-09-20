import Session from '#models/session'
import { belongsTo } from '@adonisjs/lucid/orm'
import { CharacterSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Character extends CharacterSchema {
  static table = 'characters'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>
}
