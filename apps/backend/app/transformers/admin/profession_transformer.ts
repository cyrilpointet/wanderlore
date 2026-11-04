import { BaseTransformer } from '@adonisjs/core/transformers'

import type Profession from '#models/profession'

/** A profession of a world, as the back-office edits it. */
export default class ProfessionTransformer extends BaseTransformer<Profession> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'worldId',
      'reference',
      'labels',
      'description',
      'skills',
      'startingItems',
      'startingResources',
      'updatedAt',
    ])
  }
}
