import { DateTime } from 'luxon'

import Session from '#models/session'
import { ContentLabels } from '#services/game/content_labels'
import { loadWorld } from '#services/game/content/load'
import { GameNotFailedError, abandonGame } from '#services/game/game_lifecycle'
import SessionTransformer from '#transformers/session_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * The player's games. Every lookup is scoped to the player asking, so someone
 * else's game is indistinguishable from one that does not exist — as is a game
 * the player deleted, or a game of a character they deleted. A game is started
 * from its character (`CharactersController`).
 */
export default class SessionsController {
  async show({ params, auth, serialize }: HttpContext) {
    const session = await findGame(params.id, auth.getUserOrFail().id)
    const labels = new ContentLabels(await loadWorld(session))

    return serialize(SessionTransformer.transform(session, () => labels))
  }

  /**
   * The player gives the game up: it fails, and closes. Answers with the game
   * as it now stands, closed.
   */
  async abandon({ params, auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    await abandonGame(params.id, user.id)

    const session = await findGame(params.id, user.id)
    const labels = new ContentLabels(await loadWorld(session))

    return serialize(SessionTransformer.transform(session, () => labels))
  }

  /**
   * Removes a failed game from the player's list. Soft: the game and its turns
   * stay in the base. An ongoing game is abandoned first; a success is kept.
   */
  async destroy({ params, auth, response }: HttpContext) {
    const session = await Session.query()
      .where('id', params.id)
      .where('userId', auth.getUserOrFail().id)
      .withScopes((scopes) => scopes.listed())
      .firstOrFail()

    if (session.status !== 'failed') {
      throw new GameNotFailedError()
    }

    session.deletedAt = DateTime.now()
    await session.save()

    return response.noContent()
  }
}

/** A game with everything its screen shows, scoped to its owner. */
export function findGame(sessionId: string, userId: string) {
  return Session.query()
    .where('id', sessionId)
    .where('userId', userId)
    .withScopes((scopes) => scopes.listed())
    .preload('scenario')
    .preload('character', (character) => character.preload('profession'))
    .preload('characterState')
    .preload('items', (items) =>
      items
        .whereNotNull('characterId')
        .whereNot('state', 'gone')
        .orderBy('createdAt', 'asc')
        .orderBy('definitionReference', 'asc')
        .orderBy('handle', 'asc')
    )
    .preload('worldState', (worldState) => worldState.preload('currentLocation'))
    .preload('turns', (turns) => turns.where('status', 'pending'))
    .firstOrFail()
}
