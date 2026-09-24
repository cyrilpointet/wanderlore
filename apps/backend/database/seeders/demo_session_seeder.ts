import { DateTime } from 'luxon'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

import User from '#models/user'
import Session from '#models/session'
import Character from '#models/character'
import WorldState from '#models/world_state'
import { THREE_MUSKETEERS } from '#services/game/world'

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

    const session = await Session.create({
      userId: player.id,
      status: 'in_progress',
      currentChapter: 'the_road_to_paris',
      lastActivityAt: DateTime.now(),
    })

    await Character.create({
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

    await WorldState.create({
      sessionId: session.id,
      activeQuests: [
        {
          reference: 'deliver_the_letter',
          step: 1,
          summary: 'Carry your father’s letter to Monsieur de Tréville.',
        },
      ],
      narrativeFlags: {},
      visitedLocations: [{ reference: 'meung_sur_loire' }],
      worldObjects: [{ reference: 'letter_to_treville', location: 'carried' }],
    })
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
