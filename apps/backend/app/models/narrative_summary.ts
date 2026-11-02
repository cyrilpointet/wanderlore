import Session from '#models/session'
import { belongsTo } from '@adonisjs/lucid/orm'
import { NarrativeSummarySchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class NarrativeSummary extends NarrativeSummarySchema {
  static table = 'narrative_summaries'

  @belongsTo(() => Session)
  declare session: BelongsTo<typeof Session>
}
