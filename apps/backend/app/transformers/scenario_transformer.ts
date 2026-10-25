import { BaseTransformer } from '@adonisjs/core/transformers'

import type Scenario from '#models/scenario'
import { inLanguage } from '#services/game/content_labels'

/**
 * A scenario of the catalogue a game is started from. Expects `world`
 * preloaded.
 *
 * Names in English until the player can pick a language (Phase 10). The
 * synopsis and the tone are the game master's own text, written once, in
 * English like all content.
 */
export default class ScenarioTransformer extends BaseTransformer<Scenario> {
  toObject() {
    const { resource: scenario } = this
    const { world } = scenario

    return {
      id: scenario.id,
      title: inLanguage(scenario.labels, 'en'),
      synopsis: scenario.synopsis,
      status: scenario.status,
      world: {
        reference: world.reference,
        label: inLanguage(world.labels, 'en'),
        tone: world.narrativeTone,
      },
    }
  }
}
