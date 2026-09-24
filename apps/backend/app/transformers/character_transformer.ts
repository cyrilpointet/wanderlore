import { BaseTransformer } from '@adonisjs/core/transformers'

import type Character from '#models/character'
import type { ContentLabels } from '#services/game/content_labels'

/**
 * The character sheet. Its values are shown as they are — it is the player's
 * own sheet, as at the table — but every reference leaves with its label.
 */
export default class CharacterTransformer extends BaseTransformer<Character> {
  #labels: ContentLabels

  constructor(character: Character, labels: ContentLabels) {
    super(character)
    this.#labels = labels
  }

  toObject() {
    const character = this.resource

    return {
      name: character.name,
      hitPoints: character.hitPoints,
      hitPointsMax: character.hitPointsMax,
      attributes: this.#labels.valued('attribute', character.attributes),
      /**
       * Only the skills the character has. Each names its attribute, so the
       * front can group them without knowing the world.
       */
      skills: this.#labels.valued('skill', character.skills).map((skill) => ({
        ...skill,
        attribute: this.#labels.attributeOf(skill.reference),
      })),
      resources: this.#labels.valued('resource', character.resources),
    }
  }

  /** What a game card needs: who, and how they are faring. */
  toSummary() {
    return this.pick(this.resource, ['name', 'hitPoints', 'hitPointsMax'])
  }
}
