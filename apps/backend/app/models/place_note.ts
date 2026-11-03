import Session from '#models/session'
import { belongsTo } from '@adonisjs/lucid/orm'
import { PlaceNoteSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * How an event changed the look of a unique place in a game, one note per
 * place. Written through the events of a game only (`#services/game/apply_events`).
 */
export default class PlaceNote extends PlaceNoteSchema {
  static table = 'place_notes'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>
}
