import { BaseTransformer } from '@adonisjs/core/transformers'

import type Session from '#models/session'
import type { ContentLabels } from '#services/game/content_labels'
import CharacterTransformer from '#transformers/character_transformer'

/**
 * A game, as the player sees it.
 *
 * Expects `characters` and `worldState` preloaded, and `turns` preloaded with
 * the pending ones only.
 */
export default class SessionTransformer extends BaseTransformer<Session> {
  #labels: ContentLabels

  constructor(session: Session, labels: ContentLabels) {
    super(session)
    this.#labels = labels
  }

  /** The game screen: the full sheet and where the story stands. */
  toObject() {
    const { worldState } = this.resource
    const location = worldState.currentLocation
    const pending = this.resource.turns[0]

    return {
      ...this.#header(),
      character: CharacterTransformer.transform(this.#character(), this.#labels),
      location: location === null ? null : this.#labels.of('location', location),
      activeQuests: worldState.activeQuests.map((quest) => ({
        ...this.#labels.of('quest', quest.reference as string),
        summary: typeof quest.summary === 'string' ? quest.summary : null,
      })),
      /**
       * Lets a reopened screen go straight back to waiting on the turn it left
       * running, instead of offering to submit another.
       */
      pendingTurn: pending ? { id: pending.id } : null,
    }
  }

  /** A card of the game list. */
  toSummary() {
    return {
      ...this.#header(),
      character: CharacterTransformer.transform(this.#character(), this.#labels).useVariant(
        'toSummary'
      ),
    }
  }

  #header() {
    const chapter = this.resource.currentChapter

    return {
      id: this.resource.id,
      status: this.resource.status,
      lastActivityAt: this.resource.lastActivityAt,
      world: this.#labels.world(),
      chapter: chapter === null ? null : this.#labels.of('chapter', chapter),
    }
  }

  /**
   * A session is played by a single character today, although the schema
   * does not enforce it — see the `characters` relation.
   */
  #character() {
    const [character] = this.resource.characters

    if (!character) {
      throw new Error(`Session ${this.resource.id} has no character.`)
    }

    return character
  }
}
