import { BaseTransformer } from '@adonisjs/core/transformers'

import type World from '#models/world'

/** A world as the back-office reads it. */
export default class WorldTransformer extends BaseTransformer<World> {
  /** In the list. Expects `scenarios` counted (`withCount('scenarios')`). */
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

  /** Everything the world itself holds; its scenarios and catalogues have routes of their own. */
  toDetail() {
    return this.pick(this.resource, [
      'id',
      'reference',
      'labels',
      'narrativeTone',
      'rules',
      'ambiance',
      'attributes',
      'skills',
      'resources',
      'glossary',
      'updatedAt',
    ])
  }
}
