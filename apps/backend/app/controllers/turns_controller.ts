import turns from '#services/turn'
import { playTurnValidator } from '#validators/turn'
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

    return serialize(result)
  }
}
