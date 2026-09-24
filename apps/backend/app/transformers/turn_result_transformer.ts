import { BaseTransformer } from '@adonisjs/core/transformers'

import type { ContentLabels } from '#services/game/content_labels'
import type { TurnResult } from '#services/game/turn_service'

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
      roll: roll && {
        skill: this.#labels.of('skill', roll.skill),
        result: roll.result,
        margin: roll.margin,
      },
      effects: {
        hitPointsDelta: effects.hit_points_delta,
        movement: effects.movement === null ? null : this.#labels.of('location', effects.movement),
      },
    }
  }
}
