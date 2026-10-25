import { BaseTransformer } from '@adonisjs/core/transformers'

import type TurnLog from '#models/turn_log'
import type { ContentLabels } from '#services/game/content_labels'
import type { Labelled } from '#services/game/content_labels'
import type { AppliedEffects, AppliedHolder, AppliedItems } from '#services/game/prompts/types'
import type { RollResolution } from '#services/rules/types'

/**
 * A logged turn, as the journal shows it — and as a client reads it back after
 * missing the end of its SSE stream.
 *
 * The log keeps everything, for debugging. What leaves is what the player
 * may see: the detail of each roll, as at the table — but never the
 * circumstance arbitration named, nor the scenario flags.
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
   * The roll carries what the backend derived from the action type: a skill
   * or a characteristic. Every logged turn is on the BRP rules — the switch
   * deleted the games played before it.
   */
  #roll() {
    const { rollResult } = this.resource

    if (rollResult === null) {
      return null
    }

    if (!('base' in rollResult)) {
      throw new Error(`Turn ${this.resource.id} logged a roll without what it rolled.`)
    }

    return presentRoll(rollResult as unknown as RollResolution, this.#labels)
  }
}

/**
 * The detail of a roll, for the player: what was rolled and at how much, the
 * difficulty, every modifier with its value, the chance, the d100 and the
 * degree. A skill leaves labelled; a characteristic is a closed enum of the
 * system, which the front labels. A circumstance leaves as its label of
 * effect, never as the words arbitration named it with.
 */
export function presentRoll(roll: RollResolution, labels: ContentLabels) {
  return {
    skill: roll.base.kind === 'skill' ? labels.of('skill', roll.base.skill) : null,
    characteristic: roll.base.kind === 'characteristic' ? roll.base.characteristic : null,
    value: roll.base.value,
    baseChance: roll.baseChance,
    difficulty: roll.difficulty,
    modifiers: roll.appliedModifiers.map((modifier) =>
      modifier.source === 'contextual'
        ? { source: modifier.source, effect: modifier.effect, value: modifier.value }
        : {
            source: modifier.source,
            item: labels.of('item', modifier.origin),
            value: modifier.value,
          }
    ),
    chance: roll.chance,
    roll: roll.roll,
    result: roll.result,
    degree: roll.degree,
  }
}

/**
 * The effects the player is told about: hit points, movement, and what
 * happened to the character's items. Scenario flags, the changes about people
 * and what passes between others stay out.
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
    items: presentItemChanges(effects.items, labels),
  }
}

/** How an item changed for the character, as the journal tells it. */
export const ITEM_CHANGES = ['gained', 'lost', 'used_up', 'equipped', 'unequipped'] as const

type ItemChange = {
  change: (typeof ITEM_CHANGES)[number]
  item: Labelled
  quantity: number
  /** Who it came from or went to, when someone or somewhere did. */
  counterpart: Labelled | null
}

/**
 * The changes that touch the character, in the order they were applied.
 * Turns played before Phase 4 logged no item at all.
 */
function presentItemChanges(items: AppliedItems | undefined, labels: ContentLabels): ItemChange[] {
  if (items === undefined) {
    return []
  }

  const item = (definition: string) => labels.of('item', definition)
  const changes: ItemChange[] = []

  for (const created of items.created.filter(({ holder }) => holder.holder === 'character')) {
    changes.push({
      change: 'gained',
      item: item(created.definition),
      quantity: created.quantity,
      counterpart: null,
    })
  }

  for (const moved of items.transferred) {
    if (moved.to.holder === 'character') {
      changes.push({
        change: 'gained',
        item: item(moved.definition),
        quantity: moved.quantity,
        counterpart: holderLabel(moved.from, labels),
      })
    } else if (moved.from.holder === 'character') {
      changes.push({
        change: 'lost',
        item: item(moved.definition),
        quantity: moved.quantity,
        counterpart: holderLabel(moved.to, labels),
      })
    }
  }

  for (const used of items.destroyed.filter(({ holder }) => holder.holder === 'character')) {
    changes.push({
      change: 'used_up',
      item: item(used.definition),
      quantity: used.quantity,
      counterpart: null,
    })
  }

  for (const [change, list] of [
    ['equipped', items.equipped],
    ['unequipped', items.unequipped],
  ] as const) {
    for (const entry of list) {
      changes.push({ change, item: item(entry.definition), quantity: 1, counterpart: null })
    }
  }

  return changes
}

/** Someone by the name the game learnt, else by their definition; a place as the badge shows it. */
function holderLabel(holder: AppliedHolder, labels: ContentLabels): Labelled | null {
  if (holder.holder === 'npc') {
    return {
      reference: holder.handle,
      label: holder.name ?? labels.of('npc', holder.definitionReference).label,
    }
  }

  return holder.holder === 'location' ? labels.location(holder.place) : null
}
