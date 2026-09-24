import { BaseTransformer } from '@adonisjs/core/transformers'

import type TurnLog from '#models/turn_log'
import type { ContentLabels } from '#services/game/content_labels'
import type { TurnEffects } from '#services/game/prompts/types'
import type { MarginLabel, RollOutcome } from '#services/rules/types'

/**
 * A logged turn, as the journal shows it — and as a client reads it back after
 * missing the end of its SSE stream.
 *
 * The log keeps everything, dice included, for debugging. What leaves is only
 * what the player may see: the skill, the verdict and a qualitative margin,
 * never the dice, the threshold or the total. Scenario flags never leave.
 */
export default class TurnTransformer extends BaseTransformer<TurnLog> {
  #labels: ContentLabels

  constructor(turn: TurnLog, labels: ContentLabels) {
    super(turn)
    this.#labels = labels
  }

  toObject() {
    const turn = this.resource

    return {
      id: turn.id,
      turnNumber: turn.turnNumber,
      status: turn.status,
      playerInput: turn.playerInput,
      roll: this.#roll(),
      narration: turn.status === 'completed' ? turn.narratedText : null,
      effects:
        turn.appliedEffects === null
          ? null
          : presentEffects(turn.appliedEffects as TurnEffects, this.#labels),
      /** Code and message only: the rejected rules are for whoever debugs it. */
      failure:
        turn.failure === null
          ? null
          : { code: turn.failure.code as string, message: turn.failure.message as string },
    }
  }

  /**
   * The skill lives in the arbitration output, the verdict in the roll: the
   * log keeps each where the step that decided it wrote it.
   */
  #roll() {
    const { rollResult, arbitrationOutput } = this.resource

    if (rollResult === null) {
      return null
    }

    const resolution = arbitrationOutput?.resolution as { skill_used: string }

    return presentRoll(
      {
        skill: resolution.skill_used,
        result: rollResult.result as RollOutcome,
        margin: rollResult.marginLabel as MarginLabel,
      },
      this.#labels
    )
  }
}

export function presentRoll(
  roll: { skill: string; result: RollOutcome; margin: MarginLabel },
  labels: ContentLabels
) {
  return {
    skill: labels.of('skill', roll.skill),
    result: roll.result,
    margin: roll.margin,
  }
}

/**
 * The effects the player is told about: hit points and movement. Scenario flags
 * are internal markers and are dropped here.
 */
export function presentEffects(effects: TurnEffects, labels: ContentLabels) {
  return {
    hitPointsDelta: effects.hit_points_delta,
    movement: effects.movement === null ? null : labels.of('location', effects.movement),
  }
}
