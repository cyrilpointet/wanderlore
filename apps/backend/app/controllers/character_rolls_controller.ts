import dice from '#services/dice'
import { rollSeries } from '#services/game/character_creation'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * The characteristics a player rolls to create a character: seven times
 * four d6, the three best kept, by the backend. As often as they like — each roll replaces the last.
 */
export default class CharacterRollsController {
  async store({ auth, response }: HttpContext) {
    const { roll, dice: faces } = await rollSeries(auth.getUserOrFail(), dice)

    response.status(201)

    /** Each result with its four dice and the one set aside, in the same order. */
    return {
      data: {
        id: roll.id,
        values: roll.values,
        dice: faces.map(({ faces: drawn, dropped }) => ({ faces: drawn, dropped })),
      },
    }
  }
}
