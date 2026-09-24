import { BaseTransformer } from '@adonisjs/core/transformers'

import type { ContentLabels } from '#services/game/content_labels'
import type { TurnResult } from '#services/game/turn_service'
import { presentEffects, presentRoll } from '#transformers/turn_transformer'

/**
 * A played turn, as the front shows it.
 *
 * Every content reference leaves with its label. Scenario flags do not leave
 * at all: they are internal markers, not something the player is told.
 */
export default class TurnResultTransformer extends BaseTransformer<TurnResult> {
  #labels: ContentLabels

  constructor(result: TurnResult, labels: ContentLabels) {
    super(result)
    this.#labels = labels
  }

  toObject() {
    const { roll, effects } = this.resource

    return {
      turnNumber: this.resource.turnNumber,
      narration: this.resource.narration,
      roll: roll && presentRoll(roll, this.#labels),
      effects: presentEffects(effects, this.#labels),
    }
  }
}
