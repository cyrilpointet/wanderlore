import { BaseTransformer } from '@adonisjs/core/transformers'

import type Scenario from '#models/scenario'

/** A scenario as the back-office reads it; its catalogues have routes of their own. */
export default class ScenarioTransformer extends BaseTransformer<Scenario> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'worldId',
      'reference',
      'labels',
      'synopsis',
      'status',
      'chapters',
      'quests',
      'pregeneratedCharacter',
      'initialState',
      'glossary',
      'updatedAt',
    ])
  }
}
