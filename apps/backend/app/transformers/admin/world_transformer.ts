import { BaseTransformer } from '@adonisjs/core/transformers'

import type World from '#models/world'

/**
 * A world in the back-office list. Expects `scenarios` counted
 * (`withCount('scenarios')`).
 */
export default class WorldTransformer extends BaseTransformer<World> {
  toObject() {
    const world = this.resource

    return {
      id: world.id,
      reference: world.reference,
      labels: world.labels,
      scenarioCount: Number(world.$extras.scenarios_count ?? 0),
      updatedAt: world.updatedAt,
    }
  }
}
