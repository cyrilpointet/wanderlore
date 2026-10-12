import { DateTime } from 'luxon'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

import User from '#models/user'
import World from '#models/world'
import Session from '#models/session'
import Scenario from '#models/scenario'
import Character from '#models/character'
import WorldState from '#models/world_state'
import { THREE_MUSKETEERS } from '#services/game/world'
import { visitUniqueLocation } from '#services/game/locations'
import { createItem, equipItem } from '#services/game/inventory'

/**
 * A playable game for the test account, so the turn endpoint can be exercised
 * with curl before any front exists (see roadmap, Phase 2).
 *
 * Restricted to local environments, like the account it hangs off.
 *
 * Everything is in English, including the character's skills and the world
 * state: the project keeps its state in one language and translates only at
 * the narration step.
 */
export default class extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const player = await User.findBy('email', 'player@wanderlore.test')

    if (!player) {
      throw new Error('Run the test user seeder first: the demo game hangs off that account.')
    }

    /**
     * Idempotent on the account rather than on a fixed id, so re-seeding
     * refreshes the game instead of piling up sessions.
     */
    const existing = await Session.query().where('userId', player.id).first()

    if (existing) {
      await existing.delete()
    }

    /** Written by the content seeder, which runs first. */
    const world = await World.findByOrFail('reference', THREE_MUSKETEERS.reference)
    const scenario = await Scenario.query()
      .where('worldId', world.id)
      .where('reference', 'a_gascon_in_paris')
      .firstOrFail()

    const session = await Session.create({
      userId: player.id,
      worldId: world.id,
      scenarioId: scenario.id,
      status: 'in_progress',
      currentChapter: 'the_road_to_paris',
      lastActivityAt: DateTime.now(),
    })

    const character = await Character.create({
      sessionId: session.id,
      name: "d'Artagnan",
      attributes: { physical: 3, mental: 2, social: 3 },
      /**
       * Drawn from the world's own skill list, so the arbitration step can
       * never name one this character does not have.
       */
      skills: skillsFor(['swordsmanship', 'athletics', 'observation', 'persuasion', 'etiquette']),
      hitPoints: 10,
      hitPointsMax: 10,
      resources: { purse: 15 },
      progression: {},
    })

    /** The story opens in Meung, the first place the game has been through. */
    const meung = await visitUniqueLocation(THREE_MUSKETEERS, session.id, 'meung_sur_loire')

    await WorldState.create({
      sessionId: session.id,
      currentLocationId: meung.id,
      activeQuests: [
        {
          reference: 'deliver_the_letter',
          step: 1,
          summary: 'Carry your father’s letter to Monsieur de Tréville.',
        },
      ],
      narrativeFlags: {},
    })

    /**
     * What d'Artagnan leaves Gascony with: his father's letter for Tréville,
     * and his father's old sword at his side. His purse is a resource, not an
     * item.
     */
    const holder = { type: 'character' as const, id: character.id }

    await createItem(
      THREE_MUSKETEERS,
      session.id,
      { definition: 'letter_to_treville', descriptor: null, quantity: 1 },
      holder
    )

    const sword = await createItem(
      THREE_MUSKETEERS,
      session.id,
      {
        definition: 'rapier',
        descriptor: "his father's old sword, long and a little out of fashion",
        quantity: 1,
      },
      holder
    )
    await equipItem(THREE_MUSKETEERS, sword)
  }
}

/**
 * Fails loudly on a skill the world does not define: a character holding one
 * would make the closed list the validator enforces a lie.
 */
function skillsFor(names: string[]): Record<string, number> {
  const known = new Set(THREE_MUSKETEERS.skills.map((skill) => skill.reference))
  const values: Record<string, number> = { swordsmanship: 3, persuasion: 2 }

  for (const name of names) {
    if (!known.has(name)) {
      throw new Error(`"${name}" is not a skill of the ${THREE_MUSKETEERS.reference} world.`)
    }
  }

  return Object.fromEntries(names.map((name) => [name, values[name] ?? 1]))
}
