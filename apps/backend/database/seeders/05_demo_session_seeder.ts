import { BaseSeeder } from '@adonisjs/lucid/seeders'

import User from '#models/user'
import World from '#models/world'
import Session from '#models/session'
import Scenario from '#models/scenario'
import Character from '#models/character'
import Profession from '#models/profession'
import { startGame } from '#services/game/new_game'

/** The test character: a young Gascon in Tréville's favour, as the novel has him. */
const DEMO_CHARACTER = {
  name: "d'Artagnan",
  gender: 'male' as const,
  profession: 'musketeer',
  /** Quick, hot-headed and charming. */
  characteristics: { STR: 13, CON: 14, SIZ: 12, INT: 13, POW: 12, DEX: 16, CHA: 14 },
  skills: {
    swordsmanship: 60,
    athletics: 40,
    stealth: 35,
    observation: 35,
    persuasion: 40,
    deception: 30,
    etiquette: 30,
  },
}

/**
 * A character and a playable game for the test account, so the turn endpoint
 * can be exercised with curl before going through the front (see roadmap,
 * Phase 2).
 *
 * Restricted to local environments, like the account it hangs off. The game
 * is started the way the front starts one: from the character, in the
 * scenario the content seeder publishes.
 */
export default class extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const player = await User.findBy('email', 'player@wanderlore.test')

    if (!player) {
      throw new Error('Run the test user seeder first: the demo game hangs off that account.')
    }

    /** Written by the content seeder, which runs first. */
    const world = await World.findByOrFail('reference', 'three_musketeers')
    const scenario = await Scenario.query()
      .where('worldId', world.id)
      .where('reference', 'the_stolen_seal')
      .firstOrFail()
    const profession = await Profession.query()
      .where('worldId', world.id)
      .where('reference', DEMO_CHARACTER.profession)
      .firstOrFail()

    /**
     * Idempotent on the account rather than on fixed ids, so re-seeding
     * refreshes the game instead of piling up games, and keeps the character.
     */
    await Session.query().where('userId', player.id).delete()

    const { name, gender, characteristics, skills } = DEMO_CHARACTER
    const character = await Character.updateOrCreate(
      { userId: player.id, worldId: world.id, name: DEMO_CHARACTER.name },
      {
        name,
        gender,
        characteristics,
        skills,
        professionId: profession.id,
        progression: {},
        deletedAt: null,
      }
    )

    await startGame(player, character, scenario.id)
  }
}
