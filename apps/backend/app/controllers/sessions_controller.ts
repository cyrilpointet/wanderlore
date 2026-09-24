import Session from '#models/session'
import { ContentLabels } from '#services/game/content_labels'
import { THREE_MUSKETEERS } from '#services/game/world'
import SessionTransformer from '#transformers/session_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/** One world until Phase 5, where the session names its own. */
const labels = new ContentLabels(THREE_MUSKETEERS)

/**
 * The player's games. Every lookup is scoped to the player asking, so someone
 * else's game is indistinguishable from one that does not exist.
 */
export default class SessionsController {
  async index({ auth, serialize }: HttpContext) {
    const sessions = await Session.query()
      .where('userId', auth.getUserOrFail().id)
      .preload('characters')
      .orderBy('lastActivityAt', 'desc')

    return serialize(SessionTransformer.transform(sessions, labels).useVariant('toSummary'))
  }

  async show({ params, auth, serialize }: HttpContext) {
    const session = await Session.query()
      .where('id', params.id)
      .where('userId', auth.getUserOrFail().id)
      .preload('characters')
      .preload('worldState')
      .preload('turns', (turns) => turns.where('status', 'pending'))
      .firstOrFail()

    return serialize(SessionTransformer.transform(session, labels))
  }
}
