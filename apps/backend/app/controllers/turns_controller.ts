import turns from '#services/turn'
import { ContentLabels } from '#services/game/content_labels'
import { THREE_MUSKETEERS } from '#services/game/world'
import { playTurnValidator } from '#validators/turn'
import TurnResultTransformer from '#transformers/turn_result_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Plays one turn.
 *
 * Deliberately thin: it validates the request body, names who is asking, and
 * delegates. It computes nothing — no dice, no state, no error shaping. Failures
 * travel up to the exception handler, which owns the mapping.
 */
export default class TurnsController {
  async store({ params, request, auth, serialize }: HttpContext) {
    const { playerInput } = await request.validateUsing(playTurnValidator)

    const result = await turns.play({
      sessionId: params.id,
      /**
       * The session is looked up scoped to its owner, so someone else's session
       * is indistinguishable from one that does not exist.
       */
      userId: auth.getUserOrFail().id,
      playerInput,
    })

    /** One world until Phase 5, where the session names its own. */
    return serialize(TurnResultTransformer.transform(result, new ContentLabels(THREE_MUSKETEERS)))
  }
}
