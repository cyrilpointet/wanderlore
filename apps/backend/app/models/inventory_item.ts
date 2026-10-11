import Session from '#models/session'
import Character from '#models/character'
import NpcInstance from '#models/npc_instance'
import LocationInstance from '#models/location_instance'
import { belongsTo } from '@adonisjs/lucid/orm'
import { InventoryItemSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class InventoryItem extends InventoryItemSchema {
  static table = 'inventory_items'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>

  /** The holder: exactly one of the three is set, unless the item is gone. */
  @belongsTo(() => Character)
  declare character: BelongsTo<typeof Character>

  @belongsTo(() => NpcInstance)
  declare npcInstance: BelongsTo<typeof NpcInstance>

  @belongsTo(() => LocationInstance)
  declare locationInstance: BelongsTo<typeof LocationInstance>
}
