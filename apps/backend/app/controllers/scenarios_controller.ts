import { playableScenarios } from '#services/game/new_game'
import ScenarioTransformer from '#transformers/scenario_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * The catalogue games are started from: published scenarios, drafts too for
 * a game master.
 */
export default class ScenariosController {
  async index({ auth, serialize }: HttpContext) {
    const scenarios = await playableScenarios(auth.getUserOrFail())

    return serialize(ScenarioTransformer.transform(scenarios))
  }
}
