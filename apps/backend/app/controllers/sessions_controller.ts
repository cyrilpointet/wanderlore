import { DateTime } from 'luxon'

import Session from '#models/session'
import { ContentLabels } from '#services/game/content_labels'
import { loadWorld, loadWorlds } from '#services/game/content/load'
import { startGame } from '#services/game/new_game'
import { startGameValidator } from '#validators/session'
import SessionTransformer from '#transformers/session_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * The player's games. Every lookup is scoped to the player asking, so someone
 * else's game is indistinguishable from one that does not exist — as is a game
 * the player deleted.
 */
export default class SessionsController {
  async index({ auth, serialize }: HttpContext) {
    const sessions = await Session.query()
      .where('userId', auth.getUserOrFail().id)
      .withScopes((scopes) => scopes.listed())
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
    const session = await findGame(params.id, auth.getUserOrFail().id)
    const labels = new ContentLabels(await loadWorld(session))

    return serialize(SessionTransformer.transform(session, () => labels))
  }

  /**
   * Starts a game from a scenario and answers with it, in the shape the game
   * screen reads, so the front goes straight to it.
   */
  async store({ request, response, auth, serialize }: HttpContext) {
    const { scenarioId } = await request.validateUsing(startGameValidator)
    const user = auth.getUserOrFail()

    const created = await startGame(user, scenarioId)
    const session = await findGame(created.id, user.id)
    const labels = new ContentLabels(await loadWorld(session))

    response.status(201)

    return serialize(SessionTransformer.transform(session, () => labels))
  }

  /**
   * Removes a game from the player's list. Soft: the game and its turns stay
   * in the base, and a turn already under way plays out unseen.
   */
  async destroy({ params, auth, response }: HttpContext) {
    const session = await Session.query()
      .where('id', params.id)
      .where('userId', auth.getUserOrFail().id)
      .withScopes((scopes) => scopes.listed())
      .firstOrFail()

    session.deletedAt = DateTime.now()
    await session.save()

    return response.noContent()
  }
}

/** A game with everything its screen shows, scoped to its owner. */
function findGame(sessionId: string, userId: string) {
  return Session.query()
    .where('id', sessionId)
    .where('userId', userId)
    .withScopes((scopes) => scopes.listed())
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
}
