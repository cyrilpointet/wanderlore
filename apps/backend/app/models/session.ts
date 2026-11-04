import User from '#models/user'
import World from '#models/world'
import Scenario from '#models/scenario'
import TurnLog from '#models/turn_log'
import Character from '#models/character'
import WorldState from '#models/world_state'
import CharacterState from '#models/character_state'
import LocationInstance from '#models/location_instance'
import NpcInstance from '#models/npc_instance'
import InventoryItem from '#models/inventory_item'
import PassageState from '#models/passage_state'
import NarrativeSummary from '#models/narrative_summary'
import { SessionSchema } from '#database/schema'
import { belongsTo, hasMany, hasOne, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'

export default class Session extends SessionSchema {
  /**
   * The generated schema classes carry no `static table`, so Lucid would derive
   * it from the model name. Spelled out on every model of the game so the
   * mapping never depends on the pluralizer.
   */
  static table = 'sessions'

  /**
   * The games still in the player's list. A deleted one stays in the base,
   * but reads everywhere as a game that does not exist — and so does a game
   * whose character the player deleted.
   */
  static listed = scope((query) => {
    query
      .whereNull('sessions.deleted_at')
      .whereNotExists((characters) =>
        characters
          .from('characters')
          .whereColumn('characters.id', 'sessions.character_id')
          .whereNotNull('characters.deleted_at')
      )
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => World)
  declare world: BelongsTo<typeof World>

  @belongsTo(() => Scenario)
  declare scenario: BelongsTo<typeof Scenario>

  /** The character the game is played by: their sheet outlives it. */
  @belongsTo(() => Character)
  declare character: BelongsTo<typeof Character>

  /** What the character lives through in this game: one row, `session_id` being unique. */
  @hasOne(() => CharacterState)
  declare characterState: HasOne<typeof CharacterState>

  @hasOne(() => WorldState)
  declare worldState: HasOne<typeof WorldState>

  @hasMany(() => TurnLog)
  declare turns: HasMany<typeof TurnLog>

  /** The places this game has been through, unique or improvised. */
  @hasMany(() => LocationInstance)
  declare locations: HasMany<typeof LocationInstance>

  /** The people this game has met, present or not: an instance is never deleted. */
  @hasMany(() => NpcInstance)
  declare npcs: HasMany<typeof NpcInstance>

  /** Every item of the game, whoever holds it, gone ones included. */
  @hasMany(() => InventoryItem)
  declare items: HasMany<typeof InventoryItem>

  /** The passages this game found or opened. */
  @hasMany(() => PassageState)
  declare passages: HasMany<typeof PassageState>

  /** What the game remembers beyond its last turns, superseded ones included. */
  @hasMany(() => NarrativeSummary)
  declare summaries: HasMany<typeof NarrativeSummary>
}
