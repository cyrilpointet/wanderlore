import Session from '#models/session'
import { ContentLabels } from '#services/game/content_labels'
import { loadWorld, loadWorlds } from '#services/game/content/load'
import SessionTransformer from '#transformers/session_transformer'
import type { HttpContext } from '@adonisjs/core/http'

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

    /** Each world once, however many of the player's games are played in it. */
    const worldOf = await loadWorlds(sessions)
    const labels = new Map<string, ContentLabels>()
    const labelsOf = (session: Session) => {
      if (!labels.has(session.scenarioId)) {
        labels.set(session.scenarioId, new ContentLabels(worldOf(session)))
      }

      return labels.get(session.scenarioId)!
    }

    return serialize(SessionTransformer.transform(sessions, labelsOf).useVariant('toSummary'))
  }

  async show({ params, auth, serialize }: HttpContext) {
    const session = await Session.query()
      .where('id', params.id)
      .where('userId', auth.getUserOrFail().id)
      .preload('characters', (characters) =>
        characters.preload('items', (items) =>
          items
            .whereNot('state', 'gone')
            .orderBy('createdAt', 'asc')
            .orderBy('definitionReference', 'asc')
            .orderBy('handle', 'asc')
        )
      )
      .preload('worldState', (worldState) => worldState.preload('currentLocation'))
      .preload('turns', (turns) => turns.where('status', 'pending'))
      .firstOrFail()

    const labels = new ContentLabels(await loadWorld(session))

    return serialize(SessionTransformer.transform(session, () => labels))
  }
}
