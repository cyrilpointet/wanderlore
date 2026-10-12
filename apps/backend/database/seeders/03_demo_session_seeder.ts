import { BaseSeeder } from '@adonisjs/lucid/seeders'

import User from '#models/user'
import World from '#models/world'
import Session from '#models/session'
import Scenario from '#models/scenario'
import { startGame } from '#services/game/new_game'

/**
 * A playable game for the test account, so the turn endpoint can be exercised
 * with curl before any front exists (see roadmap, Phase 2).
 *
 * Restricted to local environments, like the account it hangs off. Started
 * the way the New game screen starts one: from the scenario the content
 * seeder publishes, with its pregenerated character.
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
    const world = await World.findByOrFail('reference', 'three_musketeers')
    const scenario = await Scenario.query()
      .where('worldId', world.id)
      .where('reference', 'a_gascon_in_paris')
      .firstOrFail()

    await startGame(player, scenario.id)
  }
}
