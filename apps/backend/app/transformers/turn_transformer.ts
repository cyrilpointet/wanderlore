import { BaseTransformer } from '@adonisjs/core/transformers'

import type TurnLog from '#models/turn_log'
import type { ContentLabels } from '#services/game/content_labels'
import type { AppliedEffects } from '#services/game/prompts/types'
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
          : presentEffects(turn.appliedEffects as AppliedEffects, this.#labels),
      /** Code and message only: the rejected rules are for whoever debugs it. */
      failure:
        turn.failure === null
          ? null
          : { code: turn.failure.code as string, message: turn.failure.message as string },
    }
  }

  /**
   * The roll carries the skill the backend derived from the action type.
   * Turns logged before that derivation existed have it in the arbitration
   * output instead, where the model picked it.
   */
  #roll() {
    const { rollResult, arbitrationOutput } = this.resource

    if (rollResult === null) {
      return null
    }

    const legacy = arbitrationOutput?.resolution as { skill_used?: string } | undefined
    const skill = (rollResult.skill as string | undefined) ?? legacy?.skill_used

    if (skill === undefined) {
      throw new Error(`Turn ${this.resource.id} logged a roll without its skill.`)
    }

    return presentRoll(
      {
        skill,
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
 * The effects the player is told about: hit points and movement. Scenario
 * flags and the changes about people are internal and stay out.
 *
 * A movement is logged as the place reached, references only, and labelled
 * here; turns logged before improvised places existed hold a bare handle,
 * which was always a named place's own reference.
 */
export function presentEffects(effects: AppliedEffects, labels: ContentLabels) {
  const movement = effects.movement as AppliedEffects['movement'] | string

  return {
    hitPointsDelta: effects.hit_points_delta,
    movement:
      movement === null
        ? null
        : typeof movement === 'string'
          ? labels.of('location', movement)
          : labels.location(movement),
  }
}
