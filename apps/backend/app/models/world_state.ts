import Session from '#models/session'
import { belongsTo } from '@adonisjs/lucid/orm'
import { WorldStateSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class WorldState extends WorldStateSchema {
  static table = 'world_states'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>

  /**
   * The current location is the last one visited: there is no separate column
   * for it, and duplicating it would only create two truths to keep in step.
   */
  get currentLocation(): string | null {
    const last = this.visitedLocations.at(-1)

    return typeof last?.reference === 'string' ? last.reference : null
  }
}
