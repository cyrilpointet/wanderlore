import { BaseTransformer } from '@adonisjs/core/transformers'

import type Session from '#models/session'
import type { ContentLabels } from '#services/game/content_labels'
import CharacterTransformer from '#transformers/character_transformer'
import { periodAt } from '#services/game/game_time'
import { inLanguage } from '#services/game/content_labels'
import { heldItemOf } from '#services/game/inventory'

/**
 * The labels of the world a game is played in. A function of the game, since a
 * list of games can span several worlds.
 */
export type LabelsOf = (session: Session) => ContentLabels

/**
 * A game, as the player sees it.
 *
 * Expects `scenario`, `character` (with its `profession`), `characterState`
 * and `worldState` preloaded — the latter with its `currentLocation` — `items`
 * preloaded with the character's only, gone ones left out, and `turns`
 * preloaded with the pending ones only.
 */
export default class SessionTransformer extends BaseTransformer<Session> {
  #labels: ContentLabels

  constructor(session: Session, labelsOf: LabelsOf) {
    super(session)
    this.#labels = labelsOf(session)
  }

  /** The game screen: the full sheet and where the story stands. */
  toObject() {
    const { worldState } = this.resource
    const location = worldState.currentLocation
    const pending = this.resource.turns[0]

    return {
      ...this.#header(),
      character: new CharacterTransformer(
        this.resource.character,
        this.#state(),
        this.#labels,
        this.resource.items.map(heldItemOf)
      ).toObject(),
      /** The handle and its label, whether the place is unique or improvised. */
      location: location ? this.#labels.location(location) : null,
      /** The period of the day, worked out here: the hour, the date and the day stay in the story. */
      period: periodAt(worldState.gameTime),
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

  #header() {
    const chapter = this.resource.currentChapter

    return {
      id: this.resource.id,
      status: this.resource.status,
      lastActivityAt: this.resource.lastActivityAt,
      endedAt: this.resource.endedAt,
      /** Why it ended: victory, defeat, death or abandoned; null while it is played. */
      endReason: this.resource.endReason ?? null,
      characterId: this.resource.characterId,
      world: this.#labels.world(),
      /** Names in English until the player can pick a language (Phase 14). */
      scenario: {
        id: this.resource.scenarioId,
        title: inLanguage(this.resource.scenario.labels, 'en'),
      },
      chapter: chapter === null ? null : this.#labels.of('chapter', chapter),
    }
  }

  #state() {
    const state = this.resource.characterState

    if (!state) {
      throw new Error(`Session ${this.resource.id} has no state for its character.`)
    }

    return state
  }
}
