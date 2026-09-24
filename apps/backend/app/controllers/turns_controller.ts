import turns from '#services/turn'
import Session from '#models/session'
import TurnLog from '#models/turn_log'
import { ContentLabels } from '#services/game/content_labels'
import { THREE_MUSKETEERS } from '#services/game/world'
import { playTurnValidator } from '#validators/turn'
import TurnTransformer from '#transformers/turn_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/** One world until Phase 5, where the session names its own. */
const labels = new ContentLabels(THREE_MUSKETEERS)

/**
 * Deliberately thin: it validates the request, names who is asking, and
 * delegates. It computes nothing — no dice, no state, no error shaping. Failures
 * travel up to the exception handler, which owns the mapping.
 */
export default class TurnsController {
  /** The story so far: completed turns only, oldest first. */
  async index({ params, auth, serialize }: HttpContext) {
    const session = await findOwnSession(params.id, auth.getUserOrFail().id)

    const history = await TurnLog.query()
      .where('sessionId', session.id)
      .withScopes((scopes) => scopes.completed())
      .orderBy('turnNumber', 'asc')

    return serialize(TurnTransformer.transform(history, labels))
  }

  /**
   * One turn whatever its status, failed included: this is how a client that
   * missed the end of the SSE stream learns how the turn ended.
   */
  async show({ params, auth, serialize }: HttpContext) {
    const session = await findOwnSession(params.id, auth.getUserOrFail().id)

    const turn = await TurnLog.query()
      .where('sessionId', session.id)
      .where('id', params.turnId)
      .firstOrFail()

    return serialize(TurnTransformer.transform(turn, labels))
  }

  /**
   * Answers with the turn, in the same shape as reading it back. A repeated
   * submission gets the turn its key already names, as it stands, and nothing
   * is played twice.
   */
  async store({ params, request, auth, serialize }: HttpContext) {
    const { playerInput, headers } = await request.validateUsing(playTurnValidator)

    const { turn } = await turns.submit({
      sessionId: params.id,
      /**
       * The session is looked up scoped to its owner, so someone else's session
       * is indistinguishable from one that does not exist.
       */
      userId: auth.getUserOrFail().id,
      playerInput,
      idempotencyKey: headers['idempotency-key'],
    })

    return serialize(TurnTransformer.transform(turn, labels))
  }
}

/**
 * Scoped to its owner, so someone else's session reads as one that does not
 * exist.
 */
function findOwnSession(sessionId: string, userId: string) {
  return Session.query().where('id', sessionId).where('userId', userId).firstOrFail()
}
