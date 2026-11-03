import Session from '#models/session'
import { belongsTo } from '@adonisjs/lucid/orm'
import { EventStateSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * What became of one event of the scenario in a game: armed, set off or
 * cancelled, at which game time. Written through the events of a game only
 * (`#services/game/apply_events`).
 */
export default class EventState extends EventStateSchema {
  static table = 'event_states'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>
}
