import World from '#models/world'
import WorldTransformer from '#transformers/admin/world_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/** The worlds of the game, as the back-office lists them. Game masters only. */
export default class WorldsController {
  async index({ serialize }: HttpContext) {
    const worlds = await World.query().withCount('scenarios').orderBy('reference')

    return serialize(WorldTransformer.transform(worlds))
  }
}
