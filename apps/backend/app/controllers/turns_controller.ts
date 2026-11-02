import turns from '#services/turn'
import Session from '#models/session'
import TurnLog from '#models/turn_log'
import { ContentLabels } from '#services/game/content_labels'
import { loadWorld } from '#services/game/content/load'
import { playTurnValidator, turnsPageValidator } from '#validators/turn'
import TurnTransformer from '#transformers/turn_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Deliberately thin: it validates the request, names who is asking, and
 * delegates. It computes nothing — no dice, no state, no error shaping. Failures
 * travel up to the exception handler, which owns the mapping.
 */
/** How many turns the journal reads at a time. */
export const TURNS_PAGE_SIZE = 20

export default class TurnsController {
  /**
   * The story so far, a page at a time: the last turns, or those before a
   * turn number — completed turns only, oldest first, and whether earlier
   * ones remain.
   */
  async index({ params, request, auth, serialize }: HttpContext) {
    const { before } = await turnsPageValidator.validate(request.qs())
    const session = await findOwnSession(params.id, auth.getUserOrFail().id)

    /** One more than a page: whether it comes back says if earlier turns remain. */
    const newestFirst = await TurnLog.query()
      .where('sessionId', session.id)
      .withScopes((scopes) => scopes.completed())
      .if(before !== undefined, (query) => query.where('turnNumber', '<', before!))
      .orderBy('turnNumber', 'desc')
      .limit(TURNS_PAGE_SIZE + 1)
    const page = newestFirst.slice(0, TURNS_PAGE_SIZE).reverse()

    /**
     * Beside `data` rather than through `paginate()`: the serializer only takes
     * Lucid's page counts, which a journal read by cursor has no use for.
     */
    return {
      ...(await serialize(TurnTransformer.transform(page, await labelsOf(session)))),
      metadata: { hasEarlier: newestFirst.length > TURNS_PAGE_SIZE },
    }
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

    return serialize(TurnTransformer.transform(turn, await labelsOf(session)))
  }

  /**
   * Accepts the turn and answers at once, before it is played: `202` and the
   * turn, pending, in the same shape as reading it back. How it goes arrives
   * over SSE, or by reading it back.
   *
   * A repeated submission gets the turn its key already names, as it stands,
   * and nothing is queued twice.
   */
  async store({ params, request, response, auth, serialize }: HttpContext) {
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

    const session = await findOwnSession(params.id, auth.getUserOrFail().id)

    response.status(202)

    return serialize(TurnTransformer.transform(turn, await labelsOf(session)))
  }
}

/**
 * Scoped to its owner, so someone else's session reads as one that does not
 * exist.
 */
function findOwnSession(sessionId: string, userId: string) {
  return Session.query()
    .where('id', sessionId)
    .where('userId', userId)
    .withScopes((scopes) => scopes.listed())
    .firstOrFail()
}

/** The labels of the world the game is played in, as it stands now. */
async function labelsOf(session: Session): Promise<ContentLabels> {
  return new ContentLabels(await loadWorld(session))
}
