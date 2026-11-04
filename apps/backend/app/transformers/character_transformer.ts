import { BaseTransformer } from '@adonisjs/core/transformers'

import type Character from '#models/character'
import type CharacterState from '#models/character_state'
import { CHARACTERISTICS } from '#services/rules/types'
import type { ContentLabels } from '#services/game/content_labels'
import type { HeldItem } from '#services/game/inventory'

/**
 * The character sheet in a game: who they are — the durable sheet, with
 * their profession preloaded — and how they fare in this game. Its values
 * are shown as they are — it is the player's own sheet, as at the table — but
 * every reference leaves with its label.
 */
export default class CharacterTransformer extends BaseTransformer<Character> {
  #state: CharacterState
  #labels: ContentLabels
  #inventory: HeldItem[]

  constructor(
    character: Character,
    state: CharacterState,
    labels: ContentLabels,
    inventory: HeldItem[]
  ) {
    super(character)
    this.#state = state
    this.#labels = labels
    this.#inventory = inventory
  }

  toObject() {
    const character = this.resource

    return {
      ...sheetOf(character, this.#labels),
      hitPoints: this.#state.hitPoints,
      hitPointsMax: this.#state.hitPointsMax,
      resources: this.#labels.valued('resource', this.#state.resources),
      inventory: presentInventory(this.#inventory, this.#labels),
    }
  }
}

/**
 * The durable sheet: identity, characteristics and skills, the same in every
 * game. Expects the profession preloaded.
 */
export function sheetOf(character: Character, labels: ContentLabels) {
  return {
    name: character.name,
    /** A closed enum of the system: the front labels it itself. */
    gender: character.gender,
    profession: labels.of('profession', character.profession.reference),
    /**
     * The seven of BRP, always in the same order. A closed enum of the
     * system: the front labels them itself.
     */
    characteristics: CHARACTERISTICS.map((reference) => ({
      reference,
      value: character.characteristics[reference],
    })),
    /**
     * Only the skills the character trained. Each names its category, so the
     * front can group them without knowing the world.
     */
    skills: labels.valued('skill', character.skills).map((skill) => ({
      ...skill,
      category: labels.categoryOf(skill.reference),
    })),
  }
}

/**
 * What the character holds, each item with the label of its definition — the
 * archetype's for an improvised one, whose descriptor is for the narrator
 * only. Its modifiers never leave the backend.
 */
export function presentInventory(items: HeldItem[], labels: ContentLabels) {
  return items.map((item) => ({
    handle: item.handle,
    item: labels.of('item', item.definition),
    quantity: item.quantity,
    equipped: item.equipped,
  }))
}
