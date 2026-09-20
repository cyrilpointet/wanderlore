import User from '#models/user'
import TurnLog from '#models/turn_log'
import Character from '#models/character'
import WorldState from '#models/world_state'
import { SessionSchema } from '#database/schema'
import { belongsTo, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'

export default class Session extends SessionSchema {
  /**
   * The generated schema classes carry no `static table`, so Lucid would derive
   * it from the model name. Spelled out on every model of the game so the
   * mapping never depends on the pluralizer.
   */
  static table = 'sessions'

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  /**
   * `hasMany` although a session is played by a single character today: nothing
   * in the schema enforces that. `worldState` below is a `hasOne` because
   * `world_states.session_id` is unique — the relation mirrors the constraint,
   * not the intention.
   */
  @hasMany(() => Character)
  declare characters: HasMany<typeof Character>

  @hasOne(() => WorldState)
  declare worldState: HasOne<typeof WorldState>

  @hasMany(() => TurnLog)
  declare turns: HasMany<typeof TurnLog>
}
