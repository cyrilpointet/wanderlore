import { BaseTransformer } from '@adonisjs/core/transformers'

import type Character from '#models/character'
import { CHARACTERISTICS } from '#services/rules/types'
import type { ContentLabels } from '#services/game/content_labels'
import { type HeldItem, heldItemOf } from '#services/game/inventory'

/**
 * The character sheet. Its values are shown as they are — it is the player's
 * own sheet, as at the table — but every reference leaves with its label.
 */
export default class CharacterTransformer extends BaseTransformer<Character> {
  #labels: ContentLabels
  #inventory: HeldItem[] | undefined

  /**
   * The inventory is given when it is already at hand — a turn just applied —
   * or read from the `items` relation, preloaded without the gone ones.
   */
  constructor(character: Character, labels: ContentLabels, inventory?: HeldItem[]) {
    super(character)
    this.#labels = labels
    this.#inventory = inventory
  }

  toObject() {
    const character = this.resource

    return {
      name: character.name,
      hitPoints: character.hitPoints,
      hitPointsMax: character.hitPointsMax,
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
      skills: this.#labels.valued('skill', character.skills).map((skill) => ({
        ...skill,
        category: this.#labels.categoryOf(skill.reference),
      })),
      resources: this.#labels.valued('resource', character.resources),
      inventory: presentInventory(this.#heldItems(), this.#labels),
    }
  }

  #heldItems(): HeldItem[] {
    if (this.#inventory !== undefined) {
      return this.#inventory
    }

    if (!('items' in this.resource.$preloaded)) {
      throw new Error(`Character ${this.resource.id}: preload their items to show the sheet.`)
    }

    return this.resource.items.filter((item) => item.state !== 'gone').map(heldItemOf)
  }

  /** What a game card needs: who, and how they are faring. */
  toSummary() {
    return this.pick(this.resource, ['name', 'hitPoints', 'hitPointsMax'])
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
