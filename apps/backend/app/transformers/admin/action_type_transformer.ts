import { BaseTransformer } from '@adonisjs/core/transformers'

import type ResolutionRule from '#models/resolution_rule'

/** A category of action and the skill that resolves it. */
export default class ActionTypeTransformer extends BaseTransformer<ResolutionRule> {
  toObject() {
    return this.pick(this.resource, ['id', 'actionType', 'description', 'associatedSkill'])
  }
}
